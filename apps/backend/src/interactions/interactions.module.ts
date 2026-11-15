import { Module } from '@nestjs/common';

import { InteractionCleanupService } from './interaction-cleanup.service.js';
import { InteractionRepository } from './interaction.repository.js';

@Module({
  providers: [InteractionRepository, InteractionCleanupService],
  exports: [InteractionRepository],
})
export class InteractionsModule {}
