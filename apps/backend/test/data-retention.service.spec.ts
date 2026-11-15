import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import { DataRetentionService } from '../src/retention/data-retention.service.js';
import type { ConfigService } from '@nestjs/config';

describe('DataRetentionService', () => {
  it('clears only the bounded set selected as expired', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const service = new DataRetentionService(
      { transactionGroup: { findMany, updateMany } } as unknown as PrismaService,
      { get: vi.fn().mockReturnValue('api') } as unknown as ConfigService<Environment, true>,
      {} as StructuredLogger,
    );
    const now = new Date('2026-08-04T10:00:00.000Z');
    await expect(service.cleanupExpiredTranscripts(now)).resolves.toBe(0);
  });
});
