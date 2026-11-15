import { Inject, Injectable } from '@nestjs/common';

import { AllowedEventType, analyticsEventData } from '../analytics/analytics-event.js';
import { PrismaService } from '../database/prisma.service.js';

const timeAtHour = (hour: number) => new Date(Date.UTC(1970, 0, 1, hour));

@Injectable()
export class NotificationSettingsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  toggle(userId: string, field: 'morningEnabled' | 'nightEnabled') {
    return this.prisma.$transaction(async (database) => {
      const current = await database.user.findUniqueOrThrow({ where: { id: userId } });
      const enabled = !current[field];
      const user = await database.user.update({
        where: { id: userId },
        data: { [field]: enabled },
      });
      if (!enabled) {
        await database.event.create({
          data: {
            userId,
            ...analyticsEventData(AllowedEventType.NOTIFICATION_OPTED_OUT, {
              notification: field === 'morningEnabled' ? 'morning' : 'night',
            }),
          },
        });
      }
      return user;
    });
  }

  setTime(userId: string, field: 'morningTime' | 'nightTime', hour: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { [field]: timeAtHour(hour) },
    });
  }
}
