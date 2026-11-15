import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ObservabilityModule } from '../observability/observability.module.js';
import { SmsProcessingService } from './sms-processing.service.js';
import { SmsQueueService } from './sms-queue.service.js';
import { SmsWorkerService } from './sms-worker.service.js';

@Module({
  imports: [DatabaseModule, ObservabilityModule],
  providers: [SmsQueueService, SmsProcessingService, SmsWorkerService],
  exports: [SmsQueueService, SmsProcessingService],
})
export class SmsModule {}
