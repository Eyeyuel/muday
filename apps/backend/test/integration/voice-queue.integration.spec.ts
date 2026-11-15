import type { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Queue } from 'bullmq';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Environment } from '../../src/config/environment.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { I18nService } from '../../src/i18n/i18n.service.js';
import { RecordingTelegramTransport } from '../../src/telegram/transport/recording-transport.js';
import type { UsersService } from '../../src/users/users.service.js';
import { bullMqConnection } from '../../src/voice/bullmq-connection.js';
import type { VoiceRateLimiter } from '../../src/voice/voice-rate-limiter.service.js';
import { VoiceQueueService } from '../../src/voice/voice-queue.service.js';

const telegramId = 9_400_000_001n;
const updateId = 8_400_000_001n;
const queueName = 'muday-voice-integration';
const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });
const inspectionQueue = new Queue(queueName, { connection: bullMqConnection(redisUrl) });

describe('voice queue integration', () => {
  beforeEach(async () => {
    await inspectionQueue.drain(true);
    await prisma.processedUpdate.deleteMany({ where: { telegramUpdateId: updateId } });
    await prisma.user.deleteMany({ where: { telegramId } });
  });

  afterAll(async () => {
    await inspectionQueue.drain(true);
    await inspectionQueue.close();
    await prisma.processedUpdate.deleteMany({ where: { telegramUpdateId: updateId } });
    await prisma.user.deleteMany({ where: { telegramId } });
    await prisma.$disconnect();
  });

  it('marks the Telegram update queued and creates one idempotent job', async () => {
    const user = await prisma.user.create({
      data: {
        telegramId,
        language: 'EN',
        status: 'ACTIVE',
        consentVersion: '2026-08-voice-v1',
        consentAt: new Date(),
      },
    });
    await prisma.processedUpdate.create({
      data: {
        telegramUpdateId: updateId,
        updateType: 'voice',
        status: 'PROCESSING',
        attemptCount: 1,
      },
    });
    const values: Record<string, unknown> = {
      MAX_VOICE_DURATION_SECONDS: 120,
      MAX_VOICE_FILE_BYTES: 20_000_000,
      VOICE_QUEUE_NAME: queueName,
      REDIS_URL: redisUrl,
    };
    const transport = new RecordingTelegramTransport();
    const service = new VoiceQueueService(
      { get: vi.fn((key: string) => values[key]) } as unknown as ConfigService<Environment, true>,
      prisma as unknown as PrismaService,
      {
        findByTelegramId: vi.fn().mockResolvedValue(user),
        findById: vi.fn().mockResolvedValue(user),
      } as unknown as UsersService,
      { allowed: vi.fn().mockResolvedValue(true) } as unknown as VoiceRateLimiter,
      new I18nService(),
      transport,
    );
    vi.spyOn((service as unknown as { queue: Queue }).queue, 'getWorkers').mockResolvedValue([{}]);
    const input = {
      telegramId: Number(telegramId),
      chatId: 200,
      updateId: Number(updateId),
      messageId: 300,
      messageAt: new Date('2026-08-01T06:00:00.000Z'),
      fileId: 'opaque-file-id',
      durationSeconds: 8,
      declaredFileSize: 1024,
    };
    await expect(service.enqueue(input)).resolves.toBe(true);
    await expect(service.enqueue(input)).resolves.toBe(true);
    expect(
      await prisma.processedUpdate
        .findUniqueOrThrow({ where: { telegramUpdateId: updateId } })
        .then((update) => update.status),
    ).toBe('QUEUED');
    const job = await inspectionQueue.getJob(`voice-${updateId}`);
    expect(job?.data).toMatchObject({ updateId: Number(updateId), fileId: 'opaque-file-id' });
    expect(
      await inspectionQueue.getJobCounts('waiting', 'active', 'delayed', 'completed'),
    ).toMatchObject({ active: 0, completed: 0, delayed: 0, waiting: 1 });
    expect(transport.messages[0]?.text).toContain('processing');
    await service.onModuleDestroy();
  });
});
