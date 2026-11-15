import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AllowedEventType, EventService } from '../analytics/event.service.js';
import { ApplicationException } from '../common/errors/application.exception.js';
import { ErrorCode } from '../common/errors/error-code.js';
import type { Environment } from '../config/environment.js';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class DashboardAccessService {
  private readonly limit: number;
  private readonly dedupSeconds: number;

  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(EventService) private readonly events: EventService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.limit = config.get('DASHBOARD_RATE_LIMIT_PER_MINUTE', { infer: true });
    this.dedupSeconds = config.get('DASHBOARD_EVENT_DEDUP_SECONDS', { infer: true });
  }

  async check(
    userId: string,
    period: 'today' | 'week' | 'month' | 'all' | 'custom',
  ): Promise<void> {
    try {
      const minute = Math.floor(Date.now() / 60_000);
      const count = await this.redis.incrementWithExpiry(`dashboard:rate:${userId}:${minute}`, 120);
      if (count > this.limit) {
        throw new ApplicationException(
          ErrorCode.RATE_LIMITED,
          HttpStatus.TOO_MANY_REQUESTS,
          'Too many dashboard requests. Please try again later.',
        );
      }
      const first = await this.redis.incrementWithExpiry(
        `dashboard:event:${userId}:${period}`,
        this.dedupSeconds,
      );
      if (first === 1) {
        await this.events.record(userId, AllowedEventType.DASHBOARD_OPENED, { period });
      }
    } catch (error) {
      if (error instanceof ApplicationException) throw error;
      throw new ApplicationException(
        ErrorCode.REDIS_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
        'The dashboard is temporarily unavailable.',
      );
    }
  }
}
