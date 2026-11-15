import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class VoiceRateLimiter {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async allowed(userId: string): Promise<boolean> {
    return (await this.redis.incrementWithExpiry(`rate:voice:${userId}`, 60)) <= 5;
  }
}
