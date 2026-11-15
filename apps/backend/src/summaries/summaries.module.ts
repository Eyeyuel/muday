import { Module } from '@nestjs/common';

import { DashboardRepository } from '../dashboard/dashboard.repository.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { TelegramTransportModule } from '../telegram/transport/telegram-transport.module.js';
import { UsersModule } from '../users/users.module.js';
import { BankBreakdownCommandService } from './bank-breakdown-command.service.js';
import { SummaryCommandService } from './summary-command.service.js';
import { SummaryFormatterService } from './summary-formatter.service.js';
import { SummaryRepository } from './summary.repository.js';
import { SummaryService } from './summary.service.js';

@Module({
  imports: [UsersModule, OnboardingModule, TelegramTransportModule],
  providers: [
    SummaryRepository,
    SummaryService,
    SummaryFormatterService,
    SummaryCommandService,
    DashboardRepository,
    BankBreakdownCommandService,
  ],
  exports: [
    SummaryService,
    SummaryFormatterService,
    SummaryCommandService,
    BankBreakdownCommandService,
  ],
})
export class SummariesModule {}
