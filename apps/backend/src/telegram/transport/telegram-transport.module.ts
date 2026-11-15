import { Global, Module } from '@nestjs/common';

import { GrammyTelegramTransport } from './grammy-transport.js';
import { TelegramProfileSyncService } from './telegram-profile-sync.service.js';
import { TELEGRAM_TRANSPORT } from './telegram-transport.interface.js';

@Global()
@Module({
  providers: [
    TelegramProfileSyncService,
    GrammyTelegramTransport,
    { provide: TELEGRAM_TRANSPORT, useExisting: GrammyTelegramTransport },
  ],
  exports: [TELEGRAM_TRANSPORT, TelegramProfileSyncService],
})
export class TelegramTransportModule {}
