import type { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EventService } from '../../src/analytics/event.service.js';
import type { Environment } from '../../src/config/environment.js';
import { DashboardAccessService } from '../../src/dashboard/dashboard-access.service.js';
import { DashboardRepository } from '../../src/dashboard/dashboard.repository.js';
import { DashboardService } from '../../src/dashboard/dashboard.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { RedisService } from '../../src/redis/redis.service.js';
import { SummaryRepository } from '../../src/summaries/summary.repository.js';
import { SummaryService } from '../../src/summaries/summary.service.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const consentVersion = process.env.CONSENT_VERSION ?? '2026-08-voice-v1';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
const config = {
  get: (key: string) =>
    ({
      REDIS_URL: redisUrl,
      DASHBOARD_RATE_LIMIT_PER_MINUTE: 30,
      DASHBOARD_EVENT_DEDUP_SECONDS: 900,
    })[key],
} as unknown as ConfigService<Environment, true>;
const redis = new RedisService(config);
const events = new EventService(prisma as unknown as PrismaService);
const access = new DashboardAccessService(redis, events, config);
const summaries = new SummaryService(new SummaryRepository(prisma as unknown as PrismaService));
const dashboard = new DashboardService(
  summaries,
  new DashboardRepository(prisma as unknown as PrismaService),
  access,
);
const telegramIdA = 9_800_000_001n;
const telegramIdB = 9_800_000_002n;
const telegramIds: bigint[] = [telegramIdA, telegramIdB];

describe('dashboard integration', () => {
  let userA: string;
  let userB: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { telegramId: { in: telegramIds } } });
    const a = await prisma.user.create({
      data: {
        telegramId: telegramIdA,
        status: 'ACTIVE',
        consentVersion,
        consentAt: new Date(),
      },
    });
    const b = await prisma.user.create({
      data: {
        telegramId: telegramIdB,
        status: 'ACTIVE',
        consentVersion,
        consentAt: new Date(),
      },
    });
    userA = a.id;
    userB = b.id;
    const now = new Date();
    const groupA = await prisma.transactionGroup.create({
      data: {
        userId: userA,
        telegramUpdateId: BigInt(Date.now()),
        telegramMessageId: BigInt(Date.now()),
        source: 'TEXT',
        messageAt: now,
        extractionModel: 'integration',
        promptVersion: 'v1',
      },
    });
    await prisma.transaction.createMany({
      data: Array.from({ length: 21 }, (_, index) => ({
        groupId: groupA.id,
        userId: userA,
        type: 'EXPENSE' as const,
        kind: 'EXPENSE' as const,
        amountEtb: String(index + 1),
        category: index % 2 === 0 ? ('FOOD' as const) : ('UTILITIES' as const),
        note: `safe-${index}`,
        occurredAt: new Date(now.getTime() - index * 1000),
      })),
    });
    const groupB = await prisma.transactionGroup.create({
      data: {
        userId: userB,
        telegramUpdateId: BigInt(Date.now() + 1),
        telegramMessageId: BigInt(Date.now() + 1),
        source: 'TEXT',
        messageAt: now,
        extractionModel: 'integration',
        promptVersion: 'v1',
      },
    });
    await prisma.transaction.create({
      data: {
        groupId: groupB.id,
        userId: userB,
        type: 'INCOME',
        kind: 'INCOME',
        amountEtb: '9999',
        category: 'SALARY',
        note: 'user-b-private',
        occurredAt: now,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await redis.onModuleDestroy();
    await prisma.$disconnect();
  });

  it('isolates users, caps recent rows at 20, and returns sanitized shared totals', async () => {
    const result = await dashboard.get(userA, 'week', 'en');
    expect(result.recentTransactions).toHaveLength(20);
    expect(result.summary.expenseEtb).toBe('231.00');
    expect(result.summary.incomeEtb).toBe('0.00');
    expect(JSON.stringify(result)).not.toContain('9999.00');
    expect(JSON.stringify(result)).not.toContain('user-b-private');
    expect(Object.keys(result.recentTransactions[0] ?? {})).toEqual([
      'id',
      'kind',
      'type',
      'amountEtb',
      'category',
      'note',
      'platform',
      'source',
      'occurredAt',
    ]);
  });

  it('deduplicates dashboard-open analytics for repeated requests', async () => {
    await dashboard.get(userA, 'month', 'en');
    await dashboard.get(userA, 'month', 'en');
    expect(
      await prisma.event.count({ where: { userId: userA, eventType: 'dashboard_opened' } }),
    ).toBe(2);
    const events = await prisma.event.findMany({
      where: { userId: userA, eventType: 'dashboard_opened' },
      orderBy: { occurredAt: 'asc' },
    });
    expect(events.map(({ metadata }) => metadata)).toEqual([
      { period: 'week' },
      { period: 'month' },
    ]);
  });
});
