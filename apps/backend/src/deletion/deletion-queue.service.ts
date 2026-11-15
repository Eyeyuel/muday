import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import type { Environment } from '../config/environment.js';
import type { NotificationQueueJobData } from '../notifications/notification.types.js';
import { bullMqConnection } from '../voice/bullmq-connection.js';
import type { VoiceJobData } from '../voice/voice-job.js';

@Injectable()
export class DeletionQueueService implements OnModuleDestroy {
  private readonly voiceQueue: Queue<VoiceJobData>;
  private readonly notificationQueue: Queue<NotificationQueueJobData>;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    const connection = bullMqConnection(config.get('REDIS_URL', { infer: true }));
    this.voiceQueue = new Queue(config.get('VOICE_QUEUE_NAME', { infer: true }), { connection });
    this.notificationQueue = new Queue(config.get('NOTIFICATION_QUEUE_NAME', { infer: true }), {
      connection,
    });
  }

  async removeForUser(userId: string): Promise<void> {
    await Promise.all([
      this.removeMatching(this.voiceQueue, userId),
      this.removeMatching(this.notificationQueue, userId),
    ]);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.voiceQueue.close(), this.notificationQueue.close()]);
  }

  private async removeMatching<T>(queue: Queue<T>, userId: string): Promise<void> {
    const jobs = await queue.getJobs(['wait', 'delayed', 'paused', 'prioritized'], 0, 999);
    await Promise.all(
      jobs
        .filter((job) => this.jobUserId(job.data as unknown) === userId)
        .map((job) => job.remove()),
    );
  }

  private jobUserId(data: unknown): string | undefined {
    if (typeof data !== 'object' || data === null || !('userId' in data)) return undefined;
    return typeof data.userId === 'string' ? data.userId : undefined;
  }
}
