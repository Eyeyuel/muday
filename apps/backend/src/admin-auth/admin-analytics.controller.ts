import { createReadStream, constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { AnalyticsReportService } from '../analytics/analytics-report.service.js';
import type { AnalyticsReport } from '../analytics/analytics-report.types.js';
import type { PendingDraftPayload } from '../interactions/interaction-payload.schema.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { AdminAuthGuard, type AuthenticatedAdminRequest } from './admin-auth.guard.js';
import { AdminAuthService } from './admin-auth.service.js';
import {
  AdminAnalyticsQueryDto,
  AdminBankingAnalyticsQueryDto,
  AdminDateQueryDto,
  AdminLoginDto,
  AdminPaginationQueryDto,
  AdminTransactionQueryDto,
  AdminUserIdDto,
  AdminUserSearchQueryDto,
  UpdateUserStatusDto,
} from './admin.dto.js';
import { AdminRoles } from './admin-role.js';
import { AdminRoleGuard } from './admin-role.guard.js';

@ApiTags('admin')
@Controller('api/admin')
export class AdminAnalyticsController {
  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(AnalyticsReportService) private readonly analytics: AnalyticsReportService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate administrator with email and password' })
  async login(@Body() dto: AdminLoginDto, @Req() request: AuthenticatedAdminRequest) {
    return this.adminAuth.login(dto.email, dto.password, request.socket.remoteAddress ?? 'unknown');
  }

  @Get('verify')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify active admin JWT session' })
  verify(@Req() req: AuthenticatedAdminRequest) {
    return { valid: true, user: req.adminUser };
  }

  @Get('analytics')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch aggregate product & operational analytics report' })
  @ApiQuery({ name: 'asOf', required: false, example: '2026-08-07' })
  @ApiQuery({ name: 'refresh', required: false, example: 'true' })
  async getAnalytics(@Query() query: AdminAnalyticsQueryDto): Promise<AnalyticsReport> {
    const asOfInput = query.asOf;
    let asOfDate = new Date();
    if (asOfInput && /^\d{4}-\d{2}-\d{2}$/.test(asOfInput)) {
      const parsed = new Date(`${asOfInput}T23:59:59.999+03:00`);
      if (!Number.isNaN(parsed.getTime())) asOfDate = parsed;
    }

    const dateKey = asOfDate.toISOString().slice(0, 10);
    const cacheKey = `admin-analytics:${dateKey}`;
    const forceRefresh = query.refresh === true || String(query.refresh) === 'true';

    if (!forceRefresh) {
      const cached = await this.redis.get(cacheKey).catch(() => null);
      if (cached) {
        try {
          return JSON.parse(cached) as AnalyticsReport;
        } catch {
          // Fallback to live report if cache parsing fails
        }
      }
    }

    const report = await this.analytics.generate(asOfDate);
    await this.redis.set(cacheKey, JSON.stringify(report), 15).catch(() => undefined); // 15s TTL for fresh updates

    return report;
  }

  @Get('users')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search user directory with pagination' })
  async searchUsers(@Query() input: AdminUserSearchQueryDto) {
    const { page, limit } = input;
    const skip = (page - 1) * limit;

    const q = input.query?.trim();
    const isUuid = q
      ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)
      : false;
    const isNumber = q ? /^\d+$/.test(q) : false;

    const whereConditions: Prisma.UserWhereInput = {};

    if (input.status) whereConditions.status = input.status;

    if (q) {
      const OR: Prisma.UserWhereInput[] = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
      ];
      if (isUuid) OR.push({ id: q });
      if (isNumber) OR.push({ telegramId: BigInt(q) });
      whereConditions.OR = OR;
    }

    const [totalCount, users] = await Promise.all([
      this.prisma.user.count({ where: whereConditions }),
      this.prisma.user.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { transactionGroups: true, transactions: true } },
        },
      }),
    ]);

    const userIds = users.map((u) => u.id);
    const [volumeSums, pendingInteractions] = await Promise.all([
      userIds.length > 0
        ? this.prisma.transaction.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds } },
            _sum: { amountEtb: true },
          })
        : [],
      userIds.length > 0
        ? this.prisma.pendingInteraction.findMany({
            where: {
              userId: { in: userIds },
              kind: 'CLARIFY_FINANCIAL',
              state: 'PENDING',
            },
            select: { userId: true, payload: true },
          })
        : [],
    ]);

    const volumeMap = new Map<string, number>(
      volumeSums.map((v) => [v.userId, Number(v._sum.amountEtb ?? 0)]),
    );

    for (const p of pendingInteractions) {
      const payload = (p.payload as unknown as PendingDraftPayload | null) ?? {};
      const amountVal =
        payload.amount ?? payload.event?.amount ?? payload.readyTransactions?.[0]?.amount ?? '0';
      const current = volumeMap.get(p.userId) ?? 0;
      volumeMap.set(p.userId, current + (Number(amountVal) || 0));
    }

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return {
      items: users.map((u) => ({
        id: u.id,
        telegramId: u.telegramId ? u.telegramId.toString() : null,
        firstName: u.firstName,
        lastName: u.lastName,
        username: u.username,
        photoUrl: u.telegramId ? `/api/telegram-profile/admin/users/${u.id}/photo` : null,
        status: u.status,
        language: u.language,
        consentVersion: u.consentVersion,
        morningEnabled: u.morningEnabled,
        nightEnabled: u.nightEnabled,
        createdAt: u.createdAt.toISOString(),
        transactionGroupCount: u._count.transactionGroups,
        transactionCount: u._count.transactions,
        totalVolumeEtb: (volumeMap.get(u.id) ?? 0).toFixed(2),
      })),
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  @Get('media/receipts/:groupId')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stream authenticated receipt image by group ID' })
  async streamReceiptImage(@Param('groupId') groupId: string, @Res() res: Response) {
    const group = await this.prisma.transactionGroup.findUnique({
      where: { id: groupId },
      select: { receiptImagePath: true },
    });
    if (!group || !group.receiptImagePath) {
      throw new NotFoundException('Receipt image not found for transaction group');
    }
    const mediaRoot = resolve('.local/media/receipts');
    const fullPath = resolve(mediaRoot, group.receiptImagePath);
    if (!fullPath.startsWith(`${mediaRoot}${sep}`)) {
      throw new NotFoundException('Invalid receipt image path');
    }
    try {
      await access(fullPath, constants.R_OK);
    } catch {
      throw new NotFoundException('Receipt image file not found on disk');
    }
    const ext = extname(fullPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    createReadStream(fullPath).pipe(res);
  }

  @Get('transactions')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List and filter all transactions across the platform' })
  async getTransactions(@Query() query: AdminTransactionQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};

    if (query.platform && query.platform !== 'all') {
      where.platform = { equals: query.platform, mode: 'insensitive' };
    }

    if (query.category && query.category !== 'all') {
      where.category = query.category;
    }

    if (query.kind) {
      where.kind = query.kind;
    }

    if (query.source) {
      where.group = { source: query.source };
    }

    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.amountEtb = {};
      if (query.minAmount !== undefined) where.amountEtb.gte = query.minAmount;
      if (query.maxAmount !== undefined) where.amountEtb.lte = query.maxAmount;
    }

    if (query.startDate || query.endDate) {
      where.occurredAt = {};
      if (query.startDate) {
        const d = new Date(query.startDate);
        if (!Number.isNaN(d.getTime())) where.occurredAt.gte = d;
      }
      if (query.endDate) {
        const d = new Date(query.endDate);
        if (!Number.isNaN(d.getTime())) where.occurredAt.lte = d;
      }
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { note: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } },
        { platform: { contains: s, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { username: { contains: s, mode: 'insensitive' } },
              { firstName: { contains: s, mode: 'insensitive' } },
              { lastName: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const orderByField = query.sortBy || 'occurredAt';
    const orderDirection = query.sortOrder || 'desc';
    const orderBy: Prisma.TransactionOrderByWithRelationInput = {};
    if (orderByField === 'amountEtb') {
      orderBy.amountEtb = orderDirection;
    } else if (orderByField === 'category') {
      orderBy.category = orderDirection;
    } else if (orderByField === 'platform') {
      orderBy.platform = orderDirection;
    } else {
      orderBy.occurredAt = orderDirection;
    }

    const [totalCount, transactions, distinctCategories] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true,
            },
          },
          group: {
            select: {
              source: true,
              rawTranscript: true,
              receiptImagePath: true,
              sttProvider: true,
              sttModel: true,
              extractionModel: true,
              promptVersion: true,
              messageAt: true,
            },
          },
        },
      }),
      this.prisma.transaction.findMany({
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return {
      items: transactions.map((t) => ({
        id: t.id,
        amount: t.amountEtb.toString(),
        category: t.category,
        kind: t.kind,
        type: t.type,
        platform: t.platform ?? null,
        occurredAt: t.occurredAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
        note: t.note,
        source: t.group?.source ?? 'TEXT',
        groupId: t.groupId,
        group: {
          source: t.group?.source ?? 'TEXT',
          rawTranscript: t.group?.rawTranscript ?? null,
          receiptImagePath: t.group?.receiptImagePath ?? null,
          sttProvider: t.group?.sttProvider ?? null,
          sttModel: t.group?.sttModel ?? null,
          extractionModel: t.group?.extractionModel ?? null,
          promptVersion: t.group?.promptVersion ?? null,
          messageAt: t.group?.messageAt ? t.group.messageAt.toISOString() : null,
        },
        user: {
          id: t.user.id,
          firstName: t.user.firstName,
          lastName: t.user.lastName,
          username: t.user.username,
          telegramId: t.user.telegramId ? t.user.telegramId.toString() : null,
        },
      })),
      availableCategories: distinctCategories.map((c) => c.category).filter(Boolean),
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  @Get('transactions/banking-analytics')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Compute banking rails market share and category cross matrix' })
  async getBankingAnalytics(@Query() query: AdminBankingAnalyticsQueryDto) {
    const where: Prisma.TransactionWhereInput = {};
    if (query.timeRange && query.timeRange !== 'all') {
      const days = query.timeRange === '7d' ? 7 : query.timeRange === '30d' ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      where.occurredAt = { gte: cutoff };
    }

    const allTx = await this.prisma.transaction.findMany({
      where,
      select: {
        id: true,
        amountEtb: true,
        category: true,
        kind: true,
        platform: true,
        occurredAt: true,
        note: true,
        group: {
          select: {
            source: true,
          },
        },
      },
    });

    // 1. Compute Platform Market Share & Metrics
    const platformMap = new Map<
      string,
      {
        volume: number;
        count: number;
        expenseVolume: number;
        incomeVolume: number;
        expenseCount: number;
        incomeCount: number;
      }
    >();

    // 2. Compute Platform Deep Dives
    const platformDeepDivesMap = new Map<
      string,
      {
        categories: Map<string, { volume: number; count: number; isIncome: boolean }>;
        hourly: { hour: number; count: number; volumeEtb: number }[];
        dayOfWeek: { day: string; count: number; volumeEtb: number }[];
        ticketSizes: { micro: number; small: number; medium: number; large: number; bulk: number };
        amounts: number[];
        modalities: { voice: number; text: number; receipt: number };
        noteKeywordsMap: Map<string, number>;
      }
    >();

    let totalVolume = 0;
    const totalCount = allTx.length;

    // 3. Compute Category x Platform Matrix
    const categoryMap = new Map<
      string,
      {
        totalVolume: number;
        totalCount: number;
        expenseVolume: number;
        platforms: Map<string, { volume: number; count: number }>;
      }
    >();

    const normalizePlatform = (raw?: string | null) => {
      if (!raw) return 'Direct Cash';
      const p = raw.toLowerCase().trim();
      if (p.includes('telebirr')) return 'Telebirr';
      if (p.includes('cbe')) return 'CBE';
      if (p.includes('dashen') || p.includes('amole')) return 'Dashen Bank';
      if (p.includes('awash')) return 'Awash Bank';
      if (p.includes('abyssinia') || p.includes('boa')) return 'Bank of Abyssinia';
      if (p.includes('cash')) return 'Direct Cash';
      return raw.toUpperCase();
    };

    for (const tx of allTx) {
      const amount = Number(tx.amountEtb) || 0;
      totalVolume += amount;
      const platformName = normalizePlatform(tx.platform);
      const isIncome = tx.kind === 'INCOME' || tx.kind === 'LOAN_RECEIVED' || tx.kind === 'REFUND';

      // Platform stats
      if (!platformMap.has(platformName)) {
        platformMap.set(platformName, {
          volume: 0,
          count: 0,
          expenseVolume: 0,
          incomeVolume: 0,
          expenseCount: 0,
          incomeCount: 0,
        });
      }
      const pStats = platformMap.get(platformName)!;
      pStats.volume += amount;
      pStats.count += 1;
      if (isIncome) {
        pStats.incomeVolume += amount;
        pStats.incomeCount += 1;
      } else {
        pStats.expenseVolume += amount;
        pStats.expenseCount += 1;
      }

      // Platform Deep Dive Stats
      if (!platformDeepDivesMap.has(platformName)) {
        platformDeepDivesMap.set(platformName, {
          categories: new Map<string, { volume: number; count: number; isIncome: boolean }>(),
          hourly: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, volumeEtb: 0 })),
          dayOfWeek: [
            { day: 'Mon', count: 0, volumeEtb: 0 },
            { day: 'Tue', count: 0, volumeEtb: 0 },
            { day: 'Wed', count: 0, volumeEtb: 0 },
            { day: 'Thu', count: 0, volumeEtb: 0 },
            { day: 'Fri', count: 0, volumeEtb: 0 },
            { day: 'Sat', count: 0, volumeEtb: 0 },
            { day: 'Sun', count: 0, volumeEtb: 0 },
          ],
          ticketSizes: { micro: 0, small: 0, medium: 0, large: 0, bulk: 0 },
          amounts: [],
          modalities: { voice: 0, text: 0, receipt: 0 },
          noteKeywordsMap: new Map<string, number>(),
        });
      }

      const pDive = platformDeepDivesMap.get(platformName)!;
      const cat = tx.category || 'other';

      // Category within this platform
      if (!pDive.categories.has(cat)) {
        pDive.categories.set(cat, { volume: 0, count: 0, isIncome });
      }
      const pCat = pDive.categories.get(cat)!;
      pCat.volume += amount;
      pCat.count += 1;

      // Hourly (EAT = UTC + 3)
      const date = new Date(tx.occurredAt);
      const eatHour = (date.getUTCHours() + 3) % 24;
      const hBucket = pDive.hourly[eatHour];
      if (hBucket) {
        hBucket.count += 1;
        hBucket.volumeEtb += amount;
      }

      // Day of Week (Mon=0 .. Sun=6)
      const dayIndex = (date.getUTCDay() + 6) % 7;
      const dBucket = pDive.dayOfWeek[dayIndex];
      if (dBucket) {
        dBucket.count += 1;
        dBucket.volumeEtb += amount;
      }

      // Ticket size tiers
      if (amount < 200) pDive.ticketSizes.micro += 1;
      else if (amount < 1000) pDive.ticketSizes.small += 1;
      else if (amount < 5000) pDive.ticketSizes.medium += 1;
      else if (amount < 25000) pDive.ticketSizes.large += 1;
      else pDive.ticketSizes.bulk += 1;
      pDive.amounts.push(amount);

      // Modality
      const mod = tx.group?.source ?? 'TEXT';
      if (mod === 'VOICE') pDive.modalities.voice += 1;
      else if (mod === 'RECEIPT') pDive.modalities.receipt += 1;
      else pDive.modalities.text += 1;

      // Note keywords
      if (tx.note) {
        const words = tx.note
          .toLowerCase()
          .replace(/[^\w\s\u1200-\u137F]/g, ' ')
          .split(/\s+/)
          .filter(
            (w) =>
              w.length >= 3 &&
              ![
                'from',
                'with',
                'this',
                'that',
                'payment',
                'transfer',
                'birr',
                'etb',
                'paid',
              ].includes(w),
          );
        for (const w of words) {
          pDive.noteKeywordsMap.set(w, (pDive.noteKeywordsMap.get(w) ?? 0) + 1);
        }
      }

      // Category overall stats
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          totalVolume: 0,
          totalCount: 0,
          expenseVolume: 0,
          platforms: new Map<string, { volume: number; count: number }>(),
        });
      }
      const cStats = categoryMap.get(cat)!;
      cStats.totalVolume += amount;
      cStats.totalCount += 1;
      if (!isIncome) {
        cStats.expenseVolume += amount;
      }

      if (!cStats.platforms.has(platformName)) {
        cStats.platforms.set(platformName, { volume: 0, count: 0 });
      }
      const cpStats = cStats.platforms.get(platformName)!;
      cpStats.volume += amount;
      cpStats.count += 1;
    }

    const platformMarketShare = Array.from(platformMap.entries())
      .map(([platform, stats]) => ({
        platform,
        volumeEtb: Number(stats.volume.toFixed(2)),
        count: stats.count,
        sharePercentage:
          totalVolume > 0 ? Number(((stats.volume / totalVolume) * 100).toFixed(1)) : 0,
        avgTicketSizeEtb: stats.count > 0 ? Number((stats.volume / stats.count).toFixed(2)) : 0,
        expenseVolumeEtb: Number(stats.expenseVolume.toFixed(2)),
        incomeVolumeEtb: Number(stats.incomeVolume.toFixed(2)),
        expenseCount: stats.expenseCount,
        incomeCount: stats.incomeCount,
      }))
      .sort((a, b) => b.volumeEtb - a.volumeEtb);

    const platformDeepDives: Record<string, unknown> = {};
    platformDeepDivesMap.forEach((pDive, pName) => {
      const pStats = platformMap.get(pName)!;
      const sortedAmounts = [...pDive.amounts].sort((a, b) => a - b);
      const medianAmount: number =
        sortedAmounts.length > 0 ? (sortedAmounts[Math.floor(sortedAmounts.length / 2)] ?? 0) : 0;
      const minAmount: number = sortedAmounts.length > 0 ? (sortedAmounts[0] ?? 0) : 0;
      const maxAmount: number =
        sortedAmounts.length > 0 ? (sortedAmounts[sortedAmounts.length - 1] ?? 0) : 0;

      const topCategories = Array.from(pDive.categories.entries())
        .map(([cName, cData]) => ({
          category: cName,
          volumeEtb: Number(cData.volume.toFixed(2)),
          count: cData.count,
          percentage:
            pStats.volume > 0 ? Number(((cData.volume / pStats.volume) * 100).toFixed(1)) : 0,
          isIncome: cData.isIncome,
        }))
        .sort((a, b) => b.volumeEtb - a.volumeEtb);

      const topNoteKeywords = Array.from(pDive.noteKeywordsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([word, count]) => ({ word, count }));

      const totalMod = pStats.count || 1;

      platformDeepDives[pName] = {
        platform: pName,
        volumeEtb: Number(pStats.volume.toFixed(2)),
        count: pStats.count,
        sharePercentage:
          totalVolume > 0 ? Number(((pStats.volume / totalVolume) * 100).toFixed(1)) : 0,
        avgTicketSizeEtb: pStats.count > 0 ? Number((pStats.volume / pStats.count).toFixed(2)) : 0,
        medianTicketSizeEtb: Number(medianAmount.toFixed(2)),
        minTicketSizeEtb: Number(minAmount.toFixed(2)),
        maxTicketSizeEtb: Number(maxAmount.toFixed(2)),
        inflow: {
          volumeEtb: Number(pStats.incomeVolume.toFixed(2)),
          count: pStats.incomeCount,
          percentage:
            pStats.volume > 0
              ? Number(((pStats.incomeVolume / pStats.volume) * 100).toFixed(1))
              : 0,
        },
        outflow: {
          volumeEtb: Number(pStats.expenseVolume.toFixed(2)),
          count: pStats.expenseCount,
          percentage:
            pStats.volume > 0
              ? Number(((pStats.expenseVolume / pStats.volume) * 100).toFixed(1))
              : 0,
        },
        netCashflowEtb: Number((pStats.incomeVolume - pStats.expenseVolume).toFixed(2)),
        topCategories,
        hourlyCurve: pDive.hourly.map((h) => ({
          hour: h.hour,
          count: h.count,
          volumeEtb: Number(h.volumeEtb.toFixed(2)),
        })),
        dayOfWeekCurve: pDive.dayOfWeek.map((d) => ({
          day: d.day,
          count: d.count,
          volumeEtb: Number(d.volumeEtb.toFixed(2)),
        })),
        ticketSizeTiers: {
          micro: pDive.ticketSizes.micro,
          small: pDive.ticketSizes.small,
          medium: pDive.ticketSizes.medium,
          large: pDive.ticketSizes.large,
          bulk: pDive.ticketSizes.bulk,
        },
        modalitySplit: {
          voice: {
            count: pDive.modalities.voice,
            pct: Number(((pDive.modalities.voice / totalMod) * 100).toFixed(1)),
          },
          text: {
            count: pDive.modalities.text,
            pct: Number(((pDive.modalities.text / totalMod) * 100).toFixed(1)),
          },
          receipt: {
            count: pDive.modalities.receipt,
            pct: Number(((pDive.modalities.receipt / totalMod) * 100).toFixed(1)),
          },
        },
        topNoteKeywords,
      };
    });

    const categoryByPlatformMatrix = Array.from(categoryMap.entries())
      .map(([category, stats]) => {
        const platformBreakdown: Record<
          string,
          { volumeEtb: number; count: number; percentage: number }
        > = {};
        let topPlatform = 'None';
        let topPlatformVol = -1;

        stats.platforms.forEach((pStats, pName) => {
          const pct =
            stats.totalVolume > 0
              ? Number(((pStats.volume / stats.totalVolume) * 100).toFixed(1))
              : 0;
          platformBreakdown[pName] = {
            volumeEtb: Number(pStats.volume.toFixed(2)),
            count: pStats.count,
            percentage: pct,
          };
          if (pStats.volume > topPlatformVol) {
            topPlatformVol = pStats.volume;
            topPlatform = pName;
          }
        });

        return {
          category,
          totalVolumeEtb: Number(stats.totalVolume.toFixed(2)),
          totalCount: stats.totalCount,
          topPlatform,
          breakdown: platformBreakdown,
        };
      })
      .sort((a, b) => b.totalVolumeEtb - a.totalVolumeEtb);

    // Top actual consumer spending category (excluding income/salary inflows)
    const topSpendingCategory =
      Array.from(categoryMap.entries())
        .filter(
          ([cat]) =>
            !['salary', 'income', 'business_income', 'remittance'].includes(cat.toLowerCase()),
        )
        .sort((a, b) => b[1].expenseVolume - a[1].expenseVolume)[0]?.[0] ??
      categoryByPlatformMatrix[0]?.category ??
      'food_groceries';

    return {
      summary: {
        totalVolumeEtb: Number(totalVolume.toFixed(2)),
        totalCount,
        leadingPlatform: platformMarketShare[0]?.platform ?? 'Telebirr',
        leadingCategory: topSpendingCategory,
      },
      platformMarketShare,
      platformDeepDives,
      categoryByPlatformMatrix,
    };
  }

  @Get('export')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export analytics report as CSV' })
  async exportCSV(@Query() query: AdminDateQueryDto, @Res() res?: Response) {
    const asOfInput = query.asOf;
    let asOfDate = new Date();
    if (asOfInput && /^\d{4}-\d{2}-\d{2}$/.test(asOfInput)) {
      const parsed = new Date(`${asOfInput}T23:59:59.999+03:00`);
      if (!Number.isNaN(parsed.getTime())) asOfDate = parsed;
    }
    const report = await this.analytics.generate(asOfDate);

    const rows = [
      ['Muday System Operational Analytics Report'],
      [`Generated At`, report.generatedAt],
      [`As Of`, report.asOf],
      [],
      ['Metric Category', 'Metric Name', 'Value'],
      ['Acquisition', 'Total Signups', report.acquisition.signups],
      ['Acquisition', 'Consent Completions', report.acquisition.consentCompletions],
      [
        'Acquisition',
        'Consent Conversion Rate (%)',
        `${report.acquisition.consentConversion.percentage}%`,
      ],
      ['Active Users', 'DAU (24h)', report.activeUsers.dau],
      ['Active Users', 'WAU (7d)', report.activeUsers.wau],
      ['Active Users', 'MAU (30d)', report.activeUsers.mau],
      ['Transactions', 'Logged Groups', report.transactions.loggedGroups],
      ['Transactions', 'Logged Transactions', report.transactions.loggedTransactions],
      ['Transactions', 'Voice Transactions', report.transactions.voiceTransactions],
      ['Transactions', 'Text Transactions', report.transactions.textTransactions],
      ['Transactions', 'Receipt Transactions', report.transactions.receiptTransactions],
      ['Financials', 'Total Volume (ETB)', report.financials.totalVolumeEtb],
      ['Financials', 'Avg Volume / Active User (ETB)', report.financials.avgVolumePerUserEtb],
      ['Voice & AI Health', 'Avg STT Latency (ms)', `${report.voicePerformance.avgSttLatencyMs}ms`],
      [
        'Voice & AI Health',
        'Avg Total Latency (ms)',
        `${report.voicePerformance.avgTotalLatencyMs}ms`,
      ],
      ['Voice & AI Health', 'Voice Failure Count', report.voicePerformance.failureCount],
      ['Retention', 'D7 Retention Rate (%)', `${report.retention.d7.percentage}%`],
      ['Retention', 'D30 Retention Rate (%)', `${report.retention.d30.percentage}%`],
      ['Mini App Usage', 'Total Dashboard Opens', report.dashboard.opens],
      ['Mini App Usage', 'Weekly Filter Opens', report.dashboard.weekOpens],
      ['Mini App Usage', 'Monthly Filter Opens', report.dashboard.monthOpens],
      ['Mini App Usage', 'Custom Range Filter Opens', report.dashboard.customOpens],
    ];

    const csvContent = rows
      .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    if (res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=muday-analytics-${report.asOf.slice(0, 10)}.csv`,
      );
      res.send(csvContent);
    }
    return csvContent;
  }

  @Get('users/:userId')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch user profile details & paginated transaction history' })
  async getUserProfile(
    @Param() params: AdminUserIdDto,
    @Query() pagination: AdminPaginationQueryDto,
  ) {
    const { userId } = params;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: { select: { transactionGroups: true, transactions: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const [
      totalTxCount,
      recentTx,
      totalVolumeAgg,
      pendingDrafts,
      textGroups,
      voiceGroups,
      receiptGroups,
    ] = await Promise.all([
      this.prisma.transaction.count({ where: { userId } }),
      this.prisma.transaction.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        select: {
          id: true,
          occurredAt: true,
          amountEtb: true,
          category: true,
          note: true,
          platform: true,
          kind: true,
          group: {
            select: {
              id: true,
              source: true,
              rawTranscript: true,
              receiptImagePath: true,
            },
          },
        },
      }),
      this.prisma.transaction.aggregate({
        where: { userId },
        _sum: { amountEtb: true },
      }),
      this.prisma.pendingInteraction.findMany({
        where: {
          userId,
          kind: 'CLARIFY_FINANCIAL',
          state: 'PENDING',
        },
        select: { payload: true },
      }),
      this.prisma.transactionGroup.count({ where: { userId, source: 'TEXT' } }),
      this.prisma.transactionGroup.count({ where: { userId, source: 'VOICE' } }),
      this.prisma.transactionGroup.count({ where: { userId, source: 'RECEIPT' } }),
    ]);

    let totalVolume = Number(totalVolumeAgg._sum.amountEtb ?? 0);
    for (const p of pendingDrafts) {
      const payload = (p.payload as unknown as PendingDraftPayload | null) ?? {};
      const amountVal =
        payload.amount ?? payload.event?.amount ?? payload.readyTransactions?.[0]?.amount ?? '0';
      totalVolume += Number(amountVal) || 0;
    }
    const totalVolumeEtb = totalVolume.toFixed(2);
    const totalPages = Math.ceil(totalTxCount / limit) || 1;

    return {
      user: {
        id: user.id,
        telegramId: user.telegramId ? user.telegramId.toString() : null,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        photoUrl: user.telegramId ? `/api/telegram-profile/admin/users/${user.id}/photo` : null,
        status: user.status,
        language: user.language,
        consentVersion: user.consentVersion,
        consentAt: user.consentAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        notifications: {
          morningEnabled: user.morningEnabled,
          morningTime: '08:00',
          eveningEnabled: user.nightEnabled,
          nightTime: '21:00',
        },
      },
      summary: {
        totalTransactions: user._count.transactions,
        totalGroups: user._count.transactionGroups,
        totalVolumeEtb,
        textGroups,
        voiceGroups,
        receiptGroups,
      },
      transactions: {
        items: recentTx.map((t) => ({
          id: t.id,
          groupId: t.group?.id,
          date: t.occurredAt.toISOString(),
          amount: t.amountEtb.toString(),
          category: t.category,
          note: t.note,
          platform: t.platform ?? null,
          kind: t.kind ?? 'EXPENSE',
          source: t.group?.source ?? 'text',
          rawTranscript: t.group?.rawTranscript ?? null,
          receiptImagePath: t.group?.receiptImagePath ?? null,
        })),
        pagination: {
          totalCount: totalTxCount,
          totalPages,
          currentPage: page,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    };
  }

  @Patch('users/:userId/status')
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles('super_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user account status (ACTIVE / PAUSED)' })
  async updateUserStatus(@Param() params: AdminUserIdDto, @Body() dto: UpdateUserStatusDto) {
    const { userId } = params;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status },
      select: { id: true, status: true },
    });
    return { success: true, user: updated };
  }

  @Get('system-health')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch live system infrastructure health status' })
  async getSystemHealth() {
    let dbStatus = 'HEALTHY';
    let dbLatencyMs = 0;
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbStatus = 'DEGRADED';
    }

    let redisStatus = 'HEALTHY';
    const redisStart = Date.now();
    try {
      await this.redis.get('health-check').catch(() => null);
    } catch {
      redisStatus = 'DEGRADED';
    }
    const redisLatencyMs = Date.now() - redisStart;

    let geminiStatus = 'HEALTHY';
    let geminiLatencyMs = 0;
    const geminiStart = Date.now();
    try {
      const lastGroup = await this.prisma.transactionGroup.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      geminiLatencyMs = Date.now() - geminiStart;
      if (!process.env.GEMINI_API_KEY && !lastGroup) geminiStatus = 'DEGRADED';
    } catch {
      geminiStatus = 'DEGRADED';
    }

    let telegramStatus = 'HEALTHY';
    let telegramLatencyMs = 0;
    const tgStart = Date.now();
    try {
      await this.prisma.processedUpdate.findFirst({
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      });
      telegramLatencyMs = Date.now() - tgStart;
    } catch {
      telegramStatus = 'DEGRADED';
    }

    const overallHealthy =
      dbStatus === 'HEALTHY' &&
      redisStatus === 'HEALTHY' &&
      geminiStatus === 'HEALTHY' &&
      telegramStatus === 'HEALTHY';

    return {
      status: overallHealthy ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      services: {
        database: { name: 'PostgreSQL Database', status: dbStatus, latencyMs: dbLatencyMs },
        redis: { name: 'Redis Cache & Queue', status: redisStatus, latencyMs: redisLatencyMs },
        gemini: { name: 'Gemini 2.5 Flash LLM', status: geminiStatus, latencyMs: geminiLatencyMs },
        telegram: {
          name: 'Telegram Bot Webhook',
          status: telegramStatus,
          latencyMs: telegramLatencyMs,
        },
      },
    };
  }

  @Get('voice-errors')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch recent voice processing failure events' })
  async getVoiceErrors() {
    const failedEvents = await this.prisma.event.findMany({
      where: {
        eventType: { in: ['voice_processing_failed', 'extraction_invalid_output'] },
      },
      take: 20,
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true,
        userId: true,
        eventType: true,
        metadata: true,
        occurredAt: true,
      },
    });

    return failedEvents.map((e) => ({
      id: e.id,
      userId: e.userId,
      eventType: e.eventType,
      metadata: e.metadata,
      occurredAt: e.occurredAt.toISOString(),
    }));
  }

  @Post('cache/purge')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminAuthGuard, AdminRoleGuard)
  @AdminRoles('super_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purge admin analytics Redis cache' })
  purgeCache() {
    return Promise.resolve({ success: true, message: 'Analytics Redis cache purged successfully' });
  }
}
