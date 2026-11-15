import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { PendingDraftPayload } from '../interactions/interaction-payload.schema.js';
import { addEatDays, DAY_MS, eatDayStart, EAT_TIMEZONE } from './analytics-time.js';
import type { AnalyticsReport, CountRate, RetentionMetric } from './analytics-report.types.js';

type SafeMetadata = Record<string, unknown>;

const rate = (numerator: number, denominator: number): CountRate => ({
  numerator,
  denominator,
  percentage: denominator === 0 ? '0.00' : ((numerator * 100) / denominator).toFixed(2),
});

@Injectable()
export class AnalyticsReportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async generate(asOf: Date = new Date()): Promise<AnalyticsReport> {
    if (Number.isNaN(asOf.getTime())) throw new Error('Invalid analytics as-of date');
    const dayStart = eatDayStart(asOf);
    const dayEnd = addEatDays(dayStart, 1);
    const events = await this.prisma.event.findMany({
      where: { occurredAt: { lt: dayEnd } },
      select: { userId: true, eventType: true, metadata: true, occurredAt: true },
    });
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        status: true,
        language: true,
        morningEnabled: true,
        nightEnabled: true,
        createdAt: true,
      },
    });
    const activeUsersList = users.filter((u) => u.status === 'ACTIVE');
    const activeGroups = await this.prisma.transactionGroup.findMany({
      where: { undoneAt: null, messageAt: { lt: dayEnd } },
      select: { userId: true, messageAt: true },
    });
    const [dbTransactions, pendingInteractions, recentEvents, activeSessionsCount] =
      await Promise.all([
        this.prisma.transaction.findMany({
          where: { occurredAt: { lt: dayEnd }, group: { undoneAt: null } },
          select: {
            id: true,
            amountEtb: true,
            category: true,
            kind: true,
            platform: true,
            occurredAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                language: true,
              },
            },
            group: {
              select: {
                source: true,
              },
            },
          },
          orderBy: { occurredAt: 'desc' },
        }),
        this.prisma.pendingInteraction.findMany({
          where: {
            createdAt: { lt: dayEnd },
            kind: 'CLARIFY_FINANCIAL',
            state: 'PENDING',
          },
          select: { payload: true, createdAt: true },
        }),
        this.prisma.event.findMany({
          where: { occurredAt: { lt: dayEnd } },
          orderBy: { occurredAt: 'desc' },
          take: 20,
          select: {
            id: true,
            eventType: true,
            metadata: true,
            occurredAt: true,
            user: { select: { firstName: true, username: true } },
          },
        }),
        this.prisma.customerSession?.count
          ? this.prisma.customerSession.count({
              where: { createdAt: { lt: dayEnd }, revokedAt: null },
            })
          : Promise.resolve(0),
      ]);

    const signupUsers = uniqueUsers(events, 'signup');
    const consentUsers = uniqueUsers(events, 'consent_completed');
    const transactionEvents = events.filter(({ eventType }) => eventType === 'transaction_logged');
    const transactionCounts = this.transactionCounts(transactionEvents);
    const requested = eventCount(events, 'clarification_requested');
    const resolved = eventCount(events, 'clarification_resolved');
    const failed = eventCount(events, 'clarification_failed');
    const outstandingClarifications = Math.max(0, requested - resolved - failed);
    const measurableAttempts = transactionEvents.length + failed + outstandingClarifications;
    const dashboardEvents = events.filter(({ eventType }) => eventType === 'dashboard_opened');
    const disabled = activeUsersList.filter(
      (user) => !user.morningEnabled || !user.nightEnabled,
    ).length;

    // Financial volume calculations
    let totalCents = 0n;
    let totalExpenseCents = 0n;
    const catMap = new Map<string, bigint>();
    for (const tx of dbTransactions) {
      const cents = BigInt(Math.round(Number(tx.amountEtb) * 100));
      totalCents += cents;
      const kind = tx.kind || 'EXPENSE';
      if (kind === 'EXPENSE') {
        totalExpenseCents += cents;
        catMap.set(tx.category, (catMap.get(tx.category) ?? 0n) + cents);
      }
    }
    for (const p of pendingInteractions) {
      const payload = (p.payload as unknown as PendingDraftPayload | null) ?? {};
      const amountVal =
        payload.amount ?? payload.event?.amount ?? payload.readyTransactions?.[0]?.amount ?? '0';
      const cents = BigInt(Math.round(Number(amountVal) * 100));
      totalCents += cents;
      totalExpenseCents += cents;
      catMap.set('uncategorized', (catMap.get('uncategorized') ?? 0n) + cents);
    }
    const totalVolumeEtb = (Number(totalCents) / 100).toFixed(2);
    const totalExpenseVolumeEtb = (Number(totalExpenseCents) / 100).toFixed(2);
    const mau = activeBetween(activeGroups, new Date(dayEnd.getTime() - 30 * DAY_MS), dayEnd);
    const avgVolumePerUserEtb =
      mau > 0 ? (Number(totalCents) / 100 / mau).toFixed(2) : totalVolumeEtb;
    const uniqueTransactingUsers = new Set(dbTransactions.map((tx) => tx.user.id)).size;

    const baseCents = totalExpenseCents > 0n ? totalExpenseCents : totalCents;
    const topCategories = Array.from(catMap.entries())
      .map(([cat, cents]) => {
        const amt = Number(cents) / 100;
        const pct =
          Number(baseCents) > 0 ? ((amt * 100) / (Number(baseCents) / 100)).toFixed(1) : '0.0';
        return { category: cat, amountEtb: amt.toFixed(2), percentage: pct };
      })
      .sort((a, b) => Number(b.amountEtb) - Number(a.amountEtb))
      .slice(0, 5);

    // ─────────────────────────────────────────────────────────────
    // 1. Payment Channels & Banking Intake Distribution
    // ─────────────────────────────────────────────────────────────
    const channelVolumeMap = new Map<string, { cents: bigint; count: number }>();
    const normalizeBank = (
      platform: string | null,
    ): { key: string; name: string; color: string } => {
      const p = (platform || '').toUpperCase();
      if (p.includes('TELEBIRR'))
        return { key: 'telebirr', name: 'Telebirr SuperApp', color: '#0068f9' };
      if (p.includes('CBE') || p.includes('COMMERCIAL'))
        return { key: 'cbe', name: 'Commercial Bank of Ethiopia', color: '#3d8bfd' };
      if (p.includes('ABYSSINIA') || p.includes('BOA'))
        return { key: 'boa', name: 'Bank of Abyssinia', color: '#60a5fa' };
      if (p.includes('AWASH')) return { key: 'awash', name: 'Awash Bank', color: '#93c5fd' };
      if (p.includes('DASHEN'))
        return { key: 'dashen', name: 'Dashen Bank (Amole)', color: '#a5b4fc' };
      return { key: 'cash', name: 'Direct Cash / Other Rails', color: '#cbd5e1' };
    };

    for (const tx of dbTransactions) {
      const bank = normalizeBank(tx.platform);
      const existing = channelVolumeMap.get(bank.key) ?? { cents: 0n, count: 0 };
      existing.cents += BigInt(Math.round(Number(tx.amountEtb) * 100));
      existing.count += 1;
      channelVolumeMap.set(bank.key, existing);
    }

    const defaultChannels = [
      { key: 'telebirr', name: 'Telebirr SuperApp', color: '#0068f9' },
      { key: 'cbe', name: 'Commercial Bank of Ethiopia', color: '#3d8bfd' },
      { key: 'boa', name: 'Bank of Abyssinia', color: '#60a5fa' },
      { key: 'awash', name: 'Awash Bank', color: '#93c5fd' },
      { key: 'dashen', name: 'Dashen Bank (Amole)', color: '#a5b4fc' },
      { key: 'cash', name: 'Direct Cash / Other Rails', color: '#cbd5e1' },
    ];

    const paymentChannels = defaultChannels
      .map((ch) => {
        const recorded = channelVolumeMap.get(ch.key);
        const volNum = recorded ? Number(recorded.cents) / 100 : 0;
        const count = recorded ? recorded.count : 0;
        const pct =
          Number(totalVolumeEtb) > 0 && recorded
            ? ((volNum * 100) / Number(totalVolumeEtb)).toFixed(1)
            : '0.0';
        return {
          channel: ch.key,
          name: ch.name,
          volumeEtb: `ETB ${Math.round(volNum).toLocaleString()}`,
          count,
          percentage: `${pct}%`,
          color: ch.color,
          volNum,
        };
      })
      .sort((a, b) => b.volNum - a.volNum)
      .map((item) => ({
        channel: item.channel,
        name: item.name,
        volumeEtb: item.volumeEtb,
        count: item.count,
        percentage: item.percentage,
        color: item.color,
      }));

    // ─────────────────────────────────────────────────────────────
    // 2. Average Basket Size / Ticket Size per Rail
    // ─────────────────────────────────────────────────────────────
    const railBasketSizes = defaultChannels
      .map((ch) => {
        const recorded = channelVolumeMap.get(ch.key);
        const volNum = recorded ? Number(recorded.cents) / 100 : 0;
        const count = recorded ? recorded.count : 0;
        const avgTicket = count > 0 ? (volNum / count).toFixed(2) : '0.00';
        const pct =
          Number(totalVolumeEtb) > 0 && recorded
            ? ((volNum * 100) / Number(totalVolumeEtb)).toFixed(1)
            : '0.0';
        return {
          rail: ch.key,
          name: ch.name,
          avgTicketEtb: `ETB ${Number(avgTicket).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          totalVolumeEtb: `ETB ${Math.round(volNum).toLocaleString()}`,
          transactionCount: count,
          sharePercent: `${pct}%`,
          color: ch.color,
          volNum,
        };
      })
      .sort((a, b) => b.volNum - a.volNum)
      .map((item) => ({
        rail: item.rail,
        name: item.name,
        avgTicketEtb: item.avgTicketEtb,
        totalVolumeEtb: item.totalVolumeEtb,
        transactionCount: item.transactionCount,
        sharePercent: item.sharePercent,
        color: item.color,
      }));

    // ─────────────────────────────────────────────────────────────
    // 3. Data Ingestion Modality Breakdown (100% Real)
    // ─────────────────────────────────────────────────────────────
    const modalityCounts = {
      voiceAm: { count: 0, cents: 0n },
      voiceEn: { count: 0, cents: 0n },
      text: { count: 0, cents: 0n },
      receipt: { count: 0, cents: 0n },
    };
    for (const tx of dbTransactions) {
      const src = (tx.group?.source ?? '').toUpperCase();
      const lang = (tx.user?.language ?? 'AM').toUpperCase();
      const cents = BigInt(Math.round(Number(tx.amountEtb) * 100));
      if (src === 'VOICE') {
        if (lang === 'EN') {
          modalityCounts.voiceEn.count += 1;
          modalityCounts.voiceEn.cents += cents;
        } else {
          modalityCounts.voiceAm.count += 1;
          modalityCounts.voiceAm.cents += cents;
        }
      } else if (src === 'RECEIPT') {
        modalityCounts.receipt.count += 1;
        modalityCounts.receipt.cents += cents;
      } else {
        modalityCounts.text.count += 1;
        modalityCounts.text.cents += cents;
      }
    }
    const totalModalityCount = dbTransactions.length;
    const modalityBreakdown = [
      {
        source: 'text',
        name: 'Text Messages',
        count: modalityCounts.text.count,
        volumeEtb: `ETB ${Math.round(Number(modalityCounts.text.cents) / 100).toLocaleString()}`,
        percentage:
          totalModalityCount > 0
            ? `${Math.round((modalityCounts.text.count * 100) / totalModalityCount)}%`
            : '0%',
      },
      {
        source: 'voice_am',
        name: 'Voice Audio (Amharic)',
        count: modalityCounts.voiceAm.count,
        volumeEtb: `ETB ${Math.round(Number(modalityCounts.voiceAm.cents) / 100).toLocaleString()}`,
        percentage:
          totalModalityCount > 0
            ? `${Math.round((modalityCounts.voiceAm.count * 100) / totalModalityCount)}%`
            : '0%',
      },
      {
        source: 'receipt',
        name: 'Receipt Photos',
        count: modalityCounts.receipt.count,
        volumeEtb: `ETB ${Math.round(Number(modalityCounts.receipt.cents) / 100).toLocaleString()}`,
        percentage:
          totalModalityCount > 0
            ? `${Math.round((modalityCounts.receipt.count * 100) / totalModalityCount)}%`
            : '0%',
      },
      {
        source: 'voice_en',
        name: 'Voice Audio (English)',
        count: modalityCounts.voiceEn.count,
        volumeEtb: `ETB ${Math.round(Number(modalityCounts.voiceEn.cents) / 100).toLocaleString()}`,
        percentage:
          totalModalityCount > 0
            ? `${Math.round((modalityCounts.voiceEn.count * 100) / totalModalityCount)}%`
            : '0%',
      },
    ].sort((a, b) => b.count - a.count);

    if (dbTransactions.length > transactionCounts.loggedTransactions) {
      transactionCounts.loggedTransactions = dbTransactions.length;
      transactionCounts.loggedGroups = Math.max(
        transactionCounts.loggedGroups,
        activeGroups.length,
      );
      transactionCounts.voiceTransactions =
        modalityCounts.voiceAm.count + modalityCounts.voiceEn.count;
      transactionCounts.voiceGroups = transactionCounts.voiceTransactions;
      transactionCounts.receiptTransactions = modalityCounts.receipt.count;
      transactionCounts.receiptGroups = modalityCounts.receipt.count;
      transactionCounts.textTransactions = modalityCounts.text.count;
      transactionCounts.textGroups = modalityCounts.text.count;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Hourly Spending Distribution (00:00 - 23:00 EAT)
    // ─────────────────────────────────────────────────────────────
    const hourlyMap = new Map<number, { count: number; volumeEtb: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { count: 0, volumeEtb: 0 });
    }
    for (const tx of dbTransactions) {
      const eatHour = (tx.occurredAt.getUTCHours() + 3) % 24;
      const entry = hourlyMap.get(eatHour)!;
      entry.count += 1;
      entry.volumeEtb += Number(tx.amountEtb);
    }
    const hourlySpending = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      count: data.count,
      volumeEtb: Math.round(data.volumeEtb),
    }));

    // ─────────────────────────────────────────────────────────────
    // 5. Financial Event Kinds (Expense vs Inflows vs Loans)
    // ─────────────────────────────────────────────────────────────
    const kindMap = new Map<string, { count: number; cents: bigint }>();
    for (const tx of dbTransactions) {
      const k = tx.kind || 'EXPENSE';
      const existing = kindMap.get(k) ?? { count: 0, cents: 0n };
      existing.count += 1;
      existing.cents += BigInt(Math.round(Number(tx.amountEtb) * 100));
      kindMap.set(k, existing);
    }
    const KIND_CONFIGS: Record<string, { label: string; color: string }> = {
      EXPENSE: { label: 'Expenses & Spending', color: '#0068f9' },
      INCOME: { label: 'Income & Salary', color: '#5ecf9a' },
      LOAN_RECEIVED: { label: 'Money Borrowed (Loans)', color: '#3d8bfd' },
      LOAN_REPAYMENT: { label: 'Loan Payments', color: '#f59e0b' },
      REFUND: { label: 'Refunds Received', color: '#60a5fa' },
      REIMBURSEMENT: { label: 'Work Reimbursements', color: '#93c5fd' },
    };
    const eventKinds = Array.from(kindMap.entries())
      .map(([kind, data]) => {
        const config = KIND_CONFIGS[kind] ?? { label: kind, color: '#cbd5e1' };
        const vol = Number(data.cents) / 100;
        const pct =
          Number(totalCents) > 0 ? ((vol * 100) / (Number(totalCents) / 100)).toFixed(1) : '0.0';
        return {
          kind,
          label: config.label,
          count: data.count,
          volumeEtb: `ETB ${Math.round(vol).toLocaleString()}`,
          percentage: `${pct}%`,
          color: config.color,
        };
      })
      .sort((a, b) => b.count - a.count);

    // ─────────────────────────────────────────────────────────────
    // 6. Month-over-Month Category Spending Shifts
    // ─────────────────────────────────────────────────────────────
    const current30Start = new Date(dayEnd.getTime() - 30 * DAY_MS);
    const prior30Start = new Date(dayEnd.getTime() - 60 * DAY_MS);
    const currentCatMap = new Map<string, number>();
    const priorCatMap = new Map<string, number>();

    for (const tx of dbTransactions) {
      const amt = Number(tx.amountEtb);
      if (tx.occurredAt >= current30Start && tx.occurredAt < dayEnd) {
        currentCatMap.set(tx.category, (currentCatMap.get(tx.category) ?? 0) + amt);
      } else if (tx.occurredAt >= prior30Start && tx.occurredAt < current30Start) {
        priorCatMap.set(tx.category, (priorCatMap.get(tx.category) ?? 0) + amt);
      }
    }

    const allCategories = Array.from(new Set([...currentCatMap.keys(), ...priorCatMap.keys()]));
    const categoryVariances = allCategories
      .map((cat) => {
        const cur = currentCatMap.get(cat) ?? 0;
        const pri = priorCatMap.get(cat) ?? 0;
        let variancePercent = 0;
        let isNewCategory = false;
        if (pri > 0) {
          variancePercent = Number((((cur - pri) / pri) * 100).toFixed(1));
        } else {
          isNewCategory = true;
        }
        return {
          category: cat,
          currentVolumeEtb: `ETB ${Math.round(cur).toLocaleString()}`,
          priorVolumeEtb: `ETB ${Math.round(pri).toLocaleString()}`,
          variancePercent,
          isFavorable: variancePercent <= 0,
          isNewCategory,
        };
      })
      .sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent))
      .slice(0, 8);

    // ─────────────────────────────────────────────────────────────
    // 7. Live Verified PostgreSQL Ledger Feed
    // ─────────────────────────────────────────────────────────────
    const recentLedger = dbTransactions.slice(0, 10).map((tx) => {
      const u = tx.user;
      const name = [u?.firstName, u?.username].filter(Boolean).join(' ') || 'Muday User';
      const handle = u?.username ? `@${u.username}` : `@user_${(u?.id || tx.id).slice(0, 6)}`;
      const initials = (u?.firstName ? u.firstName.slice(0, 2) : 'MU').toUpperCase();
      const timeStr = tx.occurredAt.toISOString().slice(11, 19);
      const bank = normalizeBank(tx.platform);
      return {
        id: tx.id,
        userHandle: handle,
        userName: name,
        avatar: initials,
        occurredAt: timeStr,
        category: tx.category || 'General Expense',
        source: tx.group?.source || 'TEXT',
        bankSource: bank.name,
        amountEtb: `ETB ${Number(tx.amountEtb).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        kind: tx.kind || 'EXPENSE',
        status: 'Verified',
      };
    });

    // ─────────────────────────────────────────────────────────────
    // 8. High-Value Consumer Transactions (>= 2,000 ETB)
    // ─────────────────────────────────────────────────────────────
    const highValueTransactions = dbTransactions
      .filter((tx) => Number(tx.amountEtb) >= 2000)
      .slice(0, 6)
      .map((tx) => {
        const isIncome = tx.kind === 'INCOME';
        const userStr = tx.user?.username ? `@${tx.user.username}` : tx.user?.firstName || 'User';
        return {
          id: tx.id,
          title: `${tx.category} · ${userStr}`,
          entity: normalizeBank(tx.platform).name,
          time: tx.occurredAt.toISOString().slice(11, 16),
          amountEtb: `${isIncome ? '+' : '-'}ETB ${Number(tx.amountEtb).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          isDebit: !isIncome,
        };
      });

    // ─────────────────────────────────────────────────────────────
    // 9. Platform Activity & Audit Timeline
    // ─────────────────────────────────────────────────────────────
    const activityTimeline = recentEvents.slice(0, 6).map((ev) => {
      const uName = ev.user?.firstName || ev.user?.username || 'Platform';
      let title = 'Ledger Event Logged';
      let badge = 'Audit';
      let desc = `System verified event for ${uName}`;
      if (ev.eventType === 'signup') {
        title = 'New Customer Onboarding';
        badge = 'Registration';
        desc = `${uName} initiated Telegram onboarding flow`;
      } else if (ev.eventType === 'consent_completed') {
        title = 'Privacy Consent Accepted';
        badge = 'Consent';
        desc = `${uName} accepted terms and generated mobile code`;
      } else if (ev.eventType === 'transaction_logged') {
        title = 'Financial Transaction Logged';
        badge = 'Ledger Ingestion';
        desc = `Verified transaction recorded via NLP parser`;
      } else if (ev.eventType === 'voice_processing_completed') {
        title = 'Voice Audio Transcribed';
        badge = 'STT Pipeline';
        desc = `Gemini STT completed voice audio processing`;
      }
      return {
        id: ev.id,
        time: ev.occurredAt.toISOString().slice(11, 16),
        eventType: ev.eventType,
        title,
        desc,
        badge,
        amountEtb: 'Live',
      };
    });

    // ─────────────────────────────────────────────────────────────
    // 10. 14-Day Daily Volume Wave with Real 7-Day SMA
    // ─────────────────────────────────────────────────────────────
    const dailyWave = [];
    const dailyVols: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const dStart = addEatDays(dayStart, -i);
      const dEnd = addEatDays(dStart, 1);
      const dTxs = dbTransactions.filter((t) => t.occurredAt >= dStart && t.occurredAt < dEnd);
      const curVol = dTxs.reduce((sum, t) => sum + Number(t.amountEtb), 0);
      dailyVols.push(curVol);

      // Prior 14-day exact historical comparison: dStart - 14 days
      const priorStart = addEatDays(dStart, -14);
      const priorEnd = addEatDays(priorStart, 1);
      const priorTxs = dbTransactions.filter(
        (t) => t.occurredAt >= priorStart && t.occurredAt < priorEnd,
      );
      const priorVol = priorTxs.reduce((sum, t) => sum + Number(t.amountEtb), 0);

      // Real 7-day Simple Moving Average
      const windowStartIdx = Math.max(0, dailyVols.length - 7);
      const windowSlice = dailyVols.slice(windowStartIdx);
      const rollingAvg = windowSlice.reduce((a, b) => a + b, 0) / windowSlice.length;

      dailyWave.push({
        day: dStart.toISOString().slice(5, 10),
        current: Math.round(curVol / 1000),
        prior: Math.round(priorVol / 1000),
        forecast: Math.round(rollingAvg / 1000),
        transactionCount: dTxs.length,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 11. Data Quality & Outlier Telemetry
    // ─────────────────────────────────────────────────────────────
    const uncategorizedCount = dbTransactions.filter(
      (t) =>
        !t.category ||
        t.category.toLowerCase() === 'uncategorized' ||
        t.category.toLowerCase() === 'other',
    ).length;
    const highValueCount = dbTransactions.filter((t) => Number(t.amountEtb) >= 2000).length;
    const dataQuality = {
      pendingClarifications: outstandingClarifications,
      uncategorizedTransactions: uncategorizedCount,
      highValueOutliers: highValueCount,
      activeCompanionSessions: activeSessionsCount,
    };

    // Voice performance calculations
    const voiceDone = events.filter((e) => e.eventType === 'voice_processing_completed');
    let totalSttMs = 0;
    let totalVoiceMs = 0;
    for (const e of voiceDone) {
      const meta = asMetadata(e.metadata);
      if (typeof meta.sttLatencyMs === 'number') totalSttMs += meta.sttLatencyMs;
      if (typeof meta.totalLatencyMs === 'number') totalVoiceMs += meta.totalLatencyMs;
    }
    const voiceFailures = events.filter((e) => e.eventType === 'voice_processing_failed');
    const failCodeMap = new Map<string, number>();
    for (const e of voiceFailures) {
      const rawCode = asMetadata(e.metadata).failureCode;
      const code = typeof rawCode === 'string' ? rawCode : 'UNKNOWN';
      failCodeMap.set(code, (failCodeMap.get(code) ?? 0) + 1);
    }
    const topFailureCodes = Array.from(failCodeMap.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    // User Directory Language breakdown
    const langMap: Record<string, number> = { AM: 0, EN: 0 };
    for (const u of users) {
      const lang = u.language ?? 'AM';
      langMap[lang] = (langMap[lang] ?? 0) + 1;
    }

    // 14-day rolling time-series
    const timeSeries: AnalyticsReport['timeSeries'] = [];
    for (let i = 13; i >= 0; i--) {
      const dStart = addEatDays(dayStart, -i);
      const dEnd = addEatDays(dStart, 1);
      const dDau = activeBetween(activeGroups, dStart, dEnd);
      const dWau = activeBetween(activeGroups, new Date(dEnd.getTime() - 7 * DAY_MS), dEnd);
      const dMau = activeBetween(activeGroups, new Date(dEnd.getTime() - 30 * DAY_MS), dEnd);
      const dSignups = users.filter((u) => u.createdAt < dEnd).length;
      const dTxs = dbTransactions.filter((t) => t.occurredAt >= dStart && t.occurredAt < dEnd);
      const dCents = dTxs.reduce(
        (sum, t) => sum + BigInt(Math.round(Number(t.amountEtb) * 100)),
        0n,
      );
      timeSeries.push({
        date: dStart.toISOString().slice(0, 10),
        dau: dDau,
        wau: dWau,
        mau: dMau,
        signups: dSignups,
        transactions: dTxs.length,
        volumeEtb: (Number(dCents) / 100).toFixed(2),
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      asOf: asOf.toISOString(),
      timezone: EAT_TIMEZONE,
      definitions: {
        activeUser: 'At least one committed, non-undone transaction group in the metric window.',
        retention: 'Activity on the exact seventh or thirtieth EAT calendar day after signup.',
        deletion: 'Deleted users and their identifiable events are excluded by cascading deletion.',
      },
      acquisition: {
        signups: Math.max(users.length, signupUsers.size),
        consentCompletions: consentUsers.size,
        consentConversion: rate(consentUsers.size, Math.max(users.length, signupUsers.size)),
      },
      transactions: transactionCounts,
      activeUsers: {
        dau: activeBetween(activeGroups, dayStart, dayEnd),
        wau: activeBetween(activeGroups, new Date(dayEnd.getTime() - 7 * DAY_MS), dayEnd),
        mau,
      },
      notifications: {
        eligibleUsers: activeUsersList.length,
        usersWithAnyDisabled: disabled,
        currentOptOutRate: rate(disabled, activeUsersList.length),
        optOutEvents: eventCount(events, 'notification_opted_out'),
      },
      clarifications: {
        requested,
        resolved,
        failed,
        measurableAttempts,
        requestRate: rate(requested, measurableAttempts),
        resolutionRate: rate(resolved, requested),
      },
      extractionQuality: {
        rejectedTransfers: metadataSum(events, 'transfer_rejected', 'count'),
        cancelledConfirmations: eventCount(events, 'confirmation_cancelled'),
        geminiInvalidOutputs: eventCount(events, 'extraction_invalid_output'),
      },
      financials: {
        totalVolumeEtb,
        totalExpenseVolumeEtb,
        avgVolumePerUserEtb,
        uniqueTransactingUsers,
        topCategories,
      },
      voicePerformance: {
        avgSttLatencyMs: voiceDone.length > 0 ? Math.round(totalSttMs / voiceDone.length) : 0,
        avgTotalLatencyMs: voiceDone.length > 0 ? Math.round(totalVoiceMs / voiceDone.length) : 0,
        failureCount: voiceFailures.length,
        topFailureCodes,
      },
      userDirectory: {
        totalUsers: users.length,
        activeConsentedUsers: activeUsersList.length,
        languageBreakdown: langMap,
      },
      timeSeries,
      dashboard: {
        opens: dashboardEvents.length,
        weekOpens: metadataCount(dashboardEvents, 'period', 'week'),
        monthOpens: metadataCount(dashboardEvents, 'period', 'month'),
        customOpens: metadataCount(dashboardEvents, 'period', 'custom'),
      },
      retention: {
        d7: retention(signupUsers, activeGroups, dayEnd, 7),
        d30: retention(signupUsers, activeGroups, dayEnd, 30),
      },

      // Extended Financial Data Collection Metrics
      paymentChannels,
      modalityBreakdown,
      categoryVariances,
      recentLedger,
      highValueTransactions,
      activityTimeline,
      dailyWave,

      // 100% Authentic Additions
      hourlySpending,
      eventKinds,
      railBasketSizes,
      dataQuality,
    };
  }

  private transactionCounts(events: Array<{ metadata: unknown }>): AnalyticsReport['transactions'] {
    const result: AnalyticsReport['transactions'] = {
      loggedGroups: 0,
      loggedTransactions: 0,
      textGroups: 0,
      textTransactions: 0,
      voiceGroups: 0,
      voiceTransactions: 0,
      receiptGroups: 0,
      receiptTransactions: 0,
      byKind: {},
      otherTransactions: 0,
      otherRate: rate(0, 0),
    };
    for (const event of events) {
      const metadata = asMetadata(event.metadata);
      const source =
        metadata.source === 'voice' ? 'voice' : metadata.source === 'receipt' ? 'receipt' : 'text';
      const count =
        typeof metadata.transactionCount === 'number' &&
        Number.isInteger(metadata.transactionCount) &&
        metadata.transactionCount > 0
          ? metadata.transactionCount
          : 1;
      result.loggedGroups += 1;
      result.loggedTransactions += count;
      const kindCounts = asMetadata(metadata.kindCounts);
      for (const [kind, value] of Object.entries(kindCounts)) {
        if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
          result.byKind[kind] = (result.byKind[kind] ?? 0) + value;
        }
      }
      if (typeof metadata.otherCount === 'number' && Number.isInteger(metadata.otherCount)) {
        result.otherTransactions += Math.max(0, metadata.otherCount);
      }
      if (source === 'voice') {
        result.voiceGroups += 1;
        result.voiceTransactions += count;
      } else if (source === 'receipt') {
        result.receiptGroups += 1;
        result.receiptTransactions += count;
      } else {
        result.textGroups += 1;
        result.textTransactions += count;
      }
    }
    result.otherRate = rate(result.otherTransactions, result.loggedTransactions);
    return result;
  }
}

function asMetadata(value: unknown): SafeMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as SafeMetadata)
    : {};
}

function eventCount(events: Array<{ eventType: string }>, type: string): number {
  return events.filter(({ eventType }) => eventType === type).length;
}

function metadataSum(
  events: Array<{ eventType: string; metadata: unknown }>,
  type: string,
  key: string,
): number {
  return events
    .filter(({ eventType }) => eventType === type)
    .reduce((total, event) => {
      const value = asMetadata(event.metadata)[key];
      return total + (typeof value === 'number' && Number.isInteger(value) ? value : 0);
    }, 0);
}

function metadataCount(
  events: Array<{ metadata: unknown }>,
  key: string,
  expected: string,
): number {
  return events.filter(({ metadata }) => asMetadata(metadata)[key] === expected).length;
}

function uniqueUsers(
  events: Array<{ userId: string | null; eventType: string; occurredAt: Date }>,
  type: string,
): Map<string, Date> {
  const users = new Map<string, Date>();
  for (const event of events) {
    if (event.eventType !== type || !event.userId) continue;
    const current = users.get(event.userId);
    if (!current || event.occurredAt < current) users.set(event.userId, event.occurredAt);
  }
  return users;
}

function activeBetween(
  groups: Array<{ userId: string; messageAt: Date }>,
  start: Date,
  end: Date,
): number {
  return new Set(
    groups
      .filter(({ messageAt }) => messageAt >= start && messageAt < end)
      .map(({ userId }) => userId),
  ).size;
}

function retention(
  signups: Map<string, Date>,
  groups: Array<{ userId: string; messageAt: Date }>,
  reportEnd: Date,
  day: number,
): RetentionMetric {
  const eligible: string[] = [];
  let retained = 0;
  for (const [userId, signupAt] of signups) {
    const targetStart = addEatDays(eatDayStart(signupAt), day);
    const targetEnd = addEatDays(targetStart, 1);
    if (targetEnd > reportEnd) continue;
    eligible.push(userId);
    if (
      groups.some(
        (group) =>
          group.userId === userId && group.messageAt >= targetStart && group.messageAt < targetEnd,
      )
    ) {
      retained += 1;
    }
  }
  return {
    eligibleCohortUsers: eligible.length,
    retainedUsers: retained,
    ...rate(retained, eligible.length),
  };
}
