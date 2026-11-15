export interface AdminUserSession {
  id: string;
  email: string;
  displayName: string;
  role: 'analytics_viewer' | 'super_admin';
}

export interface AdminLoginResponse {
  token: string;
  expiresIn: number;
}

export interface AdminVerifyResponse {
  valid: boolean;
  user: AdminUserSession;
}

export interface AnalyticsCountRate {
  numerator: number;
  denominator: number;
  percentage: string;
}

export interface AnalyticsRetentionMetric extends AnalyticsCountRate {
  eligibleCohortUsers: number;
  retainedUsers: number;
}

export interface AdminUserDirectoryItem {
  id: string;
  telegramId: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  status: string;
  language: string;
  consentVersion?: string | null;
  morningEnabled?: boolean;
  nightEnabled?: boolean;
  createdAt: string;
  transactionGroupCount: number;
  transactionCount: number;
  totalVolumeEtb?: string;
}

export interface PaymentChannelMetric {
  channel: string;
  name: string;
  volumeEtb: string;
  count: number;
  percentage: string;
  color: string;
}

export interface ModalityMetric {
  source: string;
  name: string;
  count: number;
  volumeEtb: string;
  percentage: string;
}

export interface CategoryVarianceMetric {
  category: string;
  currentVolumeEtb: string;
  priorVolumeEtb: string;
  variancePercent: number;
  isFavorable: boolean;
  isNewCategory?: boolean;
}

export interface HourlySpendingMetric {
  hour: string;
  count: number;
  volumeEtb: number;
}

export interface EventKindMetric {
  kind: string;
  label: string;
  count: number;
  volumeEtb: string;
  percentage: string;
  color: string;
}

export interface RailBasketSizeMetric {
  rail: string;
  name: string;
  avgTicketEtb: string;
  totalVolumeEtb: string;
  transactionCount: number;
  sharePercent: string;
  color: string;
}

export interface DataQualityFlags {
  pendingClarifications: number;
  uncategorizedTransactions: number;
  highValueOutliers: number;
  activeCompanionSessions: number;
}

export interface LedgerTransactionItem {
  id: string;
  userHandle: string;
  userName: string;
  avatar: string;
  occurredAt: string;
  category: string;
  source: string;
  bankSource: string;
  amountEtb: string;
  kind: string;
  status: string;
}

export interface HighValueTransactionItem {
  id: string;
  title: string;
  entity: string;
  time: string;
  amountEtb: string;
  isDebit: boolean;
}

export interface AuditTimelineItem {
  id: string;
  time: string;
  eventType: string;
  title: string;
  desc: string;
  badge: string;
  amountEtb?: string;
}

export interface DailyWavePoint {
  day: string;
  current: number;
  prior: number;
  forecast: number;
  transactionCount?: number;
}

export interface AdminAnalyticsReport {
  generatedAt: string;
  asOf: string;
  timezone: string;
  definitions: {
    activeUser: string;
    retention: string;
    deletion: string;
  };
  acquisition: {
    signups: number;
    consentCompletions: number;
    consentConversion: AnalyticsCountRate;
  };
  transactions: {
    loggedGroups: number;
    loggedTransactions: number;
    textGroups: number;
    textTransactions: number;
    voiceGroups: number;
    voiceTransactions: number;
    receiptGroups: number;
    receiptTransactions: number;
    byKind: Record<string, number>;
    otherTransactions: number;
    otherRate: AnalyticsCountRate;
  };
  activeUsers: {
    dau: number;
    wau: number;
    mau: number;
  };
  notifications: {
    eligibleUsers: number;
    usersWithAnyDisabled: number;
    currentOptOutRate: AnalyticsCountRate;
    optOutEvents: number;
  };
  clarifications: {
    requested: number;
    resolved: number;
    failed: number;
    measurableAttempts: number;
    requestRate: AnalyticsCountRate;
    resolutionRate: AnalyticsCountRate;
  };
  extractionQuality: {
    rejectedTransfers: number;
    cancelledConfirmations: number;
    geminiInvalidOutputs: number;
  };
  financials: {
    totalVolumeEtb: string;
    totalExpenseVolumeEtb?: string;
    avgVolumePerUserEtb: string;
    uniqueTransactingUsers?: number;
    topCategories: Array<{ category: string; amountEtb: string; percentage: string }>;
  };
  voicePerformance: {
    avgSttLatencyMs: number;
    avgTotalLatencyMs: number;
    failureCount: number;
    topFailureCodes: Array<{ code: string; count: number }>;
  };
  userDirectory: {
    totalUsers: number;
    activeConsentedUsers: number;
    languageBreakdown: Record<string, number>;
  };
  timeSeries: Array<{
    date: string;
    dau: number;
    wau?: number;
    mau?: number;
    signups?: number;
    transactions: number;
    volumeEtb: string;
  }>;
  dashboard: {
    opens: number;
    weekOpens: number;
    monthOpens: number;
    customOpens: number;
  };
  retention: {
    d7: AnalyticsRetentionMetric;
    d30: AnalyticsRetentionMetric;
  };

