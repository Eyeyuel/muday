import { Inject, Injectable } from '@nestjs/common';

import { AllowedEventType, analyticsEventData } from '../analytics/analytics-event.js';
import { PrismaService } from '../database/prisma.service.js';
import type { InteractionPayloadInput } from './interaction-payload.schema.js';
import { interactionPayloadSchema } from './interaction-payload.schema.js';

type Kind =
  | 'CLARIFY_TYPE'
  | 'CLARIFY_AMOUNT'
  | 'CLARIFY_FINANCIAL'
  | 'CONFIRM_FINANCIAL'
  | 'CONFIRM_LARGE_AMOUNT'
  | 'CONFIRM_RECEIPT'
  | 'CONFIRM_UNDO';

@Injectable()
export class InteractionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(userId: string, kind: Kind, inputPayload: InteractionPayloadInput, ttlMinutes = 10) {
    const payload = interactionPayloadSchema.parse(inputPayload);
    return this.prisma.$transaction(async (database) => {
      await database.pendingInteraction.updateMany({
        where: {
          userId,
          state: 'PENDING',
          kind: { notIn: ['CONSENT', 'CLARIFY_FINANCIAL'] },
        },
        data: { state: 'CANCELLED', resolvedAt: new Date() },
      });
      const interaction = await database.pendingInteraction.create({
        data: {
          userId,
          kind,
          payload,
          ...('sourceUpdateId' in payload
            ? { sourceUpdateId: BigInt(payload.sourceUpdateId) }
            : {}),
          expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        },
      });
      if (kind === 'CLARIFY_AMOUNT' || kind === 'CLARIFY_TYPE' || kind === 'CLARIFY_FINANCIAL') {
        await database.event.create({
          data: {
            userId,
            ...analyticsEventData(AllowedEventType.CLARIFICATION_REQUESTED, {
              source: 'source' in payload ? payload.source : 'text',
              reason: kind.toLowerCase(),
            }),
          },
        });
      }
      if (kind === 'CONFIRM_LARGE_AMOUNT') {
        await database.event.create({
          data: {
            userId,
            ...analyticsEventData(AllowedEventType.LARGE_AMOUNT_CONFIRMATION_REQUESTED, {
              source: 'source' in payload ? payload.source : 'text',
            }),
          },
        });
      }
      return interaction;
    });
  }

  async findPending(id: string, userId: string) {
    const interaction = await this.prisma.pendingInteraction.findFirst({
      where: { id, userId, state: 'PENDING' },
    });
    if (!interaction) return null;
    if (interaction.expiresAt <= new Date()) {
      await this.expire(interaction.id, userId);
      return null;
    }
    const parsed = interactionPayloadSchema.safeParse(interaction.payload);
    return parsed.success ? { ...interaction, payload: parsed.data } : null;
  }

  async findPendingForUser(userId: string) {
    const interaction = await this.prisma.pendingInteraction.findFirst({
      where: {
        userId,
        state: 'PENDING',
        kind: { in: ['CLARIFY_AMOUNT', 'CLARIFY_TYPE', 'CLARIFY_FINANCIAL'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!interaction) return null;
    if (interaction.expiresAt <= new Date()) {
      await this.expire(interaction.id, userId);
      return null;
    }
    const parsed = interactionPayloadSchema.safeParse(interaction.payload);
    return parsed.success ? { ...interaction, payload: parsed.data } : null;
  }

  cancel(id: string, userId: string) {
    return this.prisma.pendingInteraction.updateMany({
      where: { id, userId, state: 'PENDING' },
      data: { state: 'CANCELLED', resolvedAt: new Date() },
    });
  }

  failClarification(id: string, userId: string) {
    return this.prisma.$transaction([
      this.prisma.pendingInteraction.updateMany({
        where: { id, userId, state: 'PENDING' },
        data: { state: 'CANCELLED', resolvedAt: new Date() },
      }),
      this.prisma.event.create({
        data: {
          userId,
          ...analyticsEventData(AllowedEventType.CLARIFICATION_FAILED, { source: 'text' }),
        },
      }),
    ]);
  }

  recordClarificationResolved(userId: string) {
    return this.prisma.event.create({
      data: {
        userId,
        ...analyticsEventData(AllowedEventType.CLARIFICATION_RESOLVED, { source: 'text' }),
      },
    });
  }

  recordTransferRejected(userId: string, source: 'text' | 'voice' | 'receipt', count: number) {
    return this.prisma.event.create({
      data: {
        userId,
        ...analyticsEventData(AllowedEventType.TRANSFER_REJECTED, { source, count }),
      },
    });
  }

  recordConfirmationCancelled(
    userId: string,
    source: 'text' | 'voice' | 'receipt',
    confirmation: 'financial' | 'large_amount' | 'receipt',
  ) {
    return this.prisma.event.create({
      data: {
        userId,
        ...analyticsEventData(AllowedEventType.CONFIRMATION_CANCELLED, { source, confirmation }),
      },
    });
  }

  recordInvalidOutput(userId: string, source: 'text' | 'voice' | 'receipt') {
    return this.prisma.event.create({
      data: {
        userId,
        ...analyticsEventData(AllowedEventType.EXTRACTION_INVALID_OUTPUT, {
          source,
          provider: 'gemini',
        }),
      },
    });
  }

  expire(id: string, userId: string) {
    return this.prisma.pendingInteraction.updateMany({
      where: { id, userId, state: 'PENDING' },
      data: { state: 'EXPIRED', resolvedAt: new Date() },
    });
  }

  async expireStale() {
    const stale = await this.prisma.pendingInteraction.findMany({
      where: { state: 'PENDING', expiresAt: { lte: new Date() } },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });
    if (stale.length === 0) return { count: 0 };
    return this.prisma.pendingInteraction.updateMany({
      where: { id: { in: stale.map(({ id }) => id) }, state: 'PENDING' },
      data: { state: 'EXPIRED', resolvedAt: new Date() },
    });
  }
}
