import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import type { UsersService } from '../src/users/users.service.js';
import type { VoiceRateLimiter } from '../src/voice/voice-rate-limiter.service.js';
import { VoiceQueueService } from '../src/voice/voice-queue.service.js';

describe('VoiceQueueService', () => {
  it('responds immediately and does not queue when no voice worker is online', async () => {
    const update = vi.fn();
    const transport = new RecordingTelegramTransport();
    const values: Record<string, unknown> = {
      MAX_VOICE_DURATION_SECONDS: 120,
      MAX_VOICE_FILE_BYTES: 20_000_000,
      VOICE_QUEUE_NAME: 'mezgeb-voice-unit',
      REDIS_URL: 'redis://localhost:6379',
    };
    const service = new VoiceQueueService(
      { get: vi.fn((key: string) => values[key]) } as unknown as ConfigService<Environment, true>,
      { processedUpdate: { update } } as unknown as PrismaService,
      {
        findByTelegramId: vi.fn().mockResolvedValue({ id: 'user-1', language: 'EN' }),
        findById: vi.fn().mockResolvedValue({ id: 'user-1', language: 'EN' }),
      } as unknown as UsersService,
      { allowed: vi.fn().mockResolvedValue(true) } as unknown as VoiceRateLimiter,
      new I18nService(),
      transport,
    );
    vi.spyOn((service as unknown as { queue: Queue }).queue, 'getWorkers').mockResolvedValue([]);

    await expect(
      service.enqueue({
        telegramId: 100,
        chatId: 200,
        updateId: 300,
        messageId: 400,
        messageAt: new Date(),
        fileId: 'opaque-file-id',
        durationSeconds: 8,
      }),
    ).resolves.toBe(false);

    expect(transport.messages[0]?.text).toContain('temporarily unavailable');
    expect(update).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });
});
