import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import { SmsQueueService } from '../src/sms/sms-queue.service.js';

describe('SmsQueueService', () => {
  const logger = { log: vi.fn(), error: vi.fn() } as unknown as StructuredLogger;
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'SMS_QUEUE_NAME') return 'mezgeb-sms-unit';
      if (key === 'REDIS_URL') return 'redis://localhost:6379';
      return undefined;
    }),
  } as unknown as ConfigService<Environment, true>;

  it('adds batch to BullMQ queue with retry and backoff options', async () => {
    const service = new SmsQueueService(config, logger);
    const addMock = vi.fn().mockResolvedValue({ id: 'test-job-999' });
    vi.spyOn((service as unknown as { queue: Queue }).queue, 'add').mockImplementation(addMock);

    const result = await service.enqueueBatch('user-uuid-1', [
      { amount: 500, bankSource: 'CBE' },
      { amount: 200, bankSource: 'Telebirr' },
    ]);

    expect(result.success).toBe(true);
    expect(result.jobId).toBe('test-job-999');
    expect(addMock).toHaveBeenCalledWith(
      'process-sms-batch',
      expect.objectContaining({
        userId: 'user-uuid-1',
      }),
      expect.objectContaining({
        attempts: 3,
      }),
    );

    await service.onModuleDestroy();
  });

  it('handles empty message array gracefully', async () => {
    const service = new SmsQueueService(config, logger);
    const addMock = vi.fn();
    vi.spyOn((service as unknown as { queue: Queue }).queue, 'add').mockImplementation(addMock);

    const result = await service.enqueueBatch('user-uuid-1', []);
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(addMock).not.toHaveBeenCalled();

    await service.onModuleDestroy();
  });
});
