import { Module } from '@nestjs/common';

import { CategoriesModule } from '../categories/categories.module.js';
import { SummariesModule } from '../summaries/summaries.module.js';
import { TelegramTransportModule } from '../telegram/transport/telegram-transport.module.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationDeliveryService } from './notification-delivery.service.js';
import { NotificationFanoutService } from './notification-fanout.service.js';
import { NotificationMessageService } from './notification-message.service.js';
import { NotificationSettingsRepository } from './notification-settings.repository.js';
import { NotificationSettingsService } from './notification-settings.service.js';
import { NotificationRepository } from './notification.repository.js';
import { NotificationWorkerService } from './notification-worker.service.js';
import { SmsReviewNotificationService } from './sms-review-notification.service.js';

@Module({
  imports: [UsersModule, SummariesModule, TelegramTransportModule, CategoriesModule],
  providers: [
    NotificationSettingsRepository,
    NotificationSettingsService,
    NotificationRepository,
    NotificationMessageService,
    NotificationFanoutService,
    NotificationDeliveryService,
    NotificationWorkerService,
    SmsReviewNotificationService,
  ],
  exports: [NotificationSettingsService, NotificationFanoutService, SmsReviewNotificationService],
})
export class NotificationsModule {}
