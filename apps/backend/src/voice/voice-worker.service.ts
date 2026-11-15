import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';

import type { Environment } from '../config/environment.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import { bullMqConnection } from './bullmq-connection.js';
import type { VoiceJobData } from './voice-job.js';
import { VoiceProcessingService } from './voice-processing.service.js';

@Injectable()
export class VoiceWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<VoiceJobData>;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(VoiceProcessingService) private readonly processing: VoiceProcessingService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get('APP_ROLE', { infer: true }) !== 'worker') return;
    await this.processing.cleanupAbandoned();
    this.worker = new Worker<VoiceJobData>(
      this.config.get('VOICE_QUEUE_NAME', { infer: true }),
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
      this.logger.error('Voice worker error', { exceptionType: error.name });
    });
    this.logger.log('Voice worker listening', { concurrency: 1 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
