import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';

import type { Environment } from '../config/environment.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import { bullMqConnection } from '../voice/bullmq-connection.js';
import { NotificationDeliveryService } from './notification-delivery.service.js';
import { NotificationFanoutService } from './notification-fanout.service.js';
import type { NotificationKind, NotificationQueueJobData } from './notification.types.js';

const schedules: Array<{ id: string; pattern: string; kind: NotificationKind; hour?: number }> = [
  ...[6, 7, 8, 9].map((hour) => ({
    id: `morning-${hour}`,
    pattern: `0 ${hour} * * *`,
    kind: 'morning_reminder' as const,
    hour,
  })),
  ...[20, 21, 22].map((hour) => ({
    id: `night-${hour}`,
    pattern: `0 ${hour} * * *`,
    kind: 'night_status' as const,
    hour,
  })),
  { id: 'weekly-sunday-20', pattern: '0 20 * * 0', kind: 'weekly_summary' },
  { id: 'monthly-first-09', pattern: '0 9 1 * *', kind: 'monthly_summary' },
];

@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue<NotificationQueueJobData>;
  private worker?: Worker<NotificationQueueJobData>;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(NotificationFanoutService) private readonly fanout: NotificationFanoutService,
    @Inject(NotificationDeliveryService) private readonly delivery: NotificationDeliveryService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get('APP_ROLE', { infer: true }) !== 'worker') return;
    const queueName = this.config.get('NOTIFICATION_QUEUE_NAME', { infer: true });
    const redisUrl = this.config.get('REDIS_URL', { infer: true });
    this.queue = new Queue<NotificationQueueJobData>(queueName, {
      connection: bullMqConnection(redisUrl),
    });
    for (const schedule of schedules) {
      await this.queue.upsertJobScheduler(
        schedule.id,
        { pattern: schedule.pattern, tz: 'Africa/Addis_Ababa' },
        {
          name: 'notification-fanout',
          data: {
            jobType: 'fanout',
            kind: schedule.kind,
            ...(schedule.hour === undefined ? {} : { hour: schedule.hour }),
          },
        },
      );
    }
    this.worker = new Worker<NotificationQueueJobData>(
      queueName,
      async (job) => {
        if (job.data.jobType === 'fanout') {
          await this.fanout.trigger(job.data.kind, new Date(), job.data.hour);
          return;
        }
        await this.delivery.process(job.data);
      },
      { connection: bullMqConnection(redisUrl), concurrency: 5 },
    );
    this.worker.on('failed', (job, error) => {
      if (job?.data.jobType === 'delivery' && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        void this.delivery.markFinalFailure(job.data.deliveryId, error);
      }
    });
    this.worker.on('error', (error) => {
      this.logger.error('Notification worker error', { exceptionType: error.name });
    });
    this.logger.log('Notification worker listening', { concurrency: 5 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
