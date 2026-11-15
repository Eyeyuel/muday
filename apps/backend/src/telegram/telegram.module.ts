import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { ConsentModule } from '../consent/consent.module.js';
import { CustomerAuthModule } from '../customer-auth/customer-auth.module.js';
import { DeletionModule } from '../deletion/deletion.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { MiniAppAuthModule } from '../miniapp-auth/miniapp-auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ReceiptModule } from '../receipt/receipt.module.js';
import { SummariesModule } from '../summaries/summaries.module.js';
import { UsersModule } from '../users/users.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { VoiceModule } from '../voice/voice.module.js';
import { TelegramProfileController } from './telegram-profile.controller.js';
import { TelegramProfileService } from './telegram-profile.service.js';
import { TelegramUpdateClaimService } from './telegram-update-claim.service.js';
import { TelegramUpdateProcessorService } from './telegram-update-processor.service.js';
import { TelegramUpdateRouterService } from './telegram-update-router.service.js';
import { TelegramWebhookController } from './telegram-webhook.controller.js';
import { TelegramTransportModule } from './transport/telegram-transport.module.js';

import { CategoriesModule } from '../categories/categories.module.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [
    AdminAuthModule,
    MiniAppAuthModule,
    TelegramTransportModule,
    UsersModule,
    ConsentModule,
    CustomerAuthModule,
    DeletionModule,
    OnboardingModule,
    NotificationsModule,
    TransactionsModule,
    SummariesModule,
    DashboardModule,
    VoiceModule,
    ReceiptModule,
    DatabaseModule,
    CategoriesModule,
  ],
  controllers: [TelegramWebhookController, TelegramProfileController],
  providers: [
    TelegramUpdateClaimService,
    TelegramUpdateRouterService,
    TelegramUpdateProcessorService,
    TelegramProfileService,
  ],
  exports: [TelegramTransportModule, TelegramUpdateProcessorService, TelegramProfileService],
})
export class TelegramModule {}
