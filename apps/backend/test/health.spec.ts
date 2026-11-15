import { describe, expect, it, vi } from 'vitest';

import type { DatabaseHealthService } from '../src/database/database-health.service.js';
import { HealthController } from '../src/health/health.controller.js';
import type { RedisHealthService } from '../src/redis/redis-health.service.js';

describe('HealthController', () => {
  const databaseHealth = {
    check: vi.fn().mockResolvedValue('ok'),
  } as unknown as DatabaseHealthService;
  const redisHealth = {
    check: vi.fn().mockResolvedValue('ok'),
  } as unknown as RedisHealthService;
  const controller = new HealthController(databaseHealth, redisHealth);

  it('reports liveness', () => {
    expect(controller.liveness()).toEqual({ status: 'ok' });
  });

  it('reports database and Redis dependency checks', async () => {
    await expect(controller.readiness()).resolves.toEqual({
      status: 'ok',
      checks: {
        database: 'ok',
        redis: 'ok',
      },
    });
  });
});
