import type { FinancialEventKind } from '@mezgeb/contracts';
import type { DateRange, SummaryPeriodKind } from './summary-period.js';

export type SummaryCategory = string;

export interface SummaryTransactionRow {
  id: string;
  type: 'income' | 'expense';
  kind: Exclude<FinancialEventKind, 'transfer' | 'unclear'>;
  amount: string;
  category: SummaryCategory;
  occurredAt: Date;
}

export interface CategorySummary {
  category: SummaryCategory;
  amountCents: bigint;
  percentageHundredths: bigint;
}

export type ExpenseComparison =
  | { direction: 'unchanged'; amountCents: 0n; percentageHundredths: 0n }
  | { direction: 'recovery_exceeded'; amountCents: bigint; percentageHundredths: null }
  | { direction: 'no_prior'; amountCents: bigint; percentageHundredths: null }
  | {
      direction: 'increased' | 'decreased';
      amountCents: bigint;
      percentageHundredths: bigint;
    };

export type SummaryInsight =
  | { kind: 'no_activity' }
  | { kind: 'no_expenses' }
  | { kind: 'top_category'; category: SummaryCategory }
  | { kind: 'negative_net' }
  | { kind: 'balanced' };

export interface FinancialSummary {
  period: SummaryPeriodKind;
  range: DateRange;
  incomeCents: bigint;
  expenseCents: bigint;
  netCents: bigint;
  earnedIncomeCents: bigint;
  grossOrdinaryExpenseCents: bigint;
  recoveredExpenseCents: bigint;
  ordinaryExpenseCents: bigint;
  earnedNetCents: bigint;
  cashInflowCents: bigint;
  cashOutflowCents: bigint;
  cashFlowNetCents: bigint;
  specialMovements: Array<{
    kind: 'loan_received' | 'loan_repayment' | 'refund' | 'reimbursement';
    amountCents: bigint;
  }>;
  transactionCount: number;
  categories: CategorySummary[];
  largestExpense: SummaryTransactionRow | null;
  comparison: ExpenseComparison;
  insight: SummaryInsight;
}
