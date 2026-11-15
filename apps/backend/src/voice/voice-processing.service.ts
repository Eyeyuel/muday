import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AllowedEventType, analyticsEventData } from '../analytics/analytics-event.js';
import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import { ExtractionError } from '../extraction/extraction.error.js';
import {
  TRANSACTION_EXTRACTOR,
  type TransactionExtractor,
} from '../extraction/transaction-extractor.interface.js';
import { I18nService } from '../i18n/i18n.service.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import {
  SPEECH_TO_TEXT_PROVIDER,
  type SpeechToTextProvider,
} from '../stt/speech-to-text.interface.js';
import { SttError } from '../stt/stt.error.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { TextTransactionService } from '../transactions/text-transaction.service.js';
import { VoiceError } from './voice.error.js';
import type { VoiceJobData } from './voice-job.js';
import { VoiceMediaService } from './voice-media.service.js';

@Injectable()
export class VoiceProcessingService {
  constructor(
    @Inject(VoiceMediaService) private readonly media: VoiceMediaService,
    @Inject(SPEECH_TO_TEXT_PROVIDER) private readonly stt: SpeechToTextProvider,
    @Inject(TRANSACTION_EXTRACTOR) private readonly extractor: TransactionExtractor,
    @Inject(TextTransactionService) private readonly transactions: TextTransactionService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  async process(job: VoiceJobData): Promise<void> {
    if (!(await this.userIsActive(job.userId))) return;
    const startedAt = performance.now();
    const prepared = await this.media.prepare(job.fileId);
    try {
      const direct = this.config.get('VOICE_EXTRACTION_MODE', { infer: true }) === 'direct';
      let finalized: boolean;
      let provider: string;
      let model: string;
      let providerLatencyMs: number;
      if (direct) {
        if (!this.extractor.extractAudio && !this.extractor.classifyAudio) {
          throw new VoiceError('processing_failed');
        }
        const providerStartedAt = performance.now();
        const mediaInput = { wavPath: prepared.wavPath, locale: job.locale };
        const classification = this.extractor.classifyAudio
          ? await this.extractor.classifyAudio(mediaInput, job.userId)
          : undefined;
        const extracted = classification
          ? undefined
          : await this.extractor.extractAudio!(mediaInput);
        providerLatencyMs = Math.round(performance.now() - providerStartedAt);
        provider = 'gemini-direct';
        model = this.extractor.audioModel ?? this.extractor.model;
        if (!(await this.userIsActive(job.userId))) return;
        const telegramId = job.telegramId ?? job.delivery?.telegramId ?? 0;
        const chatId = job.chatId ?? job.delivery?.chatId ?? 0;
        const updateId = job.updateId ?? job.delivery?.updateId ?? 0;
        const messageId = job.messageId ?? job.delivery?.messageId ?? 0;

        const directInput = {
          telegramId,
          chatId,
          updateId,
          messageId,
          messageAt: new Date(job.messageAt),
          extractionModel: this.extractor.audioModel ?? this.extractor.model,
          promptVersion: this.extractor.promptVersion,
        };
        finalized = classification
          ? await this.transactions.logDirectVoiceClassification(directInput, classification)
          : await this.transactions.logDirectVoiceExtraction(directInput, extracted!);
      } else {
        const result = await this.stt.transcribe({ wavPath: prepared.wavPath, locale: job.locale });
        providerLatencyMs = result.latencyMs;
        provider = result.provider;
        model = result.model;
        if (!(await this.userIsActive(job.userId))) return;
        const telegramId = job.telegramId ?? job.delivery?.telegramId ?? 0;
        const chatId = job.chatId ?? job.delivery?.chatId ?? 0;
        const updateId = job.updateId ?? job.delivery?.updateId ?? 0;
        const messageId = job.messageId ?? job.delivery?.messageId ?? 0;
        finalized = await this.transactions.logVoiceTranscript({
          telegramId,
          chatId,
          updateId,
          messageId,
          messageAt: new Date(job.messageAt),
          text: result.transcript,
          source: 'voice',
          sttProvider: result.provider,
          sttModel: result.model,
        });
      }
      if (!finalized) {
        const updateId = job.updateId ?? job.delivery?.updateId ?? 0;
        await this.prisma.processedUpdate.update({
          where: { telegramUpdateId: BigInt(updateId) },
          data: { userId: job.userId, status: 'COMPLETED', completedAt: new Date() },
        });
      }
      await this.prisma.event
        .create({
          data: {
            userId: job.userId,
            ...analyticsEventData(AllowedEventType.VOICE_PROCESSING_COMPLETED, {
              source: 'voice',
              provider,
              model,
              sttLatencyMs: providerLatencyMs,
              totalLatencyMs: Math.round(performance.now() - startedAt),
            }),
          },
        })
        .catch(() => undefined);
    } finally {
      await this.media.cleanup(prepared.directory);
    }
  }

  async finalFailure(job: VoiceJobData, error: unknown): Promise<void> {
    if (!(await this.userIsActive(job.userId))) return;
    const code = this.failureCode(error);
    const updateId = job.updateId ?? job.delivery?.updateId ?? 0;
    const chatId = job.chatId ?? job.delivery?.chatId ?? 0;
    await this.prisma.processedUpdate
      .update({
        where: { telegramUpdateId: BigInt(updateId) },
        data: { userId: job.userId, status: 'FAILED', lastErrorCode: code },
      })
      .catch(() => undefined);
    await this.prisma.event
      .create({
        data: {
          userId: job.userId,
          ...analyticsEventData(AllowedEventType.VOICE_PROCESSING_FAILED, {
            source: 'voice',
            failureCode: code,
          }),
        },
      })
      .catch(() => undefined);
    if (chatId) {
      await this.transport
        .sendMessage(chatId, this.i18n.translate('voice.failed', job.locale))
        .catch(() => undefined);
    }
    this.logger.error('Voice processing failed', {
      updateId,
      exceptionType: error instanceof Error ? error.name : typeof error,
      errorCode: code,
    });
  }

  cleanupAbandoned(): Promise<void> {
    return this.media.cleanupAbandoned();
  }

  private failureCode(error: unknown): string {
    if (error instanceof SttError) return `STT_${error.code.toUpperCase()}`;
    if (error instanceof ExtractionError) return `EXTRACTION_${error.code.toUpperCase()}`;
    if (error instanceof VoiceError) return `VOICE_${error.code.toUpperCase()}`;
    return 'VOICE_PROCESSING_FAILED';
  }

  private async userIsActive(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    return user?.status === 'ACTIVE';
  }
}
