import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class TextLogRateLimiter {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async allowed(userId: string): Promise<boolean> {
    return (await this.redis.incrementWithExpiry(`rate:text-log:${userId}`, 60)) <= 10;
  }
}
