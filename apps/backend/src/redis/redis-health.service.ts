import { Inject, Injectable } from '@nestjs/common';

import { RedisService } from './redis.service.js';

@Injectable()
export class RedisHealthService {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  async check(): Promise<'ok' | 'error'> {
    try {
      await this.redis.ping();
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
