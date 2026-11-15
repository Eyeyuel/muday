import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import {
  analyticsEventData,
  type AllowedEventType as AllowedEventTypeValue,
} from './analytics-event.js';

export { AllowedEventType } from './analytics-event.js';

@Injectable()
export class EventService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  record(userId: string, eventType: AllowedEventTypeValue, metadata?: unknown) {
    return this.prisma.event.create({
      data: { userId, ...analyticsEventData(eventType, metadata) },
    });
  }
}
