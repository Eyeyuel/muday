export type DashboardPeriod = 'today' | 'week' | 'month' | 'all' | 'custom';
export type Locale = 'am' | 'en';

export interface DashboardFilterOptions {
  startDate?: string;
  endDate?: string;
  category?: string;
  source?: 'text' | 'voice' | 'receipt';
  search?: string;
}

export interface DashboardResponse {
  locale: Locale;
  user: {
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
  period: DashboardPeriod;
  range: { start: string; end: string };
  totalCount?: number;
  uncategorizedCount?: number;
  bankCounts?: Record<string, number>;
  summary: {
    incomeEtb: string;
    expenseEtb: string;
    netEtb: string;
    earnedIncomeEtb: string;
    ordinaryExpenseEtb: string;
    earnedNetEtb: string;
    cashInflowEtb: string;
    cashOutflowEtb: string;
    cashFlowNetEtb: string;
  };
  expenseCategories: Array<{ category: string; amountEtb: string; percentage: number }>;
  specialMovements: Array<{
    kind: 'loan_received' | 'loan_repayment' | 'refund' | 'reimbursement';
    amountEtb: string;
  }>;
  recentTransactions: Array<{
    id?: string;
    kind: 'income' | 'expense' | 'loan_received' | 'loan_repayment' | 'refund' | 'reimbursement';
    type: 'income' | 'expense';
    amountEtb: string;
    category: string;
    note: string | null;
    platform?: string | null;
    source?: 'text' | 'voice' | 'receipt';
    rawTranscript?: string | null;
    receiptImagePath?: string | null;
    occurredAt: string;
  }>;
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface CreateTransactionInput {
  type: 'expense' | 'income';
  amountEtb: string;
  category: string;
  note?: string;
  platform?: string;
  source?: 'text' | 'voice' | 'receipt';
}

export type DashboardErrorKind = 'auth' | 'rate' | 'service' | 'network' | 'invalid';

export class DashboardApiError extends Error {
  constructor(readonly kind: DashboardErrorKind) {
    super(kind);
  }
}

export interface MatchCandidateItem {
  id: string;
  targetType: 'transaction' | 'pending_interaction';
  amountEtb: string;
  type: 'expense' | 'income';
  category: string;
  note: string | null;
  bankSource: string;
  occurredAt: string;
  reference?: string;
}

export interface LinkCandidatePayload {
  targetId: string;
  targetType: 'transaction' | 'pending_interaction';
  category: string;
  note?: string;
  type?: 'expense' | 'income';
}
