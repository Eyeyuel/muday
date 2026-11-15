import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class ReceiptRateLimiter {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async allowed(userId: string): Promise<boolean> {
    return (await this.redis.incrementWithExpiry(`rate:receipt:${userId}`, 60)) <= 5;
  }
}
