import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';

import type { Environment } from '../config/environment.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import { bullMqConnection } from '../voice/bullmq-connection.js';
import type { SmsBatchJobData } from './sms-job.js';
import { SmsProcessingService } from './sms-processing.service.js';

@Injectable()
export class SmsWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<SmsBatchJobData>;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(SmsProcessingService) private readonly processing: SmsProcessingService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  onModuleInit(): void {
    if (this.config.get('APP_ROLE', { infer: true }) !== 'worker') return;

    this.worker = new Worker<SmsBatchJobData>(
      this.config.get('SMS_QUEUE_NAME', { infer: true }),
      async (job) => {
        return this.processing.processBatch(job.data);
      },
      {
        connection: bullMqConnection(this.config.get('REDIS_URL', { infer: true })),
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error('SMS worker job failed', {
        jobId: job?.id,
        userId: job?.data?.userId,
        error: error.message,
      });
    });

    this.worker.on('error', (error) => {
      this.logger.error('SMS worker error', { exceptionType: error.name, message: error.message });
    });

    this.logger.log('SMS worker listening', { concurrency: 5 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