  // Extended Data Collection & Financial Intelligence Metrics
  paymentChannels?: PaymentChannelMetric[];
  modalityBreakdown?: ModalityMetric[];
  categoryVariances?: CategoryVarianceMetric[];
  recentLedger?: LedgerTransactionItem[];
  highValueTransactions?: HighValueTransactionItem[];
  activityTimeline?: AuditTimelineItem[];
  dailyWave?: DailyWavePoint[];

  // 100% Authentic Additions
  hourlySpending?: HourlySpendingMetric[];
  eventKinds?: EventKindMetric[];
  railBasketSizes?: RailBasketSizeMetric[];
  dataQuality?: DataQualityFlags;
}

export interface PaginationMetadata {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMetadata;
}

export type AdminUserDirectoryResponse = PaginatedResponse<AdminUserDirectoryItem>;

export interface AdminUserTransactionItem {
  id: string;
  groupId?: string;
  date: string;
  amount: string;
  category: string;
  note: string | null;
  source: string;
  platform?: string | null;
  kind?: string | null;
  rawTranscript?: string | null;
  receiptImagePath?: string | null;
}

export interface AdminUserProfileDetail {
  user: {
    id: string;
    telegramId: string | null;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    photoUrl?: string | null;
    status: string;
    language: string;
    consentVersion?: string | null;
    consentAt?: string | null;
    createdAt: string;
    updatedAt?: string;
    notifications?: {
      morningEnabled?: boolean;
      morningTime?: string;
      eveningEnabled?: boolean;
      nightTime?: string;
    } | null;
  };
  summary: {
    totalTransactions: number;
    totalGroups: number;
    totalVolumeEtb: string;
    textGroups?: number;
    voiceGroups?: number;
    receiptGroups?: number;
  };
  transactions: PaginatedResponse<AdminUserTransactionItem>;
}

export interface AdminSystemHealthServiceItem {
  name: string;
  status: string;
  latencyMs?: number;
}

export interface AdminSystemHealth {
  status: string;
  timestamp: string;
  services: {
    database: AdminSystemHealthServiceItem;
    redis: AdminSystemHealthServiceItem;
    gemini: AdminSystemHealthServiceItem;
    telegram: AdminSystemHealthServiceItem;
  };
}

export interface AdminVoiceErrorItem {
  id: string;
  userId: string;
  eventType: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface AdminAiToolExecution {
  toolName: string;
  args: Record<string, unknown>;
  timestamp?: string;
}

export interface AdminAiFileAttachment {
  fileId: string;
  filename: string;
  format: 'EXCEL' | 'WORD' | 'CSV';
  downloadUrl: string;
  title: string;
  recordCount?: number;
  fileSizeBytes?: number;
}

export interface AdminAiVisualData {
  kpis?: Array<{ label: string; value: string; subtext?: string }>;
  table?: {
    title?: string;
    headers: string[];
    rows: Array<Array<string | number | null>>;
  };
  chart?: {
    title?: string;
    chartType: 'bar' | 'pie' | 'line';
    data: Array<{ label: string; value: number }>;
  };
  fileAttachment?: AdminAiFileAttachment;
}

export interface AdminAiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsExecuted?: AdminAiToolExecution[];
  visualData?: AdminAiVisualData;
  fileAttachment?: AdminAiFileAttachment;
  timestamp?: string;
}

