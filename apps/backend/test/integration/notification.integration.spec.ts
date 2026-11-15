import type { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Environment } from '../../src/config/environment.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { NotificationFanoutService } from '../../src/notifications/notification-fanout.service.js';
import { NotificationSettingsRepository } from '../../src/notifications/notification-settings.repository.js';
import { NotificationRepository } from '../../src/notifications/notification.repository.js';
import { bullMqConnection } from '../../src/voice/bullmq-connection.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const consentVersion = process.env.CONSENT_VERSION ?? '2026-08-voice-v1';
const queueName = 'muday-notification-integration';
const periodKey = `notification-test-${process.pid}`;
const telegramIds: bigint[] = [9_600_000_001n, 9_600_000_002n];
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
const queue = new Queue(queueName, { connection: bullMqConnection(redisUrl) });
const config = {
  get: (key: string) =>
    ({
      CONSENT_VERSION: consentVersion,
      NOTIFICATION_QUEUE_NAME: queueName,
      REDIS_URL: redisUrl,
    })[key],
} as unknown as ConfigService<Environment, true>;
const repository = new NotificationRepository(prisma as unknown as PrismaService, config);
const fanout = new NotificationFanoutService(repository, config);
const settings = new NotificationSettingsRepository(prisma as unknown as PrismaService);

describe('notification integration', () => {
  let enabledUserId: string;
  let disabledUserId: string;

  beforeAll(async () => {
    await queue.drain(true);
    await prisma.user.deleteMany({ where: { telegramId: { in: telegramIds } } });
    const enabled = await prisma.user.create({
      data: {
        telegramId: telegramIds[0] ?? 0n,
        status: 'ACTIVE',
        language: 'EN',
        consentVersion,
        consentAt: new Date(),
        morningEnabled: true,
      },
    });
    const disabled = await prisma.user.create({
      data: {
        telegramId: telegramIds[1] ?? 0n,
        status: 'ACTIVE',
        language: 'AM',
        consentVersion,
        consentAt: new Date(),
        morningEnabled: false,
      },
    });
    enabledUserId = enabled.id;
    disabledUserId = disabled.id;
  });

  afterAll(async () => {
    await queue.drain(true);
    await fanout.onModuleDestroy();
    await queue.close();
    await prisma.notificationDelivery.deleteMany({ where: { periodKey } });
    await prisma.user.deleteMany({ where: { telegramId: { in: telegramIds } } });
    await prisma.$disconnect();
  });

  it('creates one idempotent delivery for eligible users across duplicate fan-outs', async () => {
    const now = new Date('2026-08-03T05:00:00.000Z');
    const created = await fanout.trigger('morning_reminder', now, undefined, periodKey);
    expect(created).toBeGreaterThan(0);
    await expect(fanout.trigger('morning_reminder', now, undefined, periodKey)).resolves.toBe(0);
    const deliveries = await prisma.notificationDelivery.findMany({
      where: { periodKey, userId: { in: [enabledUserId, disabledUserId] } },
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.userId).toBe(enabledUserId);
    expect(await queue.getWaitingCount()).toBe(created);
  });

  it('records an opt-out event only when an enabled setting becomes disabled', async () => {
    await settings.toggle(disabledUserId, 'nightEnabled');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: disabledUserId } });
    expect(user.nightEnabled).toBe(false);
    const event = await prisma.event.findFirst({
      where: { userId: disabledUserId, eventType: 'notification_opted_out' },
    });
    expect(event?.metadata).toEqual({ notification: 'night' });
    await settings.toggle(disabledUserId, 'nightEnabled');
    expect(
      await prisma.event.count({
        where: { userId: disabledUserId, eventType: 'notification_opted_out' },
      }),
    ).toBe(1);
  });
});
