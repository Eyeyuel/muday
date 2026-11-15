import { Module } from '@nestjs/common';

import { ApplicationConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AnalyticsReportService } from './analytics-report.service.js';
import { VoicePerformanceReportService } from './voice-performance-report.service.js';

@Module({
  imports: [ApplicationConfigModule, DatabaseModule],
  providers: [AnalyticsReportService, VoicePerformanceReportService],
})
export class AnalyticsReportCommandModule {}
