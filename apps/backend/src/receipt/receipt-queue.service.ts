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
import { bullMqConnection } from '../voice/bullmq-connection.js';
import { RECEIPT_JOB_NAME, type ReceiptJobData, type ReceiptMimeType } from './receipt-job.js';
import { ReceiptRateLimiter } from './receipt-rate-limiter.service.js';

export interface EnqueueReceiptInput {
  telegramId: number;
  chatId: number;
  updateId: number;
  messageId: number;
  messageAt: Date;
  fileId: string;
  mimeType: ReceiptMimeType;
  declaredFileSize?: number;
}

@Injectable()
export class ReceiptQueueService implements OnModuleDestroy {
  private readonly queue: Queue<ReceiptJobData>;
  private readonly maxBytes: number;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ReceiptRateLimiter) private readonly rateLimiter: ReceiptRateLimiter,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
  ) {
    this.maxBytes = config.get('MAX_RECEIPT_FILE_BYTES', { infer: true });
    this.queue = new Queue<ReceiptJobData>(config.get('RECEIPT_QUEUE_NAME', { infer: true }), {
      connection: bullMqConnection(config.get('REDIS_URL', { infer: true })),
    });
  }

  async enqueueByUserId(
    userId: string,
    input: Omit<EnqueueReceiptInput, 'telegramId'>,
  ): Promise<boolean> {
    const user = await this.users.findById(userId);
    const locale: Locale = user?.language === 'EN' ? 'en' : 'am';
    if (!user) return false;
    if (input.declaredFileSize !== undefined && input.declaredFileSize > this.maxBytes) {
      await this.send(input.chatId, 'receipt.too_large', locale);
      return false;
    }
    if (!(await this.rateLimiter.allowed(user.id))) {
      await this.send(input.chatId, 'receipt.rate_limited', locale);
      return false;
    }
    if ((await this.queue.getWorkers()).length === 0) {
      await this.send(input.chatId, 'receipt.unavailable', locale);
      return false;
    }
    const data: ReceiptJobData = {
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
      mimeType: input.mimeType,
      locale,
    };
    await this.prisma.processedUpdate.update({
      where: { telegramUpdateId: BigInt(input.updateId) },
      data: { userId: user.id, status: 'QUEUED', lastErrorCode: null },
    });
    try {
      await this.queue.add(RECEIPT_JOB_NAME, data, {
        jobId: `receipt-${input.updateId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      });
    } catch (error) {
      await this.prisma.processedUpdate.update({
        where: { telegramUpdateId: BigInt(input.updateId) },
        data: { status: 'FAILED', lastErrorCode: 'RECEIPT_QUEUE_FAILED' },
      });
      throw error;
    }
    await this.send(input.chatId, 'receipt.queued', locale);
    return true;
  }

  async enqueue(input: EnqueueReceiptInput): Promise<boolean> {
    const user = await this.users.findByTelegramId(input.telegramId);
    if (!user) return false;
    return this.enqueueByUserId(user.id, input);
  }

  onModuleDestroy(): Promise<void> {
    return this.queue.close();
  }

  private send(
    chatId: number,
    key: 'receipt.too_large' | 'receipt.rate_limited' | 'receipt.unavailable' | 'receipt.queued',
    locale: Locale,
  ) {
    return this.transport.sendMessage(chatId, this.i18n.translate(key, locale));
  }
}
