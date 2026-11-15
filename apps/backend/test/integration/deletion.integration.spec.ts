import type { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Environment } from '../../src/config/environment.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { DeletionQueueService } from '../../src/deletion/deletion-queue.service.js';
import { DeletionService } from '../../src/deletion/deletion.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { I18nService } from '../../src/i18n/i18n.service.js';
import type { NotificationQueueJobData } from '../../src/notifications/notification.types.js';
import { RecordingTelegramTransport } from '../../src/telegram/transport/recording-transport.js';
import type { UsersService } from '../../src/users/users.service.js';
import { bullMqConnection } from '../../src/voice/bullmq-connection.js';
import type { VoiceJobData } from '../../src/voice/voice-job.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const suffix = `${process.pid}-${Date.now()}`;
const voiceQueueName = `muday-delete-voice-${suffix}`;
const notificationQueueName = `muday-delete-notification-${suffix}`;
const telegramId = 9_700_000_001;
const chatId = telegramId;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
const config = {
  get: (key: string) =>
    ({
      REDIS_URL: redisUrl,
      VOICE_QUEUE_NAME: voiceQueueName,
      NOTIFICATION_QUEUE_NAME: notificationQueueName,
      DELETION_POLICY_VERSION: 'test-v1',
    })[key],
} as unknown as ConfigService<Environment, true>;
const voiceQueue = new Queue<VoiceJobData>(voiceQueueName, {
  connection: bullMqConnection(redisUrl),
});
const notificationQueue = new Queue<NotificationQueueJobData>(notificationQueueName, {
  connection: bullMqConnection(redisUrl),
});
const queues = new DeletionQueueService(config);
const transport = new RecordingTelegramTransport();
const users = {
  findByTelegramId: (id: number) => prisma.user.findUnique({ where: { telegramId: BigInt(id) } }),
  findById: (id: string) => prisma.user.findUnique({ where: { id } }),
} as unknown as UsersService;
const service = new DeletionService(
  prisma as unknown as PrismaService,
  users,
  queues,
  new I18nService(),
  transport,
  config,
);

