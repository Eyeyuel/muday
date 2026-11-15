import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import type { Environment } from '../config/environment.js';
import { bullMqConnection } from '../voice/bullmq-connection.js';
import { NotificationRepository } from './notification.repository.js';
import { notificationPeriodKey } from './notification-time.js';
import {
  NOTIFICATION_JOB_NAME,
  type NotificationKind,
  type NotificationQueueJobData,
} from './notification.types.js';

@Injectable()
export class NotificationFanoutService implements OnModuleDestroy {
  private readonly queue: Queue<NotificationQueueJobData>;

  constructor(
    @Inject(NotificationRepository) private readonly repository: NotificationRepository,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.queue = new Queue<NotificationQueueJobData>(
      config.get('NOTIFICATION_QUEUE_NAME', { infer: true }),
      { connection: bullMqConnection(config.get('REDIS_URL', { infer: true })) },
    );
  }

  async trigger(
    kind: NotificationKind,
    now: Date = new Date(),
    hour?: number,
    periodKey = notificationPeriodKey(kind, now),
  ): Promise<number> {
    let cursor: string | undefined;
    let created = 0;
    do {
      const users = await this.repository.listEligible(kind, hour, cursor);
      for (const user of users) {
        const delivery = await this.repository.createDelivery(user.id, kind, periodKey, now);
        if (!delivery) continue;
        try {
          await this.queue.add(
            NOTIFICATION_JOB_NAME,
            {
              jobType: 'delivery',
              deliveryId: delivery.id,
              userId: user.id,
              kind,
              periodKey,
              ...(hour === undefined ? {} : { scheduledHour: hour }),
            },
            {
              jobId: `notification-${delivery.id}`,
              attempts: 3,
              backoff: { type: 'exponential', delay: 2_000 },
              removeOnComplete: 200,
              removeOnFail: 200,
            },
          );
        } catch (error) {
          await this.repository.deleteUnqueued(delivery.id).catch(() => undefined);
          throw error;
        }
        created += 1;
      }
      cursor = users.at(-1)?.id;
      if (users.length < 100) break;
    } while (cursor);
    return created;
  }

  onModuleDestroy(): Promise<void> {
    return this.queue.close();
  }
}
