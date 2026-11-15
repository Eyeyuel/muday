import { authentication } from '../telegram/telegram-webapp';
import {
  DashboardApiError,
  type DashboardFilterOptions,
  type DashboardPeriod,
  type DashboardResponse,
  type LinkCandidatePayload,
  type MatchCandidateItem,
} from './dashboard-types';

const moneyPattern = /^-?\d+\.\d{2}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseResponse(value: unknown): DashboardResponse {
  if (!isObject(value) || (value.locale !== 'am' && value.locale !== 'en')) {
    throw new DashboardApiError('invalid');
  }
  if (
    value.period !== 'today' &&
    value.period !== 'week' &&
    value.period !== 'month' &&
    value.period !== 'all' &&
    value.period !== 'custom'
  ) {
    throw new DashboardApiError('invalid');
  }
  if (
    !isObject(value.user) ||
    (value.user.firstName !== null && typeof value.user.firstName !== 'string') ||
    (value.user.lastName !== null && typeof value.user.lastName !== 'string') ||
    (value.user.username !== null && typeof value.user.username !== 'string')
  ) {
    throw new DashboardApiError('invalid');
  }
  if (
    !isObject(value.range) ||
    typeof value.range.start !== 'string' ||
    typeof value.range.end !== 'string'
  ) {
    throw new DashboardApiError('invalid');
  }
  if (!isObject(value.summary)) throw new DashboardApiError('invalid');
  const {
    incomeEtb,
    expenseEtb,
    netEtb,
    earnedIncomeEtb,
    ordinaryExpenseEtb,
    earnedNetEtb,
    cashInflowEtb,
    cashOutflowEtb,
    cashFlowNetEtb,
  } = value.summary;
  const summaryMoney = [
    incomeEtb,
    expenseEtb,
    netEtb,
    earnedIncomeEtb,
    ordinaryExpenseEtb,
    earnedNetEtb,
    cashInflowEtb,
    cashOutflowEtb,
    cashFlowNetEtb,
  ];
  if (summaryMoney.some((amount) => typeof amount !== 'string' || !moneyPattern.test(amount))) {
    throw new DashboardApiError('invalid');
  }
  if (
    !Array.isArray(value.expenseCategories) ||
    !Array.isArray(value.specialMovements) ||
    !Array.isArray(value.recentTransactions)
  ) {
    throw new DashboardApiError('invalid');
  }
  const categories = value.expenseCategories.map((entry) => {
    if (
      !isObject(entry) ||
      typeof entry.category !== 'string' ||
      typeof entry.amountEtb !== 'string' ||
      !moneyPattern.test(entry.amountEtb) ||
      typeof entry.percentage !== 'number' ||
      !Number.isFinite(entry.percentage)
    ) {
      throw new DashboardApiError('invalid');
    }
    return {
      category: entry.category,
      amountEtb: entry.amountEtb,
      percentage: Math.max(0, Math.min(100, entry.percentage)),
    };
  });
  const movementKinds = ['loan_received', 'loan_repayment', 'refund', 'reimbursement'] as const;
  const specialMovements = value.specialMovements.map((entry) => {
    if (
      !isObject(entry) ||
      !movementKinds.includes(entry.kind as (typeof movementKinds)[number]) ||
      typeof entry.amountEtb !== 'string' ||
      !moneyPattern.test(entry.amountEtb)
    ) {
      throw new DashboardApiError('invalid');
    }
    return {
      kind: entry.kind as (typeof movementKinds)[number],
      amountEtb: entry.amountEtb,
    };
  });
  const transactionKinds = ['income', 'expense', ...movementKinds] as const;
  const transactions = value.recentTransactions.map((entry) => {
    if (
      !isObject(entry) ||
      !transactionKinds.includes(entry.kind as (typeof transactionKinds)[number]) ||
      (entry.type !== 'income' && entry.type !== 'expense') ||
      typeof entry.amountEtb !== 'string' ||
      !moneyPattern.test(entry.amountEtb) ||
      typeof entry.category !== 'string' ||
      (entry.note !== null && typeof entry.note !== 'string') ||
      typeof entry.occurredAt !== 'string'
    ) {
      throw new DashboardApiError('invalid');
    }
    const type: 'income' | 'expense' = entry.type;
    const source: 'text' | 'voice' | 'receipt' | undefined =
      entry.source === 'text' || entry.source === 'voice' || entry.source === 'receipt'
        ? entry.source
        : undefined;
    const id = typeof entry.id === 'string' ? entry.id : undefined;
    const platform =
      typeof entry.platform === 'string'
        ? entry.platform
        : entry.platform === null
          ? null
          : undefined;
    const rawTranscript =
      typeof entry.rawTranscript === 'string'
        ? entry.rawTranscript
        : entry.rawTranscript === null
          ? null
          : undefined;
    const receiptImagePath =
      typeof entry.receiptImagePath === 'string'
        ? entry.receiptImagePath
        : entry.receiptImagePath === null
          ? null
          : undefined;
    return {
      id,
      kind: entry.kind as (typeof transactionKinds)[number],
      type,
      amountEtb: entry.amountEtb,
      category: entry.category,
      note: entry.note,
      platform,
      source,
      rawTranscript,
      receiptImagePath,
      occurredAt: entry.occurredAt,
    };
  });
  const nextCursor =
    typeof value.nextCursor === 'string' || value.nextCursor === null
      ? value.nextCursor
      : undefined;
  const hasMore = typeof value.hasMore === 'boolean' ? value.hasMore : undefined;
  const totalCount = typeof value.totalCount === 'number' ? value.totalCount : undefined;
  const uncategorizedCount =
    typeof value.uncategorizedCount === 'number' ? value.uncategorizedCount : undefined;
  const bankCounts =
    isObject(value.bankCounts) &&
    Object.values(value.bankCounts).every((v) => typeof v === 'number')
      ? (value.bankCounts as Record<string, number>)
      : undefined;

  return {
    locale: value.locale,
    user: {
      firstName: value.user.firstName,
      lastName: value.user.lastName,
      username: value.user.username,
    },
    period: value.period,
    range: { start: value.range.start, end: value.range.end },
    totalCount,
    uncategorizedCount,
    bankCounts,
    summary: {
      incomeEtb,
      expenseEtb,
      netEtb,
      earnedIncomeEtb,
      ordinaryExpenseEtb,
      earnedNetEtb,
      cashInflowEtb,
      cashOutflowEtb,
      cashFlowNetEtb,
    } as DashboardResponse['summary'],
    expenseCategories: categories,
    specialMovements,
    recentTransactions: transactions,
    nextCursor,
    hasMore,
  };
}