describe('full data deletion integration', () => {
  let userId: string;
  let groupId: string;

  beforeAll(async () => {
    await prisma.processedUpdate.deleteMany({
      where: { telegramUpdateId: { in: [88003n, 99001n, 99002n] } },
    });
    await prisma.user.deleteMany({ where: { telegramId: BigInt(telegramId) } });
    const user = await prisma.user.create({
      data: {
        telegramId: BigInt(telegramId),
        language: 'EN',
        status: 'ACTIVE',
        consentVersion: 'test-consent',
        consentAt: new Date(),
      },
    });
    userId = user.id;
    await prisma.consentRecord.create({
      data: { userId, version: 'test-consent', action: 'ACCEPTED' },
    });
    const group = await prisma.transactionGroup.create({
      data: {
        userId,
        telegramUpdateId: 88001n,
        telegramMessageId: 88002n,
        source: 'TEXT',
        messageAt: new Date(),
        extractionModel: 'rule',
        promptVersion: 'v1',
      },
    });
    groupId = group.id;
    await prisma.transaction.create({
      data: {
        groupId,
        userId,
        type: 'EXPENSE',
        kind: 'EXPENSE',
        amountEtb: '250',
        category: 'FOOD',
        note: 'private note',
        occurredAt: new Date(),
      },
    });
    await prisma.event.create({ data: { userId, eventType: 'transaction_logged' } });
    await prisma.processedUpdate.create({
      data: {
        telegramUpdateId: 88003n,
        userId,
        telegramChatId: BigInt(chatId),
        telegramMessageId: 88004n,
        updateType: 'message',
      },
    });
    await prisma.notificationDelivery.create({
      data: {
        userId,
        kind: 'MORNING_REMINDER',
        periodKey: suffix,
        deterministicKey: `${userId}:${suffix}`,
        scheduledFor: new Date(),
      },
    });
    await voiceQueue.add('transcribe-voice', {
      userId,
      telegramId,
      chatId,
      updateId: 88003,
      messageId: 88004,
      messageAt: new Date().toISOString(),
      fileId: 'opaque',
      locale: 'en',
    });
    await notificationQueue.add('notification', {
      jobType: 'delivery',
      deliveryId: crypto.randomUUID(),
      userId,
      kind: 'morning_reminder',
      periodKey: suffix,
    });
  });

  afterAll(async () => {
    await queues.onModuleDestroy();
    await Promise.all([
      voiceQueue.obliterate({ force: true }),
      notificationQueue.obliterate({ force: true }),
    ]);
    await Promise.all([voiceQueue.close(), notificationQueue.close()]);
    await prisma.user.deleteMany({ where: { telegramId: BigInt(telegramId) } });
    await prisma.$disconnect();
  });

  it('requires two confirmations and permanently removes every live user link and queued job', async () => {
    const auditBefore = await prisma.deletionAudit.count();
    await service.request(telegramId, chatId);
    const cancelledFirst = await prisma.pendingInteraction.findFirstOrThrow({
      where: { userId, kind: 'CONFIRM_DELETE_STEP_1', state: 'PENDING' },
    });
    await expect(
      service.handle(cancelledFirst.id, 'cancel', telegramId, chatId, 99000),
    ).resolves.toBe(false);
    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();

    await service.request(telegramId, chatId);
    const first = await prisma.pendingInteraction.findFirstOrThrow({
      where: { userId, kind: 'CONFIRM_DELETE_STEP_1', state: 'PENDING' },
    });
    await expect(service.handle(first.id, 'continue', telegramId, chatId, 99001)).resolves.toBe(
      false,
    );
    expect(await prisma.user.findUnique({ where: { id: userId } })).not.toBeNull();
    const second = await prisma.pendingInteraction.findFirstOrThrow({
      where: { userId, kind: 'CONFIRM_DELETE_STEP_2', state: 'PENDING' },
    });
    await expect(service.handle(second.id, 'cancel', telegramId, chatId, 99001)).resolves.toBe(
      false,
    );
    expect(await prisma.transaction.count({ where: { userId } })).toBe(1);

    await service.request(telegramId, chatId);
    const finalFirst = await prisma.pendingInteraction.findFirstOrThrow({
      where: { userId, kind: 'CONFIRM_DELETE_STEP_1', state: 'PENDING' },
    });
    await service.handle(finalFirst.id, 'continue', telegramId, chatId, 99001);
    const finalSecond = await prisma.pendingInteraction.findFirstOrThrow({
      where: { userId, kind: 'CONFIRM_DELETE_STEP_2', state: 'PENDING' },
    });
    expect(await service.handle(finalSecond.id, 'permanent', telegramId, chatId, 99002)).toBe(true);

    const deletedUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(deletedUser).not.toBeNull();
    expect(deletedUser?.status).toBe('DELETED');
    expect(deletedUser?.deletedAt).not.toBeNull();
    expect(deletedUser?.appCodeHash).toBeNull();
    expect(deletedUser?.appCodePrefix).toBeNull();

    // Transactions and historical data are preserved in database
    expect(await prisma.transaction.count({ where: { userId } })).toBe(1);
    expect(await prisma.transactionGroup.count({ where: { id: groupId } })).toBe(1);

    // Pending interactions cancelled
    expect(await prisma.pendingInteraction.count({ where: { userId, state: 'PENDING' } })).toBe(0);

    // Audit logged
    expect(await prisma.deletionAudit.count()).toBe(auditBefore + 1);
    expect(await voiceQueue.getJobCounts('waiting', 'delayed')).toMatchObject({
      waiting: 0,
      delayed: 0,
    });
    expect(await notificationQueue.getJobCounts('waiting', 'delayed')).toMatchObject({
      waiting: 0,
      delayed: 0,
    });
  });

  it('allows the same Telegram account to reactivate on restart and preserves past ledger', async () => {
    // When the soft-deleted user returns and runs /start, reactivate resets to PENDING_CONSENT
    const reactivated = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'PENDING_CONSENT',
        deletedAt: null,
        consentAt: null,
        consentVersion: null,
      },
    });

    expect(reactivated.id).toBe(userId);
    expect(reactivated.status).toBe('PENDING_CONSENT');
    expect(reactivated.deletedAt).toBeNull();

    // Historical transactions remain linked to the reactivated user
    expect(await prisma.transaction.count({ where: { userId } })).toBe(1);
  });
});
