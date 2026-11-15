import { forwardRef, Module } from '@nestjs/common';

import { ExtractionModule } from '../extraction/extraction.module.js';
import { TelegramTransportModule } from '../telegram/transport/telegram-transport.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { UsersModule } from '../users/users.module.js';
import { ReceiptMediaService } from './receipt-media.service.js';
import { ReceiptProcessingService } from './receipt-processing.service.js';
import { ReceiptQueueService } from './receipt-queue.service.js';
import { ReceiptRateLimiter } from './receipt-rate-limiter.service.js';
import { ReceiptWorkerService } from './receipt-worker.service.js';

@Module({
  imports: [
    ExtractionModule,
    TelegramTransportModule,
    forwardRef(() => TransactionsModule),
    UsersModule,
  ],
  providers: [
    ReceiptRateLimiter,
    ReceiptQueueService,
    ReceiptMediaService,
    ReceiptProcessingService,
    ReceiptWorkerService,
  ],
  exports: [ReceiptQueueService, ReceiptMediaService],
})
export class ReceiptModule {}
