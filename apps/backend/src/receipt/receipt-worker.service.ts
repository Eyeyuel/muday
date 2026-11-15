import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';

import type { Environment } from '../config/environment.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import { bullMqConnection } from '../voice/bullmq-connection.js';
import type { ReceiptJobData } from './receipt-job.js';
import { ReceiptProcessingService } from './receipt-processing.service.js';

@Injectable()
export class ReceiptWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<ReceiptJobData>;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(ReceiptProcessingService) private readonly processing: ReceiptProcessingService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get('APP_ROLE', { infer: true }) !== 'worker') return;
    await this.processing.cleanupAbandoned();
    this.worker = new Worker<ReceiptJobData>(
      this.config.get('RECEIPT_QUEUE_NAME', { infer: true }),
      (job) => this.processing.process(job.data),
      {
        connection: bullMqConnection(this.config.get('REDIS_URL', { infer: true })),
        concurrency: 1,
      },
    );
    this.worker.on('failed', (job, error) => {
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        void this.processing.finalFailure(job.data, error);
      }
    });
    this.worker.on('error', (error) => {
      this.logger.error('Receipt worker error', { exceptionType: error.name });
    });
    this.logger.log('Receipt worker listening', { concurrency: 1 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
