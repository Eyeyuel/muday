import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AnalyticsModule } from '../analytics/analytics.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { AdminAnalyticsController } from './admin-analytics.controller.js';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdminAuthService } from './admin-auth.service.js';

@Module({
  imports: [ConfigModule, DatabaseModule, AnalyticsModule, RedisModule],
  controllers: [AdminAnalyticsController],
  providers: [AdminAuthService, AdminAuthGuard, AdminRoleGuard],
  exports: [AdminAuthService, AdminAuthGuard, AdminRoleGuard],
})
export class AdminAuthModule {}
