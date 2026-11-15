import { forwardRef, Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ExtractionModule } from '../extraction/extraction.module.js';
import { MiniAppAuthModule } from '../miniapp-auth/miniapp-auth.module.js';
import { ReceiptModule } from '../receipt/receipt.module.js';
import { SttModule } from '../stt/stt.module.js';
import { SummariesModule } from '../summaries/summaries.module.js';
import { DashboardAccessService } from './dashboard-access.service.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';
import { MiniAppSettingsController } from './miniapp-settings.controller.js';

@Module({
  imports: [
    DatabaseModule,
    MiniAppAuthModule,
    SummariesModule,
    AnalyticsModule,
    ExtractionModule,
    SttModule,
    CategoriesModule,
    forwardRef(() => ReceiptModule),
  ],
  controllers: [DashboardController, MiniAppSettingsController],
  providers: [DashboardRepository, DashboardAccessService, DashboardService],
  exports: [DashboardRepository, DashboardService],
})
export class DashboardModule {}
