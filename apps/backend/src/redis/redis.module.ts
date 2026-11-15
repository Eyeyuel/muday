import { Global, Module } from '@nestjs/common';

import { RedisHealthService } from './redis-health.service.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  providers: [RedisService, RedisHealthService],
  exports: [RedisService, RedisHealthService],
})
export class RedisModule {}