export async function fetchDashboard(
  period: DashboardPeriod,
  filters?: DashboardFilterOptions,
  cursor?: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<{ data: DashboardResponse; development: boolean }> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    throw new DashboardApiError('auth');
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  let response: Response;
  const params = new URLSearchParams({ period, limit: String(limit) });
  if (cursor) params.append('cursor', cursor);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.source) params.append('source', filters.source);
  if (filters?.search?.trim()) params.append('search', filters.search.trim());

  try {
    response = await fetch(`${baseUrl}/api/dashboard?${params.toString()}`, {
      headers: { Authorization: auth.header },
      signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error as { name?: string })?.name === 'AbortError'
    ) {
      throw error;
    }
    throw new DashboardApiError('network');
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new DashboardApiError('auth');
    if (response.status === 429) throw new DashboardApiError('rate');
    if (response.status === 503) throw new DashboardApiError('service');
    throw new DashboardApiError('invalid');
  }
  try {
    return { data: parseResponse(await response.json()), development: auth.development };
  } catch (error) {
    if (error instanceof DashboardApiError) throw error;
    throw new DashboardApiError('invalid');
  }
}

export async function createDashboardTransaction(dto: {
  type: 'expense' | 'income';
  amountEtb: string;
  category: string;
  note?: string;
  platform?: string;
  source?: 'text' | 'voice' | 'receipt';
  receiptTempId?: string;
}): Promise<{ success: boolean; id?: string }> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    throw new DashboardApiError('auth');
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const response = await fetch(`${baseUrl}/api/dashboard/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth.header,
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new DashboardApiError('auth');
    throw new DashboardApiError('invalid');
  }

  return (await response.json()) as { success: boolean; id?: string };
}

export async function fetchDashboardCategories(): Promise<{
  userCategories: Array<{ label: string; type: string }>;
  defaultExpenseCategories: string[];
  defaultIncomeCategories: string[];
}> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    throw new DashboardApiError('auth');
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const response = await fetch(`${baseUrl}/api/dashboard/categories`, {
    headers: {
      Authorization: auth.header,
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new DashboardApiError('auth');
    throw new DashboardApiError('invalid');
  }

  return (await response.json()) as {
    userCategories: Array<{ label: string; type: string }>;
    defaultExpenseCategories: string[];
    defaultIncomeCategories: string[];
  };
}

export async function updateDashboardTransaction(
  id: string,
  dto: {
    amountEtb?: string;
    type?: 'expense' | 'income';
    category?: string;
    note?: string;
    platform?: string | null;
  },
): Promise<{
  id: string;
  amountEtb: string;
  category: string;
  type: 'expense' | 'income';
  note: string | null;
  platform?: string | null;
  occurredAt: string;
}> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    throw new DashboardApiError('auth');
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const response = await fetch(`${baseUrl}/api/dashboard/transactions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth.header,
    },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new DashboardApiError('auth');
    throw new DashboardApiError('invalid');
  }

  return (await response.json()) as {
    id: string;
    amountEtb: string;
    category: string;
    type: 'expense' | 'income';
    note: string | null;
    platform?: string | null;
    occurredAt: string;
  };
}

