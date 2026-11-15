import { Inject, Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { copyFile, rename, unlink } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import {
  FinancialEventKind,
  InteractionKind,
  InteractionState,
  Prisma,
  TransactionSource,
  TransactionType,
} from '../generated/prisma/client.js';

interface PendingInteractionClarifyPayload {
  amount?: number | string;
  occurredAt?: string;
  messageAt?: string;
  type?: string;
  category?: string;
  note?: string | null;
  rawSms?: string | null;
  rawText?: string | null;
  bankSource?: string | null;
  bank?: string | null;
  smsId?: string | number;
  direction?: string;
  merchant?: string;
  event?: {
    amount?: number | string;
    type?: string;
    note?: string | null;
  };
  readyTransactions?: Array<{
    amount?: number | string;
    type?: string;
    note?: string | null;
  }>;
  transactions?: Array<{
    amount?: number | string;
    type?: string;
    note?: string | null;
  }>;
}

import { PrismaService } from '../database/prisma.service.js';
import type { DateRange } from '../summaries/summary-period.js';
import type { UpdateMiniAppTransactionDto } from './dashboard.dto.js';

@Injectable()
export class DashboardRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listRecent(
    userId: string,
    range: DateRange,
    limit = 20,
    cursor?: string,
    filters?: { category?: string; source?: 'text' | 'voice' | 'receipt'; search?: string },
  ) {
    const cursorDate = cursor && !isNaN(Date.parse(cursor)) ? new Date(cursor) : null;
    const maxDate = cursorDate && cursorDate < range.end ? cursorDate : range.end;

    const where: Prisma.TransactionWhereInput = {
      userId,
      occurredAt: { gte: range.start, lt: maxDate },
      group: { undoneAt: null },
    };

    if (filters?.category) {
      where.category = filters.category.toLowerCase();
    }
    if (filters?.source) {
      const srcUpper = filters.source.toUpperCase();
      if (srcUpper in TransactionSource) {
        where.group = {
          undoneAt: null,
          source: srcUpper as TransactionSource,
        };
      }
    }
    if (filters?.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { note: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } },
      ];
    }

    const shouldIncludePending =
      !filters?.category ||
      filters.category.toLowerCase() === 'uncategorized' ||
      filters.category.toLowerCase() === 'pending';

    const [txRows, pendingRows] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        select: {
          id: true,
          kind: true,
          type: true,
          amountEtb: true,
          category: true,
          note: true,
          platform: true,
          occurredAt: true,
          group: {
            select: {
              source: true,
              rawTranscript: true,
              receiptImagePath: true,
            },
          },
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      shouldIncludePending
        ? this.prisma.pendingInteraction.findMany({
            where: {
              userId,
              kind: InteractionKind.CLARIFY_FINANCIAL,
              state: InteractionState.PENDING,
            },
            select: {
              id: true,
              payload: true,
              createdAt: true,
            },
          })
        : [],
    ]);

    const pendingMapped = pendingRows
      .map((p) => {
        const payload = (p.payload as unknown as PendingInteractionClarifyPayload | null) ?? {};
        const amountVal =
          payload.amount ?? payload.event?.amount ?? payload.readyTransactions?.[0]?.amount ?? '0';
        const occurredAt = payload.occurredAt
          ? new Date(payload.occurredAt)
          : payload.messageAt
            ? new Date(payload.messageAt)
            : p.createdAt;
        const isIncome = payload.type === 'income';
        const note: string | null =
          payload.note ||
          payload.event?.note ||
          payload.readyTransactions?.[0]?.note ||
          (payload.bankSource ? `From ${payload.bankSource} SMS` : 'Bank SMS');

        return {
          id: p.id,
          kind: isIncome ? FinancialEventKind.INCOME : FinancialEventKind.EXPENSE,
          type: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
          amountEtb: new Prisma.Decimal(Number(amountVal).toFixed(2)),
          category: 'uncategorized',
          note,
          platform: payload.bankSource ? payload.bankSource.toLowerCase() : null,
          occurredAt,
          group: {
            source: TransactionSource.TEXT,
            rawTranscript: payload.rawSms ?? payload.rawText ?? null,
            receiptImagePath: null,
          },
        };
      })
      .filter((p) => {
        if (filters?.search?.trim()) {
          const term = filters.search.trim().toLowerCase();
          const noteMatch = p.note?.toLowerCase().includes(term);
          const catMatch = p.category.toLowerCase().includes(term);
          if (!noteMatch && !catMatch) return false;
        }
        if (p.occurredAt < range.start || p.occurredAt >= maxDate) {
          return false;
        }
        return true;
      });

    const combined = [...txRows, ...pendingMapped];
    combined.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return combined.slice(0, limit + 1);
  }

  async countInPeriod(userId: string, range: DateRange) {
    const [rows, pendingDrafts] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          occurredAt: { gte: range.start, lt: range.end },
          group: { undoneAt: null },
        },
        select: {
          category: true,
          note: true,
          platform: true,
        },
      }),
      this.prisma.pendingInteraction.findMany({
        where: {
          userId,
          kind: InteractionKind.CLARIFY_FINANCIAL,
          state: InteractionState.PENDING,
        },
        select: {
          payload: true,
        },
      }),
    ]);

    let uncategorizedCount = 0;
    const bankCounts: Record<string, number> = {
      telebirr: 0,
      cbe: 0,
      abyssinia: 0,
      awash: 0,
      dashen: 0,
      coop: 0,
      wegagen: 0,
      hibret: 0,
      zemen: 0,
    };

    const BANK_KEYWORDS: Record<string, string[]> = {
      telebirr: ['telebirr', 'tele birr', 'ethio telecom'],
      cbe: ['cbe', 'commercial bank of ethiopia', 'commercial bank', 'cbebirr', 'cbe_birr'],
      abyssinia: ['abyssinia', 'boa', 'bank of abyssinia'],
      awash: ['awash', 'awash bank', 'awash international'],
      dashen: ['dashen', 'dashen bank', 'amole'],
      coop: ['cooperative bank', 'coop bank', 'oromia', 'coopay'],
      wegagen: ['wegagen', 'wegagen bank'],
      hibret: ['hibret', 'hibret bank', 'united bank'],
      zemen: ['zemen', 'zemen bank'],
    };

    for (const row of rows) {
      const cat = (row.category ?? '').toLowerCase().trim();
      if (cat === 'uncategorized' || cat === 'pending' || cat === '') {
        uncategorizedCount++;
      }

      let matchedBank = false;
      if (row.platform) {
        const pKey = row.platform.toLowerCase();
        const normalized = pKey === 'boa' ? 'abyssinia' : pKey === 'cbe_birr' ? 'cbe' : pKey;
        if (normalized in bankCounts) {
          bankCounts[normalized] = (bankCounts[normalized] || 0) + 1;
          matchedBank = true;
        }
      }

      if (!matchedBank && row.note) {
        const lowerNote = row.note.toLowerCase();
        for (const [bankId, keywords] of Object.entries(BANK_KEYWORDS)) {
          if (keywords.some((kw) => lowerNote.includes(kw))) {
            bankCounts[bankId] = (bankCounts[bankId] || 0) + 1;
            break;
          }
        }
      }
    }

    for (const draft of pendingDrafts) {
      uncategorizedCount++;
      const payload = (draft.payload as unknown as PendingInteractionClarifyPayload | null) ?? {};
      const bankSource = String(payload.bankSource || '').toLowerCase();
      const note = String(payload.note || payload.event?.note || '').toLowerCase();

      for (const [bankId, keywords] of Object.entries(BANK_KEYWORDS)) {
        if (
          bankSource.includes(bankId) ||
          keywords.some((kw) => note.includes(kw) || bankSource.includes(kw))
        ) {
          bankCounts[bankId] = (bankCounts[bankId] || 0) + 1;
          break;
        }
      }
    }

    return {
      totalCount: rows.length + pendingDrafts.length,
      uncategorizedCount,
      bankCounts,
    };
  }

  async getBankBreakdown(userId: string, range: DateRange) {
    const [rows, pendingInteractions] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          occurredAt: { gte: range.start, lt: range.end },
          group: { undoneAt: null },
        },
        select: {
          amountEtb: true,
          note: true,
        },
      }),
      this.prisma.pendingInteraction.findMany({
        where: {
          userId,
          kind: InteractionKind.CLARIFY_FINANCIAL,
          state: InteractionState.PENDING,
        },
        select: {
          payload: true,
          createdAt: true,
        },
      }),
    ]);

    const pendingDrafts = pendingInteractions
      .map((p) => {
        const payload = (p.payload as unknown as PendingInteractionClarifyPayload | null) ?? {};
        const amount =
          Number(
            payload.amount ??
              payload.event?.amount ??
              payload.readyTransactions?.[0]?.amount ??
              '0',
          ) || 0;
        const note = payload.note ?? payload.rawSms ?? payload.rawText ?? payload.event?.note ?? '';
        const occurredAt = payload.occurredAt
          ? new Date(payload.occurredAt)
          : payload.messageAt
            ? new Date(payload.messageAt)
            : p.createdAt;
        return { amountEtb: amount, note, occurredAt };
      })
      .filter((p) => p.occurredAt >= range.start && p.occurredAt < range.end);

    const allItems: Array<{ amountEtb: number; note: string | null }> = [
      ...rows.map((r) => ({
        amountEtb: Number(r.amountEtb.toString()) || 0,
        note: r.note,
      })),
      ...pendingDrafts.map((d) => ({
        amountEtb: d.amountEtb,
        note: d.note,
      })),
    ];

    const BANK_DEFINITIONS: Record<
      string,
      { name: string; nameAm: string; emoji: string; keywords: string[] }
    > = {
      telebirr: {
        name: 'Telebirr',
        nameAm: 'ቴሌብር',
        emoji: '📱',
        keywords: ['telebirr', 'tele birr', 'ethio telecom'],
      },
      cbe: {
        name: 'Commercial Bank of Ethiopia (CBE)',
        nameAm: 'የኢትዮጵያ ንግድ ባንክ (CBE)',
        emoji: '🏦',
        keywords: ['cbe', 'commercial bank of ethiopia', 'commercial bank', 'cbebirr'],
      },
      abyssinia: {
        name: 'Bank of Abyssinia',
        nameAm: 'አቢሲኒያ ባንክ',
        emoji: '🏦',
        keywords: ['abyssinia', 'boa', 'bank of abyssinia'],
      },
      awash: {
        name: 'Awash Bank',
        nameAm: 'አዋሽ ባንክ',
        emoji: '🏦',
        keywords: ['awash', 'awash bank', 'awash international'],
      },
      dashen: {
        name: 'Dashen Bank',
        nameAm: 'ዳሸን ባንክ',
        emoji: '🏦',
        keywords: ['dashen', 'dashen bank', 'amole'],
      },
      coop: {
        name: 'Cooperative Bank of Oromia',
        nameAm: 'ኦሮሚያ ኅብረት ሥራ ባንክ',
        emoji: '🏦',
        keywords: ['cooperative bank', 'coop bank', 'oromia', 'coopay'],
      },
      wegagen: {
        name: 'Wegagen Bank',
        nameAm: 'ወጋገን ባንክ',
        emoji: '🏦',
        keywords: ['wegagen', 'wegagen bank'],
      },
      hibret: {
        name: 'Hibret Bank',
        nameAm: 'ሕብረት ባንክ',
        emoji: '🏦',
        keywords: ['hibret', 'hibret bank', 'united bank'],
      },
      zemen: {
        name: 'Zemen Bank',
        nameAm: 'ዘመን ባንክ',
        emoji: '🏦',
        keywords: ['zemen', 'zemen bank'],
      },
    };

    const breakdown: Record<
      string,
      { name: string; nameAm: string; emoji: string; count: number; totalEtb: number }
    > = {};
    for (const [key, def] of Object.entries(BANK_DEFINITIONS)) {
      breakdown[key] = {
        name: def.name,
        nameAm: def.nameAm,
        emoji: def.emoji,
        count: 0,
        totalEtb: 0,
      };
    }

    let otherCount = 0;
    let otherTotalEtb = 0;

    for (const item of allItems) {
      const amount = item.amountEtb;
      let matchedBank = false;

      if (item.note) {
        const lower = item.note.toLowerCase();
        for (const [bankId, def] of Object.entries(BANK_DEFINITIONS)) {
          if (def.keywords.some((kw) => lower.includes(kw))) {
            const entry = breakdown[bankId];
            if (entry) {
              entry.count += 1;
              entry.totalEtb += amount;
            }
            matchedBank = true;
            break;
          }
        }
      }

      if (!matchedBank) {
        otherCount += 1;
        otherTotalEtb += amount;
      }
    }

    return {
      banks: Object.entries(breakdown)
        .filter(([, b]) => b.count > 0)
        .map(([id, b]) => ({ id, ...b })),
      other: { count: otherCount, totalEtb: otherTotalEtb },
      totalCount: allItems.length,
      totalEtb: allItems.reduce((sum, r) => sum + r.amountEtb, 0),
    };
  }

  async createTransaction(
    userId: string,
    dto: {
      type: 'expense' | 'income';
      amountEtb: string;
      category: string;
      note?: string;
      platform?: string;
      source?: 'text' | 'voice' | 'receipt';
      receiptTempId?: string;
    },
  ) {
    const amountNum = parseFloat(dto.amountEtb);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('invalid_amount');
    }

    const txType = dto.type === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE;
    const kind = dto.type === 'income' ? FinancialEventKind.INCOME : FinancialEventKind.EXPENSE;
    const src =
      dto.source === 'voice'
        ? TransactionSource.VOICE
        : dto.source === 'receipt'
          ? TransactionSource.RECEIPT
          : TransactionSource.TEXT;

    let receiptImagePath: string | null = null;
    const groupId = (await import('node:crypto')).randomUUID();

    if (dto.receiptTempId) {
      const mediaRoot = resolve('.local/media/receipts', userId);
      const tempPath = resolve(mediaRoot, dto.receiptTempId);
      if (existsSync(tempPath)) {
        const ext = extname(dto.receiptTempId) || '.jpg';
        const finalFilename = `${groupId}${ext}`;
        const finalPath = resolve(mediaRoot, finalFilename);
        try {
          await rename(tempPath, finalPath);
          receiptImagePath = `${userId}/${finalFilename}`;
        } catch {
          try {
            await copyFile(tempPath, finalPath);
            await unlink(tempPath).catch(() => undefined);
            receiptImagePath = `${userId}/${finalFilename}`;
          } catch {
            receiptImagePath = null;
          }
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const uniqueMsgId = BigInt(Date.now());

      const group = await tx.transactionGroup.create({
        data: {
          id: groupId,
          userId,
          telegramUpdateId: BigInt(0),
          telegramMessageId: uniqueMsgId,
          source: src,
          messageAt: new Date(),
          extractionModel: 'miniapp',
          promptVersion: 'v1',
          rawTranscript: dto.note || null,
          ...(receiptImagePath ? { receiptImagePath } : {}),
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          groupId: group.id,
          type: txType,
          kind,
          amountEtb: new Prisma.Decimal(amountNum.toFixed(2)),
          category: dto.category.toLowerCase().trim(),
          note: dto.note?.trim() || null,
          platform: dto.platform?.trim().toLowerCase() || null,
          occurredAt: new Date(),
        },
      });

      return {
        id: transaction.id,
        amountEtb: transaction.amountEtb.toFixed(2),
        category: transaction.category,
        type: dto.type,
        note: transaction.note,
        platform: transaction.platform,
        occurredAt: transaction.occurredAt.toISOString(),
      };
    });
  }

  async updateTransaction(userId: string, transactionId: string, dto: UpdateMiniAppTransactionDto) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId, group: { undoneAt: null } },
    });

    if (!existing) {
      const pending = await this.prisma.pendingInteraction.findFirst({
        where: { id: transactionId, userId, state: InteractionState.PENDING },
      });
      if (pending) {
        const payload =
          (pending.payload as unknown as PendingInteractionClarifyPayload | null) ?? {};
        const amountNum =
          dto.amountEtb !== undefined
            ? parseFloat(dto.amountEtb)
            : parseFloat(String(payload.amount || payload.event?.amount || '0'));
        const txType =
          dto.type === 'income' || payload.type === 'income'
            ? TransactionType.INCOME
            : TransactionType.EXPENSE;
        const kind =
          txType === TransactionType.INCOME
            ? FinancialEventKind.INCOME
            : FinancialEventKind.EXPENSE;
        const category = (dto.category ?? payload.category ?? 'other').trim().toLowerCase();
        const note = dto.note !== undefined ? dto.note?.trim() || null : payload.note || null;
        const platform =
          dto.platform !== undefined
            ? dto.platform
              ? dto.platform.trim().toLowerCase()
              : null
            : payload.bankSource?.toLowerCase() || null;
        const occurredAt = payload.occurredAt
          ? new Date(payload.occurredAt)
          : payload.messageAt
            ? new Date(payload.messageAt)
            : new Date();

        return this.prisma.$transaction(async (tx) => {
          await tx.pendingInteraction.update({
            where: { id: pending.id },
            data: {
              state: InteractionState.RESOLVED,
              resolvedAt: new Date(),
            },
          });

          const group = await tx.transactionGroup.create({
            data: {
              userId,
              telegramUpdateId: 0n,
              telegramMessageId: BigInt(Date.now()),
              source: TransactionSource.TEXT,
              messageAt: occurredAt,
              rawTranscript: payload.smsId
                ? `SMS:${payload.bankSource || 'BANK'}:${payload.smsId}`
                : `BANK_SMS:${payload.bankSource || 'BANK'}`,
              extractionModel: 'BANK_SMS_PARSER',
              promptVersion: '1.0',
            },
          });

          const createdTx = await tx.transaction.create({
            data: {
              userId,
              groupId: group.id,
              type: txType,
              kind,
              amountEtb: new Prisma.Decimal(amountNum.toFixed(2)),
              category,
              note,
              platform,
              occurredAt,
            },
          });

          return {
            id: createdTx.id,
            amountEtb: createdTx.amountEtb.toFixed(2),
            category: createdTx.category,
            type: createdTx.type === TransactionType.INCOME ? 'income' : 'expense',
            note: createdTx.note,
            platform: createdTx.platform,
            occurredAt: createdTx.occurredAt.toISOString(),
          };
        });
      }

      return null;
    }

    const data: Prisma.TransactionUpdateInput = {};
    if (dto.amountEtb !== undefined) {
      const amountNum = parseFloat(dto.amountEtb);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('invalid_amount');
      }
      data.amountEtb = new Prisma.Decimal(amountNum.toFixed(2));
    }
    if (dto.type !== undefined) {
      data.type = dto.type === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE;
      data.kind = dto.type === 'income' ? FinancialEventKind.INCOME : FinancialEventKind.EXPENSE;
    }
    if (dto.category !== undefined) {
      data.category = dto.category.trim().toLowerCase();
    }
    if (dto.note !== undefined) {
      data.note = dto.note ? dto.note.trim().slice(0, 500) : null;
    }
    if (dto.platform !== undefined) {
      data.platform = dto.platform ? dto.platform.trim().toLowerCase().slice(0, 50) : null;
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data,
      select: {
        id: true,
        kind: true,
        type: true,
        amountEtb: true,
        category: true,
        note: true,
        platform: true,
        occurredAt: true,
      },
    });

    return {
      id: updated.id,
      amountEtb: updated.amountEtb.toFixed(2),
      category: updated.category,
      type: updated.type === TransactionType.INCOME ? 'income' : 'expense',
      note: updated.note,
      platform: updated.platform,
      occurredAt: updated.occurredAt.toISOString(),
    };
  }

  async findMatchCandidates(
    userId: string,
    query: { amountEtb: string; type?: 'expense' | 'income'; occurredAt?: string },
  ) {
    const amountNum = parseFloat(query.amountEtb);
    if (isNaN(amountNum) || amountNum <= 0) {
      return [];
    }

    const referenceDate =
      query.occurredAt && !isNaN(Date.parse(query.occurredAt))
        ? new Date(query.occurredAt)
        : new Date();

    const minDate = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const maxDate = new Date(referenceDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const targetDecimal = new Prisma.Decimal(amountNum.toFixed(2));

    // 1. Search in Transaction ledger for uncategorized transactions
    const matchingTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        category: 'uncategorized',
        amountEtb: targetDecimal,
        occurredAt: { gte: minDate, lte: maxDate },
        group: { undoneAt: null },
      },
      select: {
        id: true,
        type: true,
        amountEtb: true,
        category: true,
        note: true,
        occurredAt: true,
        group: {
          select: {
            rawTranscript: true,
            source: true,
          },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: 5,
    });

    const candidates: Array<{
      id: string;
      targetType: 'transaction' | 'pending_interaction';
      amountEtb: string;
      type: 'expense' | 'income';
      category: string;
      note: string | null;
      bankSource: string;
      occurredAt: string;
      reference?: string;
    }> = [];

    for (const tx of matchingTransactions) {
      let bankSource = 'BANK';
      let reference: string | undefined;

      const raw = tx.group?.rawTranscript || '';
      if (raw.startsWith('SMS:') || raw.startsWith('BANK_SMS:')) {
        const parts = raw.split(':');
        bankSource = parts[1] || 'BANK';
        if (parts[2]) reference = parts[2];
      } else if (tx.note && /telebirr|cbe|abyssinia|awash|dashen|coop/i.test(tx.note)) {
        const match = tx.note.match(/telebirr|cbe|abyssinia|awash|dashen|coop/i);
        if (match) bankSource = match[0].toUpperCase();
      }

      candidates.push({
        id: tx.id,
        targetType: 'transaction',
        amountEtb: tx.amountEtb.toFixed(2),
        type: tx.type === TransactionType.INCOME ? 'income' : 'expense',
        category: tx.category,
        note: tx.note,
        bankSource,
        occurredAt: tx.occurredAt.toISOString(),
        ...(reference ? { reference } : {}),
      });
    }

    // 2. Search in pending interactions (unreviewed SMS drafts)
    const pendingInteractions = await this.prisma.pendingInteraction.findMany({
      where: {
        userId,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
        expiresAt: { gt: new Date() },
      },
      take: 20,
    });

    for (const pi of pendingInteractions) {
      const payload = (pi.payload as unknown as PendingInteractionClarifyPayload | null) ?? {};
      const rawAmount =
        payload.amount ??
        payload.event?.amount ??
        payload.readyTransactions?.[0]?.amount ??
        payload.transactions?.[0]?.amount;

      if (rawAmount !== undefined && rawAmount !== null) {
        const piAmount = parseFloat(String(rawAmount));
        if (!isNaN(piAmount) && Math.abs(piAmount - amountNum) < 0.01) {
          const rawType =
            payload.type ??
            payload.event?.type ??
            payload.readyTransactions?.[0]?.type ??
            payload.transactions?.[0]?.type;
          const piType: 'income' | 'expense' = rawType === 'income' ? 'income' : 'expense';

          const piDate =
            payload.occurredAt && !isNaN(Date.parse(payload.occurredAt))
              ? new Date(payload.occurredAt)
              : payload.messageAt && !isNaN(Date.parse(payload.messageAt))
                ? new Date(payload.messageAt)
                : pi.createdAt;

          const bank = payload.bankSource || 'BANK';
          const rawNote =
            payload.note ?? payload.event?.note ?? payload.readyTransactions?.[0]?.note ?? null;

          candidates.push({
            id: pi.id,
            targetType: 'pending_interaction',
            amountEtb: piAmount.toFixed(2),
            type: piType,
            category: payload.category || 'uncategorized',
            note: rawNote,
            bankSource: String(bank).toUpperCase(),
            occurredAt: piDate.toISOString(),
            ...(payload.smsId ? { reference: String(payload.smsId) } : {}),
          });
        }
      }
    }

    // Sort all candidates by closest timestamp
    candidates.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return candidates.slice(0, 5);
  }

  async linkCandidate(
    userId: string,
    dto: {
      targetId: string;
      targetType: 'transaction' | 'pending_interaction';
      category: string;
      note?: string;
      type?: 'expense' | 'income';
    },
  ) {
    const category = dto.category.trim().toLowerCase();
    const userNote = dto.note?.trim();

    if (dto.targetType === 'transaction') {
      const existing = await this.prisma.transaction.findFirst({
        where: { id: dto.targetId, userId, group: { undoneAt: null } },
      });

      if (!existing) {
        return null;
      }

      // Merge notes gracefully: keep original merchant/bank note if present
      let mergedNote = userNote || existing.note;
      if (userNote && existing.note && !existing.note.includes(userNote)) {
        mergedNote = `${existing.note} (${userNote})`;
      }

      const updated = await this.prisma.transaction.update({
        where: { id: existing.id },
        data: {
          category,
          note: mergedNote ? mergedNote.slice(0, 500) : null,
          ...(dto.type
            ? {
                type: dto.type === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE,
                kind:
                  dto.type === 'income' ? FinancialEventKind.INCOME : FinancialEventKind.EXPENSE,
              }
            : {}),
        },
      });

      return {
        id: updated.id,
        amountEtb: updated.amountEtb.toFixed(2),
        category: updated.category,
        type: updated.type === TransactionType.INCOME ? 'income' : 'expense',
        note: updated.note,
        platform: updated.platform,
        occurredAt: updated.occurredAt.toISOString(),
        linked: true,
      };
    }

    if (dto.targetType === 'pending_interaction') {
      const interaction = await this.prisma.pendingInteraction.findFirst({
        where: { id: dto.targetId, userId, state: InteractionState.PENDING },
      });

      if (!interaction) {
        return null;
      }

      const payload = (interaction.payload as unknown as PendingInteractionClarifyPayload) || {};
      const amountNum = parseFloat(String(payload.amount));
      const txType =
        dto.type === 'income' || payload.type === 'income'
          ? TransactionType.INCOME
          : TransactionType.EXPENSE;
      const kind =
        txType === TransactionType.INCOME ? FinancialEventKind.INCOME : FinancialEventKind.EXPENSE;
      const occurredAt =
        payload.occurredAt && !isNaN(Date.parse(payload.occurredAt))
          ? new Date(payload.occurredAt)
          : new Date();

      let mergedNote = userNote || payload.note || null;
      if (userNote && payload.note && !payload.note.includes(userNote)) {
        mergedNote = `${payload.note} (${userNote})`;
      }

      return this.prisma.$transaction(async (tx) => {
        // 1. Mark interaction as resolved
        await tx.pendingInteraction.update({
          where: { id: interaction.id },
          data: {
            state: InteractionState.RESOLVED,
            resolvedAt: new Date(),
          },
        });

        // 2. Create transaction group
        const group = await tx.transactionGroup.create({
          data: {
            userId,
            telegramUpdateId: BigInt(0),
            telegramMessageId: BigInt(Date.now()),
            source: TransactionSource.TEXT,
            messageAt: occurredAt,
            rawTranscript: payload.smsId
              ? `SMS:${payload.bankSource || 'BANK'}:${payload.smsId}`
              : `BANK_SMS:${payload.bankSource || 'BANK'}`,
            extractionModel: 'BANK_SMS_PARSER',
            promptVersion: '1.0',
          },
        });

        // 3. Create confirmed transaction
        const transaction = await tx.transaction.create({
          data: {
            userId,
            groupId: group.id,
            type: txType,
            kind,
            amountEtb: new Prisma.Decimal((isNaN(amountNum) ? 0 : amountNum).toFixed(2)),
            category,
            note: mergedNote ? mergedNote.slice(0, 500) : null,
            platform: payload.bankSource ? payload.bankSource.toLowerCase() : null,
            occurredAt,
          },
        });

        return {
          id: transaction.id,
          amountEtb: transaction.amountEtb.toFixed(2),
          category: transaction.category,
          type: transaction.type === TransactionType.INCOME ? 'income' : 'expense',
          note: transaction.note,
          platform: transaction.platform,
          occurredAt: transaction.occurredAt.toISOString(),
          linked: true,
        };
      });
    }

    return null;
  }
}
