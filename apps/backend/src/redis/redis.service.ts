import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Environment } from '../config/environment.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      connectTimeout: 3_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.client.on('error', (error: Error) => {
      this.logger.debug(`Redis connection error: ${error.message}`);
    });
  }

  async ping(): Promise<'PONG'> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }

    const response = await this.client.ping();
    if (response !== 'PONG') {
      throw new Error('Unexpected Redis ping response');
    }

    return response;
  }

  async get(key: string): Promise<string | null> {
    if (this.client.status === 'wait') await this.client.connect();
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    if (this.client.status === 'wait') await this.client.connect();
    if (ttlSeconds && ttlSeconds > 0) {
      return this.client.set(key, value, 'EX', ttlSeconds);
    }
    return this.client.set(key, value);
  }

  async incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    if (this.client.status === 'wait') await this.client.connect();
    const result = await this.client.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
      1,
      key,
      String(ttlSeconds),
    );
    return Number(result);
  }

  async getAndDelete(key: string): Promise<string | null> {
    if (this.client.status === 'wait') await this.client.connect();
    const result = await this.client.eval(
      "local val=redis.call('GET',KEYS[1]); if val then redis.call('DEL',KEYS[1]) end; return val",
      1,
      key,
    );
    return (result as string | null) ?? null;
  }

  async delete(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    if (this.client.status === 'wait') await this.client.connect();
    return this.client.del(...keys);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'ready') {
      await this.client.quit();
    } else {
      this.client.disconnect();
    }
    this.logger.log('Redis connection closed');
  }
}