export async function scanReceiptImage(file: File): Promise<{
  success: boolean;
  amount: string;
  category: string;
  merchant: string;
  platform?: string;
  confidence?: number;
  message?: string;
  receiptTempId?: string;
}> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    throw new DashboardApiError('auth');
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${baseUrl}/api/dashboard/receipt`, {
    method: 'POST',
    headers: {
      Authorization: auth.header,
    },
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new DashboardApiError('auth');
    throw new DashboardApiError('invalid');
  }

  return (await response.json()) as {
    success: boolean;
    amount: string;
    category: string;
    merchant: string;
    platform?: string;
    confidence?: number;
    message?: string;
    receiptTempId?: string;
  };
}

export async function parseTransactionText(text: string): Promise<{
  success: boolean;
  amount: string;
  type: 'income' | 'expense';
  category: string;
  note: string;
  platform?: string;
  confidence?: number;
  message?: string;
}> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    throw new DashboardApiError('auth');
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const response = await fetch(`${baseUrl}/api/dashboard/parse-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth.header,
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new DashboardApiError('auth');
    throw new DashboardApiError('invalid');
  }

  return (await response.json()) as {
    success: boolean;
    amount: string;
    type: 'income' | 'expense';
    category: string;
    note: string;
    platform?: string;
    confidence?: number;
    message?: string;
  };
}

export async function sendVoiceAudio(
  audioBlob?: Blob,
  transcriptText?: string,
): Promise<{
  success: boolean;
  transcript: string;
  amount: string;
  type: 'income' | 'expense';
  category: string;
  note: string;
  platform?: string;
  message?: string;
}> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    throw new DashboardApiError('auth');
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const formData = new FormData();
  if (audioBlob) {
    const filename = audioBlob.type.includes('wav') ? 'voice.wav' : 'voice.webm';
    formData.append('file', audioBlob, filename);
  }
  if (transcriptText) {
    formData.append('transcript', transcriptText);
  }

  const response = await fetch(`${baseUrl}/api/dashboard/voice`, {
    method: 'POST',
    headers: {
      Authorization: auth.header,
    },
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new DashboardApiError('auth');
    throw new DashboardApiError('invalid');
  }

  return (await response.json()) as {
    success: boolean;
    transcript: string;
    amount: string;
    type: 'income' | 'expense';
    category: string;
    note: string;
    message?: string;
  };
}

export async function fetchMatchCandidates(
  amountEtb: string,
  type?: 'expense' | 'income',
  occurredAt?: string,
): Promise<MatchCandidateItem[]> {
  const num = parseFloat(amountEtb);
  if (isNaN(num) || num <= 0) return [];

  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    return [];
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const params = new URLSearchParams({ amountEtb });
  if (type) params.append('type', type);
  if (occurredAt) params.append('occurredAt', occurredAt);

  try {
    const response = await fetch(`${baseUrl}/api/dashboard/match-candidates?${params.toString()}`, {
      headers: {
        Authorization: auth.header,
      },
    });

    if (!response.ok) return [];
    const data = (await response.json()) as MatchCandidateItem[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function linkCandidateTransaction(payload: LinkCandidatePayload): Promise<{
  id: string;
  amountEtb: string;
  category: string;
  type: 'expense' | 'income';
  note: string | null;
  occurredAt: string;
  linked: boolean;
}> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    throw new DashboardApiError('auth');
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const response = await fetch(`${baseUrl}/api/dashboard/link-candidate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth.header,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new DashboardApiError('auth');
    throw new DashboardApiError('invalid');
  }

  return (await response.json()) as {
    id: string;
    amountEtb: string;
    category: string;
    type: 'expense' | 'income';
    note: string | null;
    occurredAt: string;
    linked: boolean;
  };
}

export async function fetchTransactionReceiptBlobUrl(transactionId: string): Promise<string> {
  let auth: ReturnType<typeof authentication>;
  try {
    auth = authentication();
  } catch {
    throw new DashboardApiError('auth');
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3001';
  const response = await fetch(
    `${baseUrl}/api/dashboard/transactions/${encodeURIComponent(transactionId)}/receipt-image`,
    {
      headers: {
        Authorization: auth.header,
      },
    },
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new DashboardApiError('auth');
    if (response.status === 404) throw new DashboardApiError('invalid');
    throw new DashboardApiError('service');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
