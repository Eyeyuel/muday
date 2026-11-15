import { Inject, Injectable } from '@nestjs/common';

import { AllowedEventType, analyticsEventData } from '../analytics/analytics-event.js';
import { PrismaService } from '../database/prisma.service.js';

export type ConsentAcceptanceResult =
  'accepted' | 'already_accepted' | 'expired' | 'invalid' | 'outdated';

@Injectable()
export class ConsentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  createInteraction(userId: string, consentVersion: string, sourceUpdateId: number) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    return this.prisma.$transaction(async (transaction) => {
      await transaction.pendingInteraction.updateMany({
        where: { userId, kind: 'CONSENT', state: 'PENDING' },
        data: { state: 'CANCELLED', resolvedAt: now },
      });
      return transaction.pendingInteraction.create({
        data: {
          userId,
          kind: 'CONSENT',
          payload: { consentVersion },
          sourceUpdateId: BigInt(sourceUpdateId),
          expiresAt,
        },
      });
    });
  }

  acceptByUserId(
    interactionId: string,
    userId: string,
    currentVersion: string,
  ): Promise<ConsentAcceptanceResult> {
    return this.prisma.$transaction(async (transaction) => {
      const interaction = await transaction.pendingInteraction.findUnique({
        where: { id: interactionId },
        include: { user: true },
      });
      if (!interaction || interaction.kind !== 'CONSENT') return 'invalid';
      if (interaction.userId !== userId) return 'invalid';
      if (interaction.state !== 'PENDING') {
        return interaction.user.consentVersion === currentVersion ? 'already_accepted' : 'invalid';
      }

      const now = new Date();
      if (interaction.expiresAt <= now) {
        await transaction.pendingInteraction.updateMany({
          where: { id: interaction.id, state: 'PENDING' },
          data: { state: 'EXPIRED', resolvedAt: now },
        });
        return 'expired';
      }

      const payload = interaction.payload as { consentVersion?: unknown };
      if (payload.consentVersion !== currentVersion) {
        await transaction.pendingInteraction.updateMany({
          where: { id: interaction.id, state: 'PENDING' },
          data: { state: 'CANCELLED', resolvedAt: now },
        });
        return 'outdated';
      }

      if (
        interaction.user.status === 'ACTIVE' &&
        interaction.user.consentVersion === currentVersion &&
        interaction.user.consentAt
      ) {
        await transaction.pendingInteraction.updateMany({
          where: { id: interaction.id, state: 'PENDING' },
          data: { state: 'CANCELLED', resolvedAt: now },
        });
        return 'already_accepted';
      }

      const claimed = await transaction.pendingInteraction.updateMany({
        where: { id: interaction.id, state: 'PENDING', expiresAt: { gt: now } },
        data: { state: 'RESOLVED', resolvedAt: now },
      });
      if (claimed.count !== 1) return 'already_accepted';

      await transaction.user.update({
        where: { id: interaction.userId },
        data: {
          status: 'ACTIVE',
          consentVersion: currentVersion,
          consentAt: now,
          deletedAt: null,
        },
      });
      await transaction.consentRecord.create({
        data: {
          userId: interaction.userId,
          version: currentVersion,
          action: 'ACCEPTED',
          recordedAt: now,
        },
      });
      await transaction.event.create({
        data: {
          userId: interaction.userId,
          ...analyticsEventData(AllowedEventType.CONSENT_COMPLETED),
        },
      });
      return 'accepted';
    });
  }

  accept(
    interactionId: string,
    telegramId: number,
    currentVersion: string,
  ): Promise<ConsentAcceptanceResult> {
    return this.prisma.$transaction(async (transaction) => {
      const interaction = await transaction.pendingInteraction.findUnique({
        where: { id: interactionId },
        include: { user: true },
      });
      if (!interaction || interaction.kind !== 'CONSENT') return 'invalid';
      if (interaction.user.telegramId !== BigInt(telegramId)) return 'invalid';
      return this.acceptByUserId(interactionId, interaction.userId, currentVersion);
    });
  }

  acceptDirectly(userId: string, currentVersion: string): Promise<ConsentAcceptanceResult> {
    const now = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: userId } });
      if (!user) return 'invalid';

      if (user.status === 'ACTIVE' && user.consentVersion === currentVersion && user.consentAt) {
        return 'already_accepted';
      }

      await transaction.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
          consentVersion: currentVersion,
          consentAt: now,
          deletedAt: null,
        },
      });

      await transaction.consentRecord.create({
        data: {
          userId,
          version: currentVersion,
          action: 'ACCEPTED',
          recordedAt: now,
        },
      });

      await transaction.event.create({
        data: {
          userId,
          ...analyticsEventData(AllowedEventType.CONSENT_COMPLETED),
        },
      });

      return 'accepted';
    });
  }
}
