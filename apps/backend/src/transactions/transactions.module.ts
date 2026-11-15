import { forwardRef, Module } from '@nestjs/common';

import { ExtractionModule } from '../extraction/extraction.module.js';
import { InteractionsModule } from '../interactions/interactions.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { ReceiptModule } from '../receipt/receipt.module.js';
import { TextLogRateLimiter } from '../rate-limit/text-log-rate-limiter.service.js';
import { TelegramTransportModule } from '../telegram/transport/telegram-transport.module.js';
import { UsersModule } from '../users/users.module.js';
import { TextTransactionService } from './text-transaction.service.js';
import { ClarificationCandidateService } from './clarification-candidate.service.js';
import { TransactionRepository } from './transaction.repository.js';
import { TransactionValidationService } from './transaction-validation.service.js';
import { FinancialEventValidationService } from './financial-event-validation.service.js';

@Module({
  imports: [
    ExtractionModule,
    InteractionsModule,
    UsersModule,
    TelegramTransportModule,
    CategoriesModule,
    forwardRef(() => DashboardModule),
    forwardRef(() => ReceiptModule),
  ],
  providers: [
    TextLogRateLimiter,
    ClarificationCandidateService,
    TransactionRepository,
    TransactionValidationService,
    FinancialEventValidationService,
    TextTransactionService,
  ],
  exports: [TextTransactionService],
})
export class TransactionsModule {}