export interface AdminAiChatResponse {
  sessionId: string;
  reply: string;
  toolsExecuted: AdminAiToolExecution[];
  visualData?: AdminAiVisualData;
}

export interface AdminAiDirectExportPayload {
  format: 'EXCEL' | 'WORD';
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  kpis?: Array<{ label: string; value: string }>;
  summary?: string;
}

export interface AdminAiDirectExportResponse {
  token: string;
  filename: string;
  format: 'EXCEL' | 'WORD';
  downloadUrl: string;
  recordCount: number;
  fileSizeBytes: number;
}

export interface AdminAiSessionSummary {
  sessionId: string;
  title?: string;
  lastMessageAt: string;
  turnCount: number;
}

export interface AdminTransactionExplorerItem {
  id: string;
  amount: string;
  category: string;
  kind: string;
  type: string;
  platform: string | null;
  occurredAt: string;
  createdAt: string;
  note: string | null;
  source: string;
  groupId: string;
  group: {
    source: string;
    rawTranscript: string | null;
    receiptImagePath?: string | null;
    sttProvider: string | null;
    sttModel: string | null;
    extractionModel: string | null;
    promptVersion: string | null;
    messageAt: string | null;
  };
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    telegramId: string | null;
  };
}

export interface AdminTransactionsResponse {
  items: AdminTransactionExplorerItem[];
  availableCategories?: string[];
  pagination: PaginationMetadata;
}

export interface AdminTransactionQueryParams {
  page?: number;
  limit?: number;
  platform?: string;
  category?: string;
  kind?: string;
  source?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: 'occurredAt' | 'amountEtb' | 'category' | 'platform';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminPlatformMarketShareItem {
  platform: string;
  volumeEtb: number;
  count: number;
  sharePercentage: number;
  avgTicketSizeEtb: number;
  expenseVolumeEtb: number;
  incomeVolumeEtb: number;
  expenseCount: number;
  incomeCount: number;
}

export interface AdminCategoryPlatformMatrixItem {
  category: string;
  totalVolumeEtb: number;
  totalCount: number;
  topPlatform: string;
  breakdown: Record<string, { volumeEtb: number; count: number; percentage: number }>;
}

export interface AdminPlatformDeepDiveCategory {
  category: string;
  volumeEtb: number;
  count: number;
  percentage: number;
  isIncome: boolean;
}

export interface AdminHourlyActivityBucket {
  hour: number;
  count: number;
  volumeEtb: number;
}

export interface AdminDayOfWeekBucket {
  day: string;
  count: number;
  volumeEtb: number;
}

export interface AdminTicketSizeTiers {
  micro: number;
  small: number;
  medium: number;
  large: number;
  bulk: number;
}

export interface AdminPlatformDeepDiveProfile {
  platform: string;
  volumeEtb: number;
  count: number;
  sharePercentage: number;
  avgTicketSizeEtb: number;
  medianTicketSizeEtb: number;
  minTicketSizeEtb: number;
  maxTicketSizeEtb: number;
  inflow: {
    volumeEtb: number;
    count: number;
    percentage: number;
  };
  outflow: {
    volumeEtb: number;
    count: number;
    percentage: number;
  };
  netCashflowEtb: number;
  topCategories: AdminPlatformDeepDiveCategory[];
  hourlyCurve: AdminHourlyActivityBucket[];
  dayOfWeekCurve: AdminDayOfWeekBucket[];
  ticketSizeTiers: AdminTicketSizeTiers;
  modalitySplit: {
    voice: { count: number; pct: number };
    text: { count: number; pct: number };
    receipt: { count: number; pct: number };
  };
  topNoteKeywords: { word: string; count: number }[];
}

export interface AdminBankingAnalyticsResponse {
  summary: {
    totalVolumeEtb: number;
    totalCount: number;
    leadingPlatform: string;
    leadingCategory: string;
  };
  platformMarketShare: AdminPlatformMarketShareItem[];
  platformDeepDives?: Record<string, AdminPlatformDeepDiveProfile>;
  categoryByPlatformMatrix: AdminCategoryPlatformMatrixItem[];
}
