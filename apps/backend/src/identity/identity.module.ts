import { Module } from '@nestjs/common';

import { IdentityRepository } from './identity.repository.js';
import { TelegramIdentityBackfillService } from './telegram-identity-backfill.service.js';
import { TelegramIdentityResolver } from './telegram-identity-resolver.service.js';

@Module({
  providers: [IdentityRepository, TelegramIdentityBackfillService, TelegramIdentityResolver],
  exports: [IdentityRepository, TelegramIdentityBackfillService, TelegramIdentityResolver],
})
export class IdentityModule {}
