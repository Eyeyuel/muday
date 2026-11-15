import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FinancialEventKind, Prisma } from '../generated/prisma/client.js';
import { CategoryRepository } from '../categories/category.repository.js';

import { AllowedEventType, analyticsEventData } from '../analytics/analytics-event.js';
import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import type { ValidatedTransaction } from './transaction-validation.service.js';
import type { ValidatedFinancialEvent } from './financial-event-validation.service.js';

export type PersistableTransaction = ValidatedTransaction | ValidatedFinancialEvent;

export interface LogTransactionInput {
  userId: string;
  sourceUpdateId: number;
  sourceMessageId: number;
  processedUpdateId: number;
  messageAt: Date;
  model: string;
  promptVersion: string;
  transactions: PersistableTransaction[];
  source?: 'TEXT' | 'VOICE' | 'RECEIPT';
  rawTranscript?: string;
  receiptImagePath?: string;
  sttProvider?: string;
  sttModel?: string;
  interactionId?: string;
  clarificationResolved?: boolean;
}

export interface UndoPreview {
  groupId: string;
  transactions: Array<Pick<ValidatedTransaction, 'type' | 'amount' | 'category' | 'note'>>;
}

@Injectable()
export class TransactionRepository {
  private readonly consentVersion: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(CategoryRepository) private readonly categoryRepository: CategoryRepository,
  ) {
    this.consentVersion = config.get('CONSENT_VERSION', { infer: true });
  }

  logText(input: LogTransactionInput) {
    return this.prisma.$transaction(async (database) => {
      const users = await database.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM users WHERE id = ${input.userId}::uuid FOR UPDATE`,
      );
      if (!users[0]) throw new Error('USER_NOT_FOUND');
      const user = await database.user.findFirst({
        where: {
          id: input.userId,
          status: 'ACTIVE',
          consentVersion: this.consentVersion,
          consentAt: { not: null },
        },
        select: { id: true },
      });
      if (!user) throw new Error('USER_NOT_CONSENTED');

      if (input.interactionId) {
        const claimed = await database.pendingInteraction.updateMany({
          where: {
            id: input.interactionId,
            userId: input.userId,
            state: 'PENDING',
            expiresAt: { gt: new Date() },
          },
          data: { state: 'RESOLVED', resolvedAt: new Date() },
        });
        if (claimed.count !== 1) throw new Error('INTERACTION_NOT_PENDING');
      }

      const priorGroupCount = await database.transactionGroup.count({
        where: { userId: input.userId },
      });
      const messageId =
        input.sourceMessageId && input.sourceMessageId !== 0
          ? BigInt(input.sourceMessageId)
          : BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
      const updateId =
        input.sourceUpdateId && input.sourceUpdateId !== 0
          ? BigInt(input.sourceUpdateId)
          : BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));

      const group = await database.transactionGroup.create({
        data: {
          userId: input.userId,
          telegramUpdateId: updateId,
          telegramMessageId: messageId,
          source: input.source ?? 'TEXT',
          messageAt: input.messageAt,
          extractionModel: input.model,
          promptVersion: input.promptVersion,
          ...(input.rawTranscript ? { rawTranscript: input.rawTranscript } : {}),
          ...(input.receiptImagePath ? { receiptImagePath: input.receiptImagePath } : {}),
          ...(input.sttProvider ? { sttProvider: input.sttProvider } : {}),
          ...(input.sttModel ? { sttModel: input.sttModel } : {}),
        },
      });
      await database.transaction.createMany({
        data: input.transactions.map((transaction) => ({
          groupId: group.id,
          userId: input.userId,
          type: transaction.type === 'income' ? ('INCOME' as const) : ('EXPENSE' as const),
          kind:
            'kind' in transaction
              ? FinancialEventKind[
                  transaction.kind.toUpperCase() as keyof typeof FinancialEventKind
                ]
              : transaction.type === 'income'
                ? FinancialEventKind.INCOME
                : FinancialEventKind.EXPENSE,
          amountEtb: transaction.amount,
          category: transaction.category,
          ...(transaction.note ? { note: transaction.note } : {}),
          ...('platform' in transaction && transaction.platform
            ? { platform: transaction.platform }
            : {}),
          occurredAt: input.messageAt,
        })),
      });

      for (const transaction of input.transactions) {
        await this.categoryRepository.upsertAndIncrement(
          input.userId,
          transaction.category,
          transaction.type,
          database,
        );
      }

      await database.event.create({
        data: {
          userId: input.userId,
          ...analyticsEventData(AllowedEventType.TRANSACTION_LOGGED, {
            source:
              input.source === 'VOICE' ? 'voice' : input.source === 'RECEIPT' ? 'receipt' : 'text',
            transactionCount: input.transactions.length,
            kindCounts: input.transactions.reduce<Record<string, number>>((counts, transaction) => {
              const kind = 'kind' in transaction ? transaction.kind : transaction.type;
              counts[kind] = (counts[kind] ?? 0) + 1;
              return counts;
            }, {}),
            otherCount: input.transactions.filter((transaction) =>
              ['other_income', 'other_expense', 'other'].includes(transaction.category),
            ).length,
          }),
        },
      });
      if (input.clarificationResolved) {
        await database.event.create({
          data: {
            userId: input.userId,
            ...analyticsEventData(AllowedEventType.CLARIFICATION_RESOLVED, {
              source:
                input.source === 'VOICE'
                  ? 'voice'
                  : input.source === 'RECEIPT'
                    ? 'receipt'
                    : 'text',
            }),
          },
        });
      }
      if (input.processedUpdateId && input.processedUpdateId !== 0) {
        await database.processedUpdate.update({
          where: { telegramUpdateId: BigInt(input.processedUpdateId) },
          data: {
            userId: input.userId,
            status: 'COMPLETED',
            completedAt: new Date(),
            lastErrorCode: null,
          },
        });
      }
      return { groupId: group.id, firstLog: priorGroupCount === 0 };
    });
  }

  async latestActiveGroup(userId: string): Promise<UndoPreview | null> {
    const group = await this.prisma.transactionGroup.findFirst({
      where: { userId, undoneAt: null },
      orderBy: [{ messageAt: 'desc' }, { createdAt: 'desc' }],
      include: { transactions: { orderBy: { createdAt: 'asc' } } },
    });
    if (!group) return null;
    return {
      groupId: group.id,
      transactions: group.transactions.map((transaction) => ({
        type: transaction.type === 'INCOME' ? 'income' : 'expense',
        amount: transaction.amountEtb.toFixed(2),
        category: transaction.category.toLowerCase(),
        ...(transaction.note ? { note: transaction.note } : {}),
      })),
    };
  }

  undo(userId: string, groupId: string, interactionId: string, processedUpdateId: number) {
    return this.prisma.$transaction(async (database) => {
      const claimed = await database.pendingInteraction.updateMany({
        where: { id: interactionId, userId, state: 'PENDING', expiresAt: { gt: new Date() } },
        data: { state: 'RESOLVED', resolvedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error('INTERACTION_NOT_PENDING');
      const undone = await database.transactionGroup.updateMany({
        where: { id: groupId, userId, undoneAt: null },
        data: { undoneAt: new Date() },
      });
      if (undone.count !== 1) throw new Error('GROUP_NOT_ACTIVE');
      await database.event.create({
        data: {
          userId,
          ...analyticsEventData(AllowedEventType.TRANSACTION_GROUP_UNDONE),
        },
      });
      await database.processedUpdate.update({
        where: { telegramUpdateId: BigInt(processedUpdateId) },
        data: { userId, status: 'COMPLETED', completedAt: new Date(), lastErrorCode: null },
      });
    });
  }

  async undoLatestForUser(userId: string): Promise<UndoPreview | null> {
    const latest = await this.latestActiveGroup(userId);
    if (!latest) return null;

    return this.prisma.$transaction(async (database) => {
      const undone = await database.transactionGroup.updateMany({
        where: { id: latest.groupId, userId, undoneAt: null },
        data: { undoneAt: new Date() },
      });
      if (undone.count !== 1) return null;

      await database.event.create({
        data: {
          userId,
          ...analyticsEventData(AllowedEventType.TRANSACTION_GROUP_UNDONE),
        },
      });

      return latest;
    });
  }
}
