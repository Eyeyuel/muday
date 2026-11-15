import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import {
  TRANSACTION_EXTRACTOR,
  type TransactionExtractor,
} from '../extraction/transaction-extractor.interface.js';
import { I18nService } from '../i18n/i18n.service.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { TextTransactionService } from '../transactions/text-transaction.service.js';
import type { ReceiptJobData } from './receipt-job.js';
import { ReceiptMediaService } from './receipt-media.service.js';

@Injectable()
export class ReceiptProcessingService {
  constructor(
    @Inject(ReceiptMediaService) private readonly media: ReceiptMediaService,
    @Inject(TRANSACTION_EXTRACTOR) private readonly extractor: TransactionExtractor,
    @Inject(TextTransactionService) private readonly transactions: TextTransactionService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  async process(job: ReceiptJobData): Promise<void> {
    if (!(await this.userIsActive(job.userId))) return;
    const prepared = await this.media.prepare(job.fileId, job.mimeType);
    try {
      if (!this.extractor.extractImage && !this.extractor.classifyImage) {
        throw new Error('RECEIPT_EXTRACTION_UNAVAILABLE');
      }
      const mediaInput = {
        imagePath: prepared.imagePath,
        mimeType: job.mimeType,
        locale: job.locale,
      };
      const classification = this.extractor.classifyImage
        ? await this.extractor.classifyImage(mediaInput, job.userId)
        : undefined;
      const extracted = classification ? undefined : await this.extractor.extractImage!(mediaInput);
      if (!(await this.userIsActive(job.userId))) return;
      const telegramId = job.telegramId ?? job.delivery?.telegramId ?? 0;
      const chatId = job.chatId ?? job.delivery?.chatId ?? 0;
      const updateId = job.updateId ?? job.delivery?.updateId ?? 0;
      const messageId = job.messageId ?? job.delivery?.messageId ?? 0;

      const receiptInput = {
        telegramId,
        chatId,
        updateId,
        messageId,
        messageAt: new Date(job.messageAt),
        extractionModel: this.extractor.model,
        promptVersion: this.extractor.promptVersion,
        telegramFileId: job.fileId,
        mimeType: job.mimeType,
      };
      if (classification) {
        await this.transactions.requestReceiptClassification(receiptInput, classification);
      } else {
        await this.transactions.requestReceiptConfirmation(receiptInput, extracted!);
      }
      await this.prisma.processedUpdate.update({
        where: { telegramUpdateId: BigInt(updateId) },
        data: { userId: job.userId, status: 'COMPLETED', completedAt: new Date() },
      });
    } finally {
      await this.media.cleanup(prepared.directory);
    }
  }

  async finalFailure(job: ReceiptJobData, error: unknown): Promise<void> {
    if (!(await this.userIsActive(job.userId))) return;
    const errorCode = this.failureCode(error);
    const updateId = job.updateId ?? job.delivery?.updateId ?? 0;
    await this.prisma.processedUpdate
      .update({
        where: { telegramUpdateId: BigInt(updateId) },
        data: { userId: job.userId, status: 'FAILED', lastErrorCode: errorCode },
      })
      .catch(() => undefined);
    const failureDelivered = await this.sendFailureWithRetry(job);
    this.logger.error('Receipt processing failed', {
      updateId,
      exceptionType: error instanceof Error ? error.name : typeof error,
      errorCode,
      failureDelivered,
    });
  }

  cleanupAbandoned(): Promise<void> {
    return this.media.cleanupAbandoned();
  }

  private async userIsActive(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status === 'ACTIVE';
  }

  private failureCode(error: unknown): string {
    if (error instanceof Error && error.name === 'HttpError') return 'RECEIPT_TELEGRAM_API_FAILED';
    if (error instanceof Error && error.message === 'RECEIPT_EXTRACTION_UNAVAILABLE') {
      return 'RECEIPT_EXTRACTION_UNAVAILABLE';
    }
    return 'RECEIPT_PROCESSING_FAILED';
  }

  private async sendFailureWithRetry(job: ReceiptJobData): Promise<boolean> {
    const chatId = job.chatId ?? job.delivery?.chatId ?? 0;
    if (!chatId) return false;
    const delays = [0, 1_000, 3_000, 7_000];
    for (const delay of delays) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        await this.transport.sendMessage(chatId, this.i18n.translate('receipt.failed', job.locale));
        return true;
      } catch {
        // A short Telegram outage can also block the terminal failure message.
      }
    }
    return false;
  }
}
