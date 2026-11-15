import { Module } from '@nestjs/common';

import { EventService } from './event.service.js';
import { AnalyticsReportService } from './analytics-report.service.js';

@Module({
  providers: [EventService, AnalyticsReportService],
  exports: [EventService, AnalyticsReportService],
})
export class AnalyticsModule {}
