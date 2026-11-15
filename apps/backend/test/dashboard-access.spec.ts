import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { EventService } from '../src/analytics/event.service.js';
import type { Environment } from '../src/config/environment.js';
import { DashboardAccessService } from '../src/dashboard/dashboard-access.service.js';
import type { RedisService } from '../src/redis/redis.service.js';

const config = {
  get: (key: string) =>
    ({ DASHBOARD_RATE_LIMIT_PER_MINUTE: 2, DASHBOARD_EVENT_DEDUP_SECONDS: 900 })[key],
} as unknown as ConfigService<Environment, true>;

describe('DashboardAccessService', () => {
  it('records only the first event in the deduplication window', async () => {
    const incrementWithExpiry = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const record = vi.fn();
    const service = new DashboardAccessService(
      { incrementWithExpiry } as unknown as RedisService,
      { record } as unknown as EventService,
      config,
    );
    await service.check('user', 'week');
    expect(record).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith('user', 'dashboard_opened', { period: 'week' });
  });

  it('rejects requests above the configured limit and fails closed on Redis errors', async () => {
    const limited = new DashboardAccessService(
      { incrementWithExpiry: vi.fn().mockResolvedValue(3) } as unknown as RedisService,
      { record: vi.fn() } as unknown as EventService,
      config,
    );
    await expect(limited.check('user', 'week')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    const unavailable = new DashboardAccessService(
      {
        incrementWithExpiry: vi.fn().mockRejectedValue(new Error('offline')),
      } as unknown as RedisService,
      { record: vi.fn() } as unknown as EventService,
      config,
    );
    await expect(unavailable.check('user', 'week')).rejects.toMatchObject({
      code: 'REDIS_UNAVAILABLE',
    });
  });
});
