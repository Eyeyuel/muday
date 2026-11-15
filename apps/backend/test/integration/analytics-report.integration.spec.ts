import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AnalyticsReportService } from '../../src/analytics/analytics-report.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
const service = new AnalyticsReportService(prisma as unknown as PrismaService);
const telegramIds = [9_910_000_001n, 9_910_000_002n, 9_910_000_003n, 9_910_000_004n];
const asOf = new Date('2026-08-31T12:00:00.000Z');
let baseline: Awaited<ReturnType<AnalyticsReportService['generate']>>;

describe('analytics report integration', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { telegramId: { in: telegramIds } } });
    baseline = await service.generate(asOf);
    const [first, second, third, deleted] = await Promise.all([
      createUser(telegramIds[0]!, false),
      createUser(telegramIds[1]!, true),
      createUser(telegramIds[2]!, false),
      createUser(telegramIds[3]!, false),
    ]);
    await prisma.event.createMany({
      data: [
        event(first.id, 'signup', '2026-08-01T07:00:00.000Z'),
        event(second.id, 'signup', '2026-08-01T08:00:00.000Z'),
        event(third.id, 'signup', '2026-08-20T08:00:00.000Z'),
        event(deleted.id, 'signup', '2026-08-01T09:00:00.000Z'),
        event(first.id, 'consent_completed', '2026-08-01T07:01:00.000Z'),
        event(second.id, 'consent_completed', '2026-08-01T08:01:00.000Z'),
        event(first.id, 'transaction_logged', '2026-08-08T08:00:00.000Z', {
          source: 'text',
          transactionCount: 2,
        }),
        event(second.id, 'transaction_logged', '2026-08-08T09:00:00.000Z', {
          source: 'voice',
          transactionCount: 3,
        }),
        event(first.id, 'clarification_requested', '2026-08-08T07:00:00.000Z', {
          source: 'text',
          reason: 'clarify_amount',
        }),
        event(second.id, 'clarification_requested', '2026-08-08T07:00:00.000Z', {
          source: 'voice',
          reason: 'clarify_type',
        }),
        event(first.id, 'clarification_resolved', '2026-08-08T08:00:00.000Z', {
          source: 'text',
        }),
        event(third.id, 'clarification_failed', '2026-08-28T08:00:00.000Z', {
          source: 'text',
        }),
        event(second.id, 'notification_opted_out', '2026-08-10T08:00:00.000Z', {
          notification: 'morning',
        }),
        event(first.id, 'dashboard_opened', '2026-08-30T08:00:00.000Z', { period: 'week' }),
        event(second.id, 'dashboard_opened', '2026-08-30T08:00:00.000Z', {
          period: 'month',
        }),
      ],
    });
    await createGroup(first.id, 11n, '2026-08-08T08:00:00.000Z');
    await createGroup(second.id, 12n, '2026-08-08T09:00:00.000Z');
    await createGroup(third.id, 13n, '2026-08-28T08:00:00.000Z');
    await createGroup(first.id, 14n, '2026-08-31T09:00:00.000Z');
    await createGroup(first.id, 15n, '2026-08-31T10:00:00.000Z', true);
    await prisma.user.delete({ where: { id: deleted.id } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { telegramId: { in: telegramIds } } });
    await prisma.$disconnect();
  });

  it('produces reviewed privacy-safe metrics with exact D7/D30 windows', async () => {
    const report = await service.generate(asOf);
    expect(report.acquisition.signups - baseline.acquisition.signups).toBe(3);
    expect(report.acquisition.consentCompletions - baseline.acquisition.consentCompletions).toBe(2);
    expect(report.transactions.loggedGroups - baseline.transactions.loggedGroups).toBe(2);
    expect(report.transactions.loggedTransactions - baseline.transactions.loggedTransactions).toBe(
      5,
    );
    expect(report.transactions.textGroups - baseline.transactions.textGroups).toBe(1);
    expect(report.transactions.textTransactions - baseline.transactions.textTransactions).toBe(2);
    expect(report.transactions.voiceGroups - baseline.transactions.voiceGroups).toBe(1);
    expect(report.transactions.voiceTransactions - baseline.transactions.voiceTransactions).toBe(3);
    expect(report.activeUsers.dau - baseline.activeUsers.dau).toBe(1);
    expect(report.activeUsers.wau - baseline.activeUsers.wau).toBe(2);
    expect(report.activeUsers.mau - baseline.activeUsers.mau).toBe(3);
    expect(
      report.notifications.currentOptOutRate.numerator -
        baseline.notifications.currentOptOutRate.numerator,
    ).toBe(1);
    expect(
      report.notifications.currentOptOutRate.denominator -
        baseline.notifications.currentOptOutRate.denominator,
    ).toBe(3);
    expect(report.clarifications.requested - baseline.clarifications.requested).toBe(2);
    expect(report.clarifications.resolved - baseline.clarifications.resolved).toBe(1);
    expect(report.clarifications.failed - baseline.clarifications.failed).toBe(1);
    expect(
      report.clarifications.measurableAttempts - baseline.clarifications.measurableAttempts,
    ).toBe(3);
    expect(report.dashboard.opens - baseline.dashboard.opens).toBe(2);
    expect(report.dashboard.weekOpens - baseline.dashboard.weekOpens).toBe(1);
    expect(report.dashboard.monthOpens - baseline.dashboard.monthOpens).toBe(1);
    expect(
      report.retention.d7.eligibleCohortUsers - baseline.retention.d7.eligibleCohortUsers,
    ).toBe(3);
    expect(report.retention.d7.retainedUsers - baseline.retention.d7.retainedUsers).toBe(2);
    expect(
      report.retention.d30.eligibleCohortUsers - baseline.retention.d30.eligibleCohortUsers,
    ).toBe(2);
    expect(report.retention.d30.retainedUsers - baseline.retention.d30.retainedUsers).toBe(1);
    expect(JSON.stringify(report)).not.toMatch(
      /telegramId|note|transcript|initData|messageText|rawText/i,
    );
  });
});

async function createUser(telegramId: bigint, disabled: boolean) {
  return prisma.user.create({
    data: {
      telegramId,
      status: 'ACTIVE',
      consentVersion: 'analytics-v1',
      consentAt: new Date('2026-08-01T08:00:00.000Z'),
      morningEnabled: !disabled,
    },
  });
}

function event(userId: string, eventType: string, occurredAt: string, metadata?: object) {
  return { userId, eventType, occurredAt: new Date(occurredAt), ...(metadata ? { metadata } : {}) };
}

async function createGroup(userId: string, key: bigint, messageAt: string, undone = false) {
  await prisma.transactionGroup.create({
    data: {
      userId,
      telegramUpdateId: 99_100_000n + key,
      telegramMessageId: 99_100_000n + key,
      source: 'TEXT',
      messageAt: new Date(messageAt),
      extractionModel: 'analytics-fixture',
      promptVersion: 'v1',
      ...(undone ? { undoneAt: new Date(messageAt) } : {}),
    },
  });
}
