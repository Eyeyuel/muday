import { describe, expect, it, vi } from 'vitest';

import { TextLogRateLimiter } from '../src/rate-limit/text-log-rate-limiter.service.js';
import type { RedisService } from '../src/redis/redis.service.js';

describe('TextLogRateLimiter', () => {
  it('allows ten attempts and rejects the eleventh using only the internal user UUID', async () => {
    const incrementWithExpiry = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(11);
    const limiter = new TextLogRateLimiter({ incrementWithExpiry } as unknown as RedisService);

    await expect(limiter.allowed('internal-user-id')).resolves.toBe(true);
    await expect(limiter.allowed('internal-user-id')).resolves.toBe(false);
    expect(incrementWithExpiry).toHaveBeenCalledWith('rate:text-log:internal-user-id', 60);
  });
});
