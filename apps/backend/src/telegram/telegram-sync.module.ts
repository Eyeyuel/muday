import { Module } from '@nestjs/common';

import { ApplicationConfigModule } from '../config/config.module.js';
import { ObservabilityModule } from '../observability/observability.module.js';
import { TelegramProfileSyncService } from './transport/telegram-profile-sync.service.js';

@Module({
  imports: [ApplicationConfigModule, ObservabilityModule],
  providers: [TelegramProfileSyncService],
  exports: [TelegramProfileSyncService],
})
export class TelegramSyncModule {}
