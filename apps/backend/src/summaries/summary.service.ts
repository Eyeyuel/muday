import { Inject, Injectable } from '@nestjs/common';

import { decimalToCents, roundedPercentageHundredths } from './summary-money.js';
import { summaryPeriodRanges, type SummaryPeriodKind } from './summary-period.js';
import { SummaryRepository } from './summary.repository.js';
import type {
  ExpenseComparison,
  FinancialSummary,
  SummaryCategory,
  SummaryInsight,
  SummaryTransactionRow,
} from './summary.types.js';

@Injectable()
export class SummaryService {
  constructor(@Inject(SummaryRepository) private readonly repository: SummaryRepository) {}

  async get(
    userId: string,
    period: SummaryPeriodKind,
    now: Date = new Date(),
    startDate?: string,
    endDate?: string,
  ): Promise<FinancialSummary> {
    const ranges = summaryPeriodRanges(period, now, startDate, endDate);
    const [current, previous] = await Promise.all([
      this.repository.listActiveTransactions(userId, ranges.current),
      this.repository.listActiveTransactions(userId, ranges.previous),
    ]);
    const earnedIncomeCents = this.totalKind(current, 'income');
    const grossOrdinaryExpenseCents = this.totalKind(current, 'expense');
    const recoveredExpenseCents =
      this.totalKind(current, 'refund') + this.totalKind(current, 'reimbursement');
    const ordinaryExpenseCents = grossOrdinaryExpenseCents - recoveredExpenseCents;
    const earnedNetCents = earnedIncomeCents - ordinaryExpenseCents;
    const cashInflowCents = current
      .filter((row) => ['income', 'loan_received', 'refund', 'reimbursement'].includes(row.kind))
      .reduce((total, row) => total + decimalToCents(row.amount), 0n);
    const cashOutflowCents = current
      .filter((row) => ['expense', 'loan_repayment'].includes(row.kind))
      .reduce((total, row) => total + decimalToCents(row.amount), 0n);
    const cashFlowNetCents = cashInflowCents - cashOutflowCents;
    const previousOrdinaryExpenses =
      this.totalKind(previous, 'expense') -
      this.totalKind(previous, 'refund') -
      this.totalKind(previous, 'reimbursement');
    const categories = this.categoryTotals(current, grossOrdinaryExpenseCents);
    const largestExpense = this.largestExpense(current);
    const specialMovements = (
      ['loan_received', 'loan_repayment', 'refund', 'reimbursement'] as const
    )
      .map((kind) => ({ kind, amountCents: this.totalKind(current, kind) }))
      .filter(({ amountCents }) => amountCents !== 0n);
    return {
      period,
      range: ranges.current,
      incomeCents: earnedIncomeCents,
      expenseCents: ordinaryExpenseCents,
      netCents: earnedNetCents,
      earnedIncomeCents,
      grossOrdinaryExpenseCents,
      recoveredExpenseCents,
      ordinaryExpenseCents,
      earnedNetCents,
      cashInflowCents,
      cashOutflowCents,
      cashFlowNetCents,
      specialMovements,
      transactionCount: current.length,
      categories,
      largestExpense,
      comparison: this.compareExpenses(ordinaryExpenseCents, previousOrdinaryExpenses),
      insight: this.insight(
        current.length,
        ordinaryExpenseCents,
        earnedNetCents,
        categories[0]?.category,
      ),
    };
  }

  private total(rows: SummaryTransactionRow[], type: 'income' | 'expense'): bigint {
    return rows
      .filter((row) => row.type === type)
      .reduce((total, row) => total + decimalToCents(row.amount), 0n);
  }

  private totalKind(rows: SummaryTransactionRow[], kind: SummaryTransactionRow['kind']): bigint {
    return rows
      .filter((row) => row.kind === kind)
      .reduce((total, row) => total + decimalToCents(row.amount), 0n);
  }

  private categoryTotals(rows: SummaryTransactionRow[], expenses: bigint) {
    const totals = new Map<SummaryCategory, bigint>();
    for (const row of rows) {
      if (row.kind !== 'expense') continue;
      totals.set(row.category, (totals.get(row.category) ?? 0n) + decimalToCents(row.amount));
    }
    return [...totals.entries()]
      .map(([category, amountCents]) => ({
        category,
        amountCents,
        percentageHundredths: roundedPercentageHundredths(amountCents, expenses),
      }))
      .sort((left, right) => {
        if (left.amountCents !== right.amountCents) {
          return left.amountCents > right.amountCents ? -1 : 1;
        }
        return left.category.localeCompare(right.category);
      })
      .slice(0, 3);
  }

  private largestExpense(rows: SummaryTransactionRow[]): SummaryTransactionRow | null {
    return (
      rows
        .filter((row) => row.kind === 'expense')
        .sort((left, right) => {
          const leftAmount = decimalToCents(left.amount);
          const rightAmount = decimalToCents(right.amount);
          if (leftAmount !== rightAmount) return leftAmount > rightAmount ? -1 : 1;
          return (
            left.occurredAt.getTime() - right.occurredAt.getTime() ||
            left.id.localeCompare(right.id)
          );
        })[0] ?? null
    );
  }

  private compareExpenses(current: bigint, previous: bigint): ExpenseComparison {
    if (current < 0n) {
      return { direction: 'recovery_exceeded', amountCents: -current, percentageHundredths: null };
    }
    if (current === previous) {
      return { direction: 'unchanged', amountCents: 0n, percentageHundredths: 0n };
    }
    const difference = current > previous ? current - previous : previous - current;
    if (previous === 0n) {
      return { direction: 'no_prior', amountCents: current, percentageHundredths: null };
    }
    if (current < 0n || previous < 0n) {
      return {
        direction: current > previous ? 'decreased' : 'increased',
        amountCents: difference,
        percentageHundredths: roundedPercentageHundredths(
          difference,
          previous < 0n ? -previous : previous,
        ),
      };
    }
    return {
      direction: current > previous ? 'increased' : 'decreased',
      amountCents: difference,
      percentageHundredths: roundedPercentageHundredths(
        difference,
        previous < 0n ? -previous : previous,
      ),
    };
  }

  private insight(
    count: number,
    expenses: bigint,
    net: bigint,
    topCategory?: SummaryCategory,
  ): SummaryInsight {
    if (count === 0) return { kind: 'no_activity' };
    if (expenses === 0n) return { kind: 'no_expenses' };
    if (net < 0n) return { kind: 'negative_net' };
    if (topCategory) return { kind: 'top_category', category: topCategory };
    return { kind: 'balanced' };
  }
}
