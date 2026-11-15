import { Module } from '@nestjs/common';

import { CategoriesModule } from '../categories/categories.module.js';
import { ConsentModule } from '../consent/consent.module.js';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { DeletionModule } from '../deletion/deletion.module.js';
import { ExtractionModule } from '../extraction/extraction.module.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';

import { ReceiptModule } from '../receipt/receipt.module.js';
import { SmsModule } from '../sms/sms.module.js';
import { SttModule } from '../stt/stt.module.js';
import { SummariesModule } from '../summaries/summaries.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { UsersModule } from '../users/users.module.js';
import { VoiceModule } from '../voice/voice.module.js';
import { CustomerCategoriesController } from './customer-categories.controller.js';
import { CustomerDeletionController } from './customer-deletion.controller.js';
import { CustomerMediaController } from './customer-media.controller.js';
import { CustomerSettingsController } from './customer-settings.controller.js';
import { CustomerSummariesController } from './customer-summaries.controller.js';
import { CustomerTransactionsController } from './customer-transactions.controller.js';
import { MeController } from './me.controller.js';

@Module({
  imports: [
    CategoriesModule,
    CustomerAuthModule,
    DatabaseModule,
    DashboardModule,
    UsersModule,
    ConsentModule,
    TransactionsModule,
    ExtractionModule,
    SttModule,
    SummariesModule,
    DeletionModule,
    VoiceModule,
    ReceiptModule,
    SmsModule,
  ],
  controllers: [
    MeController,
    CustomerSettingsController,
    CustomerTransactionsController,
    CustomerMediaController,
    CustomerSummariesController,
    CustomerCategoriesController,
    CustomerDeletionController,
  ],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class CustomerApiModule {}
