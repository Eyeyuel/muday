import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnrecoverableError } from 'bullmq';

import type { Environment } from '../config/environment.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { NotificationMessageService } from './notification-message.service.js';
import { NotificationRepository } from './notification.repository.js';
import type { NotificationJobData } from './notification.types.js';
import { SmsReviewNotificationService } from './sms-review-notification.service.js';

export function notificationErrorCode(error: unknown): { code: string; permanent: boolean } {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('bot was blocked')) return { code: 'TELEGRAM_BOT_BLOCKED', permanent: true };
  if (message.includes('chat not found'))
    return { code: 'TELEGRAM_CHAT_NOT_FOUND', permanent: true };
  if (message.includes('user is deactivated')) {
    return { code: 'TELEGRAM_USER_DEACTIVATED', permanent: true };
  }
  if (message.includes('429') || message.includes('too many requests')) {
    return { code: 'TELEGRAM_RATE_LIMITED', permanent: false };
  }
  return { code: 'TELEGRAM_DELIVERY_FAILED', permanent: false };
}

@Injectable()
export class NotificationDeliveryService {
  private readonly consentVersion: string;

  constructor(
    @Inject(NotificationRepository) private readonly repository: NotificationRepository,
    @Inject(NotificationMessageService) private readonly messages: NotificationMessageService,
    @Inject(SmsReviewNotificationService)
    private readonly smsReviewNotification: SmsReviewNotificationService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.consentVersion = config.get('CONSENT_VERSION', { infer: true });
  }

  async process(job: NotificationJobData): Promise<void> {
    const claimed = await this.repository.claim(job.deliveryId);
    if (claimed.count !== 1) return;
    const delivery = await this.repository.get(job.deliveryId);
    if (!delivery) return;
    const user = delivery.user;
    const eligible =
      user.status === 'ACTIVE' &&
      user.telegramId !== null &&
      user.consentVersion === this.consentVersion &&
      user.consentAt !== null &&
      (job.kind !== 'morning_reminder' || user.morningEnabled) &&
      (job.kind !== 'night_status' || user.nightEnabled) &&
      (job.scheduledHour === undefined ||
        (job.kind === 'morning_reminder'
          ? user.morningTime.getUTCHours() === job.scheduledHour
          : job.kind === 'night_status'
            ? user.nightTime.getUTCHours() === job.scheduledHour
            : true));
    if (!eligible) {
      await this.repository.markSkipped(job.deliveryId, 'USER_NOT_ELIGIBLE');
      return;
    }
    try {
      const locale = user.language === 'EN' ? 'en' : 'am';

      if (job.kind === 'night_status') {
        const pendingDrafts = await this.smsReviewNotification.getPendingDrafts(user.id);
        if (pendingDrafts.length > 0) {
          await this.smsReviewNotification.sendReviewPrompt(
            user.id,
            Number(user.telegramId),
            locale,
            pendingDrafts[0]!,
            1,
            pendingDrafts.length,
          );
          await this.repository.markSent(job.deliveryId);
          return;
        }
      }

      const message = await this.messages.build(user.id, job.kind, locale, delivery.scheduledFor);
      await this.transport.sendMessage(Number(user.telegramId), message);
      await this.repository.markSent(job.deliveryId);
    } catch (error) {
      const failure = notificationErrorCode(error);
      if (failure.permanent) {
        await this.repository.markFailed(job.deliveryId, failure.code);
        throw new UnrecoverableError(failure.code);
      }
      await this.repository.releaseForRetry(job.deliveryId, failure.code);
      throw error;
    }
  }

  markFinalFailure(deliveryId: string, error: unknown): Promise<unknown> {
    return this.repository
      .markFailed(deliveryId, notificationErrorCode(error).code)
      .catch(() => undefined);
  }
}
