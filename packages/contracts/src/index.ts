export type TransactionType = 'income' | 'expense';
export type TransactionSource = 'text' | 'voice' | 'receipt';
export type Currency = 'ETB';

export const financialEventKinds = [
  'income',
  'expense',
  'loan_received',
  'loan_repayment',
  'refund',
  'reimbursement',
  'transfer',
  'unclear',
] as const;
export type FinancialEventKind = (typeof financialEventKinds)[number];

export const financialEventDirections = ['inflow', 'outflow', 'internal', 'unclear'] as const;
export type FinancialEventDirection = (typeof financialEventDirections)[number];

export const classificationStatuses = ['ready', 'needs_clarification', 'unsupported'] as const;
export const clarificationReasons = [
  'amount_missing',
  'money_direction',
  'ownership',
  'purpose',
  'principal_interest_split',
] as const;

export interface ExtractedTransaction {
  type: TransactionType;
  amount: string;
  currency: Currency;
  category: string;
  note?: string | undefined;
  platform?: string | undefined;
  confidence: number;
}

export interface ExtractionResult {
  transactions: ExtractedTransaction[];
}

export const dashboardPeriods = ['week', 'month', 'custom'] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];

export interface UserProfileResponse {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  language: 'AM' | 'EN';
  status: string;
  consentVersion?: string | null;
  consentAt?: string | null;
  createdAt: string;
}

export interface UpdateLanguageDto {
  language: 'am' | 'en';
}

export interface AcceptConsentDto {
  interactionId?: string;
}

export interface LogTextTransactionDto {
  text: string;
  idempotencyKey?: string;
}

export interface TransactionItemDto {
  id: string;
  type: TransactionType;
  amount: string;
  currency: Currency;
  category: string;
  note?: string | null;
  platform?: string | null;
  createdAt: string;
}

export interface LogTextTransactionResponse {
  status: 'persisted' | 'needs_clarification' | 'needs_confirmation';
  groupId?: string;
  transactions?: TransactionItemDto[];
  interactionId?: string;
  message: string;
}

export interface SummaryMetricsResponse {
  period: string;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netBalanceCents: number;
  transactionCount: number;
  formattedText: string;
}

export interface UserIdentityDto {
  id: string;
  provider: 'TELEGRAM' | 'GOOGLE' | 'APPLE' | 'PHONE' | 'EMAIL';
  providerSubject: string;
  profileDisplayName?: string | null;
  profileUsername?: string | null;
  verifiedAt: string;
}

export interface ConsentStatusResponse {
  version: string;
  status: 'ACTIVE' | 'PENDING_CONSENT';
  userConsented: boolean;
  consentAt?: string | null;
}

export interface NotificationSettingsDto {
  morningReminderEnabled: boolean;
  morningReminderTime: string;
  nightStatusEnabled: boolean;
  nightStatusTime: string;
  weeklySummaryEnabled: boolean;
  monthlySummaryEnabled: boolean;
  updatedAt?: string;
}

export interface UpdateNotificationSettingsDto {
  morningReminderEnabled?: boolean;
  morningReminderTime?: string;
  nightStatusEnabled?: boolean;
  nightStatusTime?: string;
  weeklySummaryEnabled?: boolean;
  monthlySummaryEnabled?: boolean;
  expectedUpdatedAt?: string;
}

export interface MediaUploadResponse {
  jobId: string;
  status: 'queued';
  message: string;
}

export type JobState =
  | 'queued'
  | 'processing'
  | 'needs_clarification'
  | 'needs_confirmation'
  | 'ready'
  | 'saved'
  | 'failed'
  | 'cancelled'
  | 'expired';

export interface JobStatusResponse {
  jobId: string;
  state: JobState;
  draftId?: string | null;
  message?: string | null;
  transactions?: TransactionItemDto[];
  updatedAt: string;
}

export interface ClarifyDraftDto {
  action: 'income' | 'expense' | 'confirm' | 'cancel' | 'category' | 'amount';
  category?: string;
  amount?: string;
}

export interface ConfirmDraftDto {
  confirm: boolean;
}

export interface ApiErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  timestamp: string;
  correlationId?: string;
}
