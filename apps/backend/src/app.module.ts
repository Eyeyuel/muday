import { MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AdminAiModule } from './admin-ai/admin-ai.module.js';
import { AdminAuthModule } from './admin-auth/admin-auth.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { GlobalExceptionFilter } from './common/errors/global-exception.filter.js';
import { ApplicationConfigModule } from './config/config.module.js';
import { CustomerApiModule } from './customer-api/customer-api.module.js';
import { CustomerAuthModule } from './customer-auth/customer-auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { HealthModule } from './health/health.module.js';
import { I18nModule } from './i18n/i18n.module.js';
import { CorrelationMiddleware } from './observability/correlation.middleware.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RetentionModule } from './retention/retention.module.js';
import { SmsModule } from './sms/sms.module.js';
import { TelegramModule } from './telegram/telegram.module.js';

@Module({
  imports: [
    ApplicationConfigModule,
    AdminAiModule,
    AdminAuthModule,
    AnalyticsModule,
    ObservabilityModule,
    DatabaseModule,
    DashboardModule,
    RedisModule,
    RetentionModule,
    HealthModule,
    I18nModule,
    TelegramModule,
    CustomerAuthModule,
    CustomerApiModule,
    SmsModule,
  ],

  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes({ path: '*splat', method: RequestMethod.ALL });
  }
}
