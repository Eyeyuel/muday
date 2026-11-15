import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import type { ReceiptRateLimiter } from '../src/receipt/receipt-rate-limiter.service.js';
import { ReceiptQueueService } from '../src/receipt/receipt-queue.service.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import type { UsersService } from '../src/users/users.service.js';

function createService() {
  const update = vi.fn().mockResolvedValue(undefined);
  const transport = new RecordingTelegramTransport();
  const values: Record<string, unknown> = {
    MAX_RECEIPT_FILE_BYTES: 10_000_000,
    RECEIPT_QUEUE_NAME: 'mezgeb-receipt-unit',
    REDIS_URL: 'redis://localhost:6379',
  };
  const service = new ReceiptQueueService(
    { get: vi.fn((key: string) => values[key]) } as unknown as ConfigService<Environment, true>,
    { processedUpdate: { update } } as unknown as PrismaService,
    {
      findByTelegramId: vi.fn().mockResolvedValue({ id: 'user-1', language: 'EN' }),
      findById: vi.fn().mockResolvedValue({ id: 'user-1', language: 'EN' }),
    } as unknown as UsersService,
    { allowed: vi.fn().mockResolvedValue(true) } as unknown as ReceiptRateLimiter,
    new I18nService(),
    transport,
  );
  return { service, transport, update };
}

describe('ReceiptQueueService', () => {
  it('does not queue when no receipt worker is online', async () => {
    const { service, transport, update } = createService();
    vi.spyOn((service as unknown as { queue: Queue }).queue, 'getWorkers').mockResolvedValue([]);
    await expect(
      service.enqueue({
        telegramId: 100,
        chatId: 200,
        updateId: 300,
        messageId: 400,
        messageAt: new Date(),
        fileId: 'opaque-photo-id',
        mimeType: 'image/jpeg',
      }),
    ).resolves.toBe(false);
    expect(transport.messages[0]?.text).toContain('temporarily unavailable');
    expect(update).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });

  it('rejects an oversized declared image before queueing', async () => {
    const { service, transport, update } = createService();
    await expect(
      service.enqueue({
        telegramId: 100,
        chatId: 200,
        updateId: 300,
        messageId: 400,
        messageAt: new Date(),
        fileId: 'opaque-photo-id',
        mimeType: 'image/png',
        declaredFileSize: 10_000_001,
      }),
    ).resolves.toBe(false);
    expect(transport.messages[0]?.text).toContain('smaller than 10 MB');
    expect(update).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });
});
