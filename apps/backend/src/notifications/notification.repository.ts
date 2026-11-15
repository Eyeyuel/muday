import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import type { NotificationKind } from './notification.types.js';

const kindToDatabase = {
  morning_reminder: 'MORNING_REMINDER',
  night_status: 'NIGHT_STATUS',
  weekly_summary: 'WEEKLY_SUMMARY',
  monthly_summary: 'MONTHLY_SUMMARY',
} as const;

const timeAtHour = (hour: number) => new Date(Date.UTC(1970, 0, 1, hour));

@Injectable()
export class NotificationRepository {
  private readonly consentVersion: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.consentVersion = config.get('CONSENT_VERSION', { infer: true });
  }

  listEligible(kind: NotificationKind, hour: number | undefined, afterId?: string, take = 100) {
    const settingFilter =
      kind === 'morning_reminder'
        ? {
            morningEnabled: true,
            ...(hour === undefined ? {} : { morningTime: timeAtHour(hour) }),
          }
        : kind === 'night_status'
          ? {
              nightEnabled: true,
              ...(hour === undefined ? {} : { nightTime: timeAtHour(hour) }),
            }
          : {};
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        telegramId: { not: null },
        consentVersion: this.consentVersion,
        consentAt: { not: null },
        ...settingFilter,
      },
      select: { id: true, telegramId: true },
      orderBy: { id: 'asc' },
      take,
      ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
    });
  }

  async createDelivery(
    userId: string,
    kind: NotificationKind,
    periodKey: string,
    scheduledFor: Date,
  ) {
    const deterministicKey = `${userId}:${kind}:${periodKey}`;
    try {
      return await this.prisma.notificationDelivery.create({
        data: {
          userId,
          kind: kindToDatabase[kind],
          periodKey,
          deterministicKey,
          scheduledFor,
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  claim(deliveryId: string) {
    return this.prisma.notificationDelivery.updateMany({
      where: { id: deliveryId, status: 'QUEUED' },
      data: { status: 'PROCESSING', attemptCount: { increment: 1 }, lastErrorCode: null },
    });
  }

  get(deliveryId: string) {
    return this.prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
      include: { user: true },
    });
  }

  markSent(deliveryId: string) {
    return this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'SENT', sentAt: new Date(), lastErrorCode: null },
    });
  }

  markSkipped(deliveryId: string, code: string) {
    return this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'SKIPPED', lastErrorCode: code },
    });
  }

  releaseForRetry(deliveryId: string, code: string) {
    return this.prisma.notificationDelivery.updateMany({
      where: { id: deliveryId, status: 'PROCESSING' },
      data: { status: 'QUEUED', lastErrorCode: code },
    });
  }

  markFailed(deliveryId: string, code: string) {
    return this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: { status: 'FAILED', lastErrorCode: code },
    });
  }

  deleteUnqueued(deliveryId: string) {
    return this.prisma.notificationDelivery.delete({ where: { id: deliveryId } });
  }
}
