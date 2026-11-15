import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { SummaryService } from '../summaries/summary.service.js';
import { DashboardAccessService } from './dashboard-access.service.js';
import type {
  DashboardResponseDto,
  LinkCandidateDto,
  MatchCandidateQueryDto,
  UpdateMiniAppTransactionDto,
} from './dashboard.dto.js';
import { DashboardRepository } from './dashboard.repository.js';

const centsToEtb = (cents: bigint): string => {
  const sign = cents < 0n ? '-' : '';
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};

@Injectable()
export class DashboardService {
  constructor(
    @Inject(SummaryService) private readonly summaries: SummaryService,
    @Inject(DashboardRepository) private readonly repository: DashboardRepository,
    @Inject(DashboardAccessService) private readonly access: DashboardAccessService,
  ) {}

  async get(
    userId: string,
    period: 'today' | 'week' | 'month' | 'all' | 'custom',
    locale: 'am' | 'en',
    limit = 20,
    cursor?: string,
    startDate?: string,
    endDate?: string,
    filters?: { category?: string; source?: 'text' | 'voice' | 'receipt'; search?: string },
  ): Promise<Omit<DashboardResponseDto, 'user'>> {
    await this.access.check(userId, period);
    const summary = await this.summaries.get(userId, period, new Date(), startDate, endDate);
    const [recent, counts] = await Promise.all([
      this.repository.listRecent(userId, summary.range, limit, cursor, filters),
      this.repository.countInPeriod(userId, summary.range),
    ]);
    const hasMore = recent.length > limit;
    const items = hasMore ? recent.slice(0, limit) : recent;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.occurredAt.toISOString() : null;

    return {
      locale,
      period,
      range: { start: summary.range.start.toISOString(), end: summary.range.end.toISOString() },
      totalCount: counts.totalCount,
      uncategorizedCount: counts.uncategorizedCount,
      bankCounts: counts.bankCounts,
      summary: {
        incomeEtb: centsToEtb(summary.incomeCents),
        expenseEtb: centsToEtb(summary.expenseCents),
        netEtb: centsToEtb(summary.netCents),
        earnedIncomeEtb: centsToEtb(summary.earnedIncomeCents),
        ordinaryExpenseEtb: centsToEtb(summary.ordinaryExpenseCents),
        earnedNetEtb: centsToEtb(summary.earnedNetCents),
        cashInflowEtb: centsToEtb(summary.cashInflowCents),
        cashOutflowEtb: centsToEtb(summary.cashOutflowCents),
        cashFlowNetEtb: centsToEtb(summary.cashFlowNetCents),
      },
      expenseCategories: summary.categories.map((category) => ({
        category: category.category,
        amountEtb: centsToEtb(category.amountCents),
        percentage: Number(category.percentageHundredths) / 100,
      })),
      specialMovements: summary.specialMovements.map((movement) => ({
        kind: movement.kind,
        amountEtb: centsToEtb(movement.amountCents),
      })),
      recentTransactions: items.map((transaction) => ({
        id: transaction.id,
        kind: transaction.kind.toLowerCase() as DashboardResponseDto['recentTransactions'][number]['kind'],
        type: transaction.type === 'INCOME' ? 'income' : 'expense',
        amountEtb: transaction.amountEtb.toFixed(2),
        category: transaction.category.toLowerCase(),
        note: transaction.note,
        platform: 'platform' in transaction && transaction.platform ? transaction.platform : null,
        source:
          (transaction.group?.source?.toLowerCase() as 'text' | 'voice' | 'receipt') ?? 'text',
        rawTranscript: transaction.group?.rawTranscript ?? null,
        receiptImagePath: transaction.group?.receiptImagePath ?? null,
        occurredAt: transaction.occurredAt.toISOString(),
      })),
      nextCursor,
      hasMore,
    };
  }

  async createTransaction(
    userId: string,
    dto: {
      type: 'expense' | 'income';
      amountEtb: string;
      category: string;
      note?: string;
      platform?: string;
      source?: 'text' | 'voice' | 'receipt';
      receiptTempId?: string;
    },
  ) {
    return this.repository.createTransaction(userId, dto);
  }

  async updateTransaction(userId: string, transactionId: string, dto: UpdateMiniAppTransactionDto) {
    const updated = await this.repository.updateTransaction(userId, transactionId, dto);
    if (!updated) {
      throw new NotFoundException('Transaction not found');
    }
    return updated;
  }

  async findMatchCandidates(userId: string, query: MatchCandidateQueryDto) {
    return this.repository.findMatchCandidates(userId, query);
  }

  async linkCandidate(userId: string, dto: LinkCandidateDto) {
    const linked = await this.repository.linkCandidate(userId, dto);
    if (!linked) {
      throw new NotFoundException('Candidate transaction or interaction not found');
    }
    return linked;
  }
}
