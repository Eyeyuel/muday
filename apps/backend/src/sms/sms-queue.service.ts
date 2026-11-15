import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import type { Environment } from '../config/environment.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import { bullMqConnection } from '../voice/bullmq-connection.js';
import { SMS_JOB_NAME, type SmsBatchJobData, type SmsBatchMessageItem } from './sms-job.js';

@Injectable()
export class SmsQueueService implements OnModuleDestroy {
  private readonly queue: Queue<SmsBatchJobData>;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {
    this.queue = new Queue<SmsBatchJobData>(config.get('SMS_QUEUE_NAME', { infer: true }), {
      connection: bullMqConnection(config.get('REDIS_URL', { infer: true })),
    });
  }

  async enqueueBatch(
    userId: string,
    messages: SmsBatchMessageItem[],
  ): Promise<{ success: boolean; jobId?: string | undefined; count: number }> {
    if (!messages || messages.length === 0) {
      return { success: true, count: 0 };
    }

    const cappedMessages = messages.slice(0, 200);
    const jobData: SmsBatchJobData = {
      userId,
      messages: cappedMessages,
      enqueuedAt: new Date().toISOString(),
    };

    const job = await this.queue.add(SMS_JOB_NAME, jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });

    this.logger.log('Enqueued SMS batch for processing', {
      userId,
      jobId: job.id,
      count: cappedMessages.length,
    });

    return {
      success: true,
      jobId: job.id,
      count: cappedMessages.length,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
