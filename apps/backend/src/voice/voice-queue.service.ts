import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import { I18nService, type Locale } from '../i18n/i18n.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { UsersService } from '../users/users.service.js';
import { bullMqConnection } from './bullmq-connection.js';
import { VOICE_JOB_NAME, type VoiceJobData } from './voice-job.js';
import { VoiceRateLimiter } from './voice-rate-limiter.service.js';

export interface EnqueueVoiceInput {
  telegramId: number;
  chatId: number;
  updateId: number;
  messageId: number;
  messageAt: Date;
  fileId: string;
  durationSeconds: number;
  declaredFileSize?: number;
}

@Injectable()
export class VoiceQueueService implements OnModuleDestroy {
  private readonly queue: Queue<VoiceJobData>;
  private readonly maxDuration: number;
  private readonly maxBytes: number;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(VoiceRateLimiter) private readonly rateLimiter: VoiceRateLimiter,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
  ) {
    this.maxDuration = config.get('MAX_VOICE_DURATION_SECONDS', { infer: true });
    this.maxBytes = config.get('MAX_VOICE_FILE_BYTES', { infer: true });
    this.queue = new Queue<VoiceJobData>(config.get('VOICE_QUEUE_NAME', { infer: true }), {
      connection: bullMqConnection(config.get('REDIS_URL', { infer: true })),
    });
  }

  async enqueueByUserId(
    userId: string,
    input: Omit<EnqueueVoiceInput, 'telegramId'>,
  ): Promise<boolean> {
    const user = await this.users.findById(userId);
    const locale: Locale = user?.language === 'EN' ? 'en' : 'am';
    if (!user) return false;
    if (input.durationSeconds <= 0) {
      await this.send(input.chatId, 'voice.too_short', locale);
      return false;
    }
    if (input.durationSeconds > this.maxDuration) {
      await this.send(input.chatId, 'voice.too_long', locale);
      return false;
    }
    if (input.declaredFileSize !== undefined && input.declaredFileSize > this.maxBytes) {
      await this.send(input.chatId, 'voice.too_large', locale);
      return false;
    }
    if (!(await this.rateLimiter.allowed(user.id))) {
      await this.send(input.chatId, 'voice.rate_limited', locale);
      return false;
    }
    const workers = await this.queue.getWorkers();
    if (workers.length === 0) {
      await this.send(input.chatId, 'voice.unavailable', locale);
      return false;
    }
    const data: VoiceJobData = {
      userId: user.id,
      telegramId: user.telegramId ? Number(user.telegramId) : 0,
      chatId: input.chatId,
      updateId: input.updateId,
      messageId: input.messageId,
      delivery: {
        telegramId: user.telegramId ? Number(user.telegramId) : 0,
        chatId: input.chatId,
        updateId: input.updateId,
        messageId: input.messageId,
      },
      messageAt: input.messageAt.toISOString(),
      fileId: input.fileId,
      locale,
    };
    await this.prisma.processedUpdate.update({
      where: { telegramUpdateId: BigInt(input.updateId) },
      data: { userId: user.id, status: 'QUEUED', lastErrorCode: null },
    });
    try {
      await this.queue.add(VOICE_JOB_NAME, data, {
        jobId: `voice-${input.updateId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      });
    } catch (error) {
      await this.prisma.processedUpdate.update({
        where: { telegramUpdateId: BigInt(input.updateId) },
        data: { status: 'FAILED', lastErrorCode: 'VOICE_QUEUE_FAILED' },
      });
      throw error;
    }
    await this.send(input.chatId, 'voice.queued', locale);
    return true;
  }

  async enqueue(input: EnqueueVoiceInput): Promise<boolean> {
    const user = await this.users.findByTelegramId(input.telegramId);
    if (!user) return false;
    return this.enqueueByUserId(user.id, input);
  }

  onModuleDestroy(): Promise<void> {
    return this.queue.close();
  }

  private send(
    chatId: number,
    key:
      | 'voice.too_short'
      | 'voice.too_long'
      | 'voice.too_large'
      | 'voice.rate_limited'
      | 'voice.unavailable'
      | 'voice.queued',
    locale: Locale,
  ) {
    return this.transport.sendMessage(chatId, this.i18n.translate(key, locale));
  }
}
