import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { InteractionKind, InteractionState } from '../generated/prisma/client.js';
import type { PendingDraftPayload } from '../interactions/interaction-payload.schema.js';
import type { DateRange } from './summary-period.js';
import type { SummaryTransactionRow } from './summary.types.js';

@Injectable()
export class SummaryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listActiveTransactions(userId: string, range: DateRange): Promise<SummaryTransactionRow[]> {
    const [transactions, pendingDrafts] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          occurredAt: { gte: range.start, lt: range.end },
          group: { undoneAt: null },
        },
        select: {
          id: true,
          kind: true,
          type: true,
          amountEtb: true,
          category: true,
          occurredAt: true,
        },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.pendingInteraction.findMany({
        where: {
          userId,
          kind: InteractionKind.CLARIFY_FINANCIAL,
          state: InteractionState.PENDING,
        },
        select: {
          id: true,
          payload: true,
          createdAt: true,
        },
      }),
    ]);

    const txRows: SummaryTransactionRow[] = transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type === 'INCOME' ? 'income' : 'expense',
      kind: transaction.kind.toLowerCase() as SummaryTransactionRow['kind'],
      amount: transaction.amountEtb.toFixed(2),
      category: transaction.category.toLowerCase(),
      occurredAt: transaction.occurredAt,
    }));

    const pendingRows: SummaryTransactionRow[] = pendingDrafts
      .map((p) => {
        const payload = (p.payload as unknown as PendingDraftPayload | null) ?? {};
        const amountVal =
          payload.amount ?? payload.event?.amount ?? payload.readyTransactions?.[0]?.amount ?? '0';
        const occurredAt = payload.occurredAt
          ? new Date(payload.occurredAt)
          : payload.messageAt
            ? new Date(payload.messageAt)
            : p.createdAt;
        const isIncome = payload.type === 'income';

        return {
          id: p.id,
          type: isIncome ? ('income' as const) : ('expense' as const),
          kind: isIncome ? ('income' as const) : ('expense' as const),
          amount: Number(amountVal).toFixed(2),
          category: 'uncategorized',
          occurredAt,
        };
      })
      .filter((p) => p.occurredAt >= range.start && p.occurredAt < range.end);

    const allRows = [...txRows, ...pendingRows];
    allRows.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    return allRows;
  }
}
