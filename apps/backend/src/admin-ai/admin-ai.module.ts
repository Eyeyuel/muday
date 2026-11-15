import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { AdminAiController } from './admin-ai.controller.js';
import { AdminAiExportController } from './admin-ai-export.controller.js';
import { AdminAiService } from './admin-ai.service.js';
import { AdminAiSessionRepository } from './admin-ai-session.repository.js';
import { AdminAiToolsService } from './admin-ai-tools.service.js';
import { AdminAiExportService } from './admin-ai-export.service.js';

@Module({
  imports: [ConfigModule, DatabaseModule, RedisModule, AdminAuthModule],
  controllers: [AdminAiController, AdminAiExportController],
  providers: [AdminAiService, AdminAiToolsService, AdminAiSessionRepository, AdminAiExportService],
  exports: [AdminAiService, AdminAiToolsService, AdminAiSessionRepository, AdminAiExportService],
})
export class AdminAiModule {}
