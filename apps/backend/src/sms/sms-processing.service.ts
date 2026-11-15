import { Injectable } from '@nestjs/common';
import {
  FinancialEventKind,
  InteractionKind,
  InteractionState,
  Prisma,
  TransactionSource,
  TransactionType,
} from '../generated/prisma/client.js';

import { PrismaService } from '../database/prisma.service.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import { type SmsBatchJobData, type SmsBatchProcessResult } from './sms-job.js';

@Injectable()
export class SmsProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: StructuredLogger,
  ) {}

  async processBatch(data: SmsBatchJobData): Promise<SmsBatchProcessResult> {
    const { userId, messages } = data;

    if (!messages || messages.length === 0) {
      return { processed: 0, saved: 0, drafts: 0, duplicates: 0 };
    }

    const smsIds = messages.map((m) => m.smsId).filter(Boolean) as string[];
    const existingSmsIds = new Set<string>();

    if (smsIds.length > 0) {
      const [groupMatches, pendingMatches] = await Promise.all([
        this.prisma.transactionGroup.findMany({
          where: {
            userId,
            OR: smsIds.map((id) => ({ rawTranscript: { endsWith: `:${id}` } })),
          },
          select: { rawTranscript: true },
        }),
        this.prisma.pendingInteraction.findMany({
          where: {
            userId,
            kind: InteractionKind.CLARIFY_FINANCIAL,
            state: InteractionState.PENDING,
          },
          select: { payload: true },
        }),
      ]);

      for (const match of groupMatches) {
        if (match.rawTranscript) {
          const parts = match.rawTranscript.split(':');
          if (parts.length >= 3) {
            existingSmsIds.add(parts.slice(2).join(':'));
          }
        }
      }

      for (const p of pendingMatches) {
        const payload = p.payload as Record<string, unknown> | null;
        if (typeof payload?.smsId === 'string') {
          existingSmsIds.add(payload.smsId);
        }
      }
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    let duplicates = 0;
    let saved = 0;
    let drafts = 0;
    const seenIncomingSmsIds = new Set<string>();

    for (const msg of messages) {
      const rawAmount = Number(msg.amount);
      if (Number.isNaN(rawAmount) || rawAmount <= 0) {
        continue;
      }

      if (msg.smsId) {
        if (existingSmsIds.has(msg.smsId) || seenIncomingSmsIds.has(msg.smsId)) {
          duplicates++;
          continue;
        }
        seenIncomingSmsIds.add(msg.smsId);
      }

      const occurredAt = msg.occurredAt ? new Date(msg.occurredAt) : new Date();
      const note = msg.note || (msg.bankSource ? `From ${msg.bankSource} SMS` : null);
      const typeStr = (msg.type || 'expense').toUpperCase();
      const type = typeStr === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE;
      const category = msg.category?.trim().toLowerCase();

      if (category && category !== 'uncategorized') {
        const telegramMessageId = BigInt(Math.floor(Date.now() * 1000 + Math.random() * 1000));
        const telegramUpdateId = BigInt(0);

        operations.push(
          this.prisma.transactionGroup.create({
            data: {
              userId,
              telegramUpdateId,
              telegramMessageId,
              source: TransactionSource.TEXT,
              messageAt: occurredAt,
              rawTranscript: msg.smsId
                ? `SMS:${msg.bankSource || 'BANK'}:${msg.smsId}`
                : `BANK_SMS:${msg.bankSource || 'BANK'}`,
              extractionModel: 'BANK_SMS_PARSER',
              promptVersion: '1.0',
              transactions: {
                create: [
                  {
                    userId,
                    type,
                    kind:
                      type === TransactionType.INCOME
                        ? FinancialEventKind.INCOME
                        : FinancialEventKind.EXPENSE,
                    amountEtb: new Prisma.Decimal(rawAmount.toFixed(2)),
                    category,
                    note: note ? note.slice(0, 500) : null,
                    occurredAt,
                  },
                ],
              },
            },
          }),
        );
        saved++;
      } else {
        operations.push(
          this.prisma.pendingInteraction.create({
            data: {
              userId,
              kind: InteractionKind.CLARIFY_FINANCIAL,
              state: InteractionState.PENDING,
              payload: {
                amount: rawAmount,
                type: type === TransactionType.INCOME ? 'income' : 'expense',
                category: 'uncategorized',
                bankSource: msg.bankSource || 'BANK',
                occurredAt: occurredAt.toISOString(),
                note: note ? note.slice(0, 500) : null,
                smsId: msg.smsId,
                rawText: msg.rawText,
              },
              expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
          }),
        );
        drafts++;
      }
    }

    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    this.logger.log('Processed SMS batch job', {
      userId,
      processed: messages.length,
      saved,
      drafts,
      duplicates,
    });

    return {
      processed: messages.length,
      saved,
      drafts,
      duplicates,
    };
  }
}
