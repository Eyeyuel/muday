import { Module } from '@nestjs/common';

import { ExtractionModule } from '../extraction/extraction.module.js';
import { SttModule } from '../stt/stt.module.js';
import { TelegramTransportModule } from '../telegram/transport/telegram-transport.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { UsersModule } from '../users/users.module.js';
import { VoiceMediaService } from './voice-media.service.js';
import { VoiceProcessingService } from './voice-processing.service.js';
import { VoiceQueueService } from './voice-queue.service.js';
import { VoiceRateLimiter } from './voice-rate-limiter.service.js';
import { VoiceWorkerService } from './voice-worker.service.js';

@Module({
  imports: [ExtractionModule, SttModule, TelegramTransportModule, TransactionsModule, UsersModule],
  providers: [
    VoiceRateLimiter,
    VoiceQueueService,
    VoiceMediaService,
    VoiceProcessingService,
    VoiceWorkerService,
  ],
  exports: [VoiceQueueService],
})
export class VoiceModule {}
