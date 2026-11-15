export interface KpiMetric {
  label: string;
  value: string;
  subtext?: string | undefined;
  trend?: 'up' | 'down' | 'neutral' | undefined;
}

export interface TablePayload {
  title?: string | undefined;
  headers: string[];
  rows: Array<Array<string | number | null>>;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number | undefined;
  category?: string | undefined;
}

export interface ChartPayload {
  title?: string | undefined;
  chartType: 'bar' | 'pie' | 'line';
  data: ChartDataPoint[];
}

export interface FileAttachmentPayload {
  fileId: string;
  filename: string;
  format: 'EXCEL' | 'WORD' | 'CSV';
  downloadUrl: string;
  title: string;
  recordCount?: number | undefined;
  fileSizeBytes?: number | undefined;
}

export interface VisualDataPayload {
  kpis?: KpiMetric[] | undefined;
  table?: TablePayload | undefined;
  chart?: ChartPayload | undefined;
  fileAttachment?: FileAttachmentPayload | undefined;
}

export interface ToolExecutionRecord {
  toolName: string;
  args: Record<string, unknown>;
  timestamp: string;
}

export interface ChatTurn {
  role: 'user' | 'model' | 'function';
  parts: Array<
    | { text?: string }
    | { functionCall?: { name: string; args?: Record<string, unknown> } }
    | { functionResponse?: { name: string; response: Record<string, unknown> } }
    | Record<string, unknown>
  >;
}

export interface SpendingCategoryStat {
  category: string;
  totalVolume: number;
  formattedVolume: string;
  transactionCount: number;
  percentageShare: number;
  averageTransactionSize: number;
}

export interface SpendingHabitsResult {
  timeframe: string;
  type: string;
  totalVolume: number;
  formattedTotalVolume: string;
  totalCount: number;
  categories: SpendingCategoryStat[];
}

export interface BankMethodStat {
  paymentMethod: string;
  totalVolume: number;
  formattedVolume: string;
  transactionCount: number;
  percentageShare: number;
  averageTransactionSize: number;
}

export interface PaymentMethodDistributionResult {
  timeframe: string;
  totalVolume: number;
  formattedTotalVolume: string;
  totalCount: number;
  platforms: BankMethodStat[];
}

export interface TransactionSummaryItem {
  id: string;
  date: string;
  type: string;
  kind: string;
  amount: number;
  formattedAmount: string;
  category: string;
  paymentMethod: string;
  source: string;
  status: string;
  userName?: string | undefined;
  userTelegramId?: string | undefined;
  merchantOrNote?: string | undefined;
}

export interface TransactionsQueryResult {
  count: number;
  totalVolume: number;
  formattedTotalVolume: string;
  transactions: TransactionSummaryItem[];
}

export interface TransactionDetailResult {
  found: boolean;
  transaction?:
    | {
        id: string;
        date: string;
        type: string;
        kind: string;
        amount: number;
        formattedAmount: string;
        category: string;
        paymentMethod: string;
        source: string;
        status: string;
        rawInputText?: string | undefined;
        audioDurationSeconds?: number | undefined;
        receiptOcrText?: string | undefined;
        receiptImagePath?: string | undefined;
        receiptMediaUrl?: string | undefined;
        extractionConfidence?: number | undefined;
        user: {
          id: string;
          telegramId?: string | undefined;
          name?: string | undefined;
          username?: string | undefined;
          status: string;
        };
      }
    | undefined;
}

export interface UserProfileSummaryResult {
  found: boolean;
  user?:
    | {
        id: string;
        telegramId?: string | undefined;
        name?: string | undefined;
        username?: string | undefined;
        language: string;
        status: string;
        joinedAt: string;
        totalVolume: number;
        formattedTotalVolume: string;
        transactionCount: number;
        preferredPaymentMethod?: string | undefined;
        topCategories: Array<{ category: string; volume: number; share: number }>;
      }
    | undefined;
}

export interface PlatformOverviewResult {
  period: string;
  totalUsers: number;
  activeUsers: number;
  totalVolume: number;
  formattedTotalVolume: string;
  totalTransactions: number;
  sourceBreakdown: {
    voiceCount: number;
    voiceShare: number;
    receiptCount: number;
    receiptShare: number;
    textCount: number;
    textShare: number;
    smsCount: number;
    smsShare: number;
  };
}

export interface HourlyCurvePoint {
  hourEAT: number;
  timeLabel: string;
  volumeEtb: number;
  formattedVolume: string;
  count: number;
  sharePercentage: number;
}

export interface HourlySpendingCurveResult {
  timezone: string;
  timeframe: string;
  totalVolume: number;
  formattedTotalVolume: string;
  totalTransactions: number;
  peakWindow: {
    startHourEAT: number;
    endHourEAT: number;
    label: string;
    volumeEtb: number;
    formattedVolume: string;
    percentageShare: number;
  };
  hourlyCurve: HourlyCurvePoint[];
  dayOfWeekBreakdown: Array<{
    day: string;
    volumeEtb: number;
    formattedVolume: string;
    count: number;
    percentageShare: number;
  }>;
}

export interface CategoryGrowthPoint {
  category: string;
  currentVolume: number;
  formattedCurrentVolume: string;
  previousVolume: number;
  formattedPreviousVolume: string;
  growthPercentage: number;
  netChangeEtb: number;
  formattedNetChange: string;
  trend: 'surging' | 'growing' | 'declining' | 'stable';
}

export interface CategoryTrendsResult {
  currentPeriod: string;
  previousPeriod: string;
  totalCurrentVolume: number;
  formattedCurrentVolume: string;
  totalPreviousVolume: number;
  formattedPreviousVolume: string;
  overallGrowthPercentage: number;
  fastestGrowingCategory?: string | undefined;
  fastestDecliningCategory?: string | undefined;
  categories: CategoryGrowthPoint[];
}

export interface UserCohortRetentionResult {
  totalRegisteredUsers: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
  activeUsersLast90Days: number;
  retentionRate30DayPct: number;
  consentStatusBreakdown: {
    activeUsers: number;
    pendingConsentUsers: number;
    consentRatePct: number;
  };
  languageBreakdown: {
    amharicCount: number;
    amharicPct: number;
    englishCount: number;
    englishPct: number;
  };
  averageTransactionsPerActiveUser: number;
  averageVolumePerActiveUser: string;
}

export interface AiExtractionQualityResult {
  totalLoggedEvents: number;
  totalConfirmedTransactions: number;
  modalityBreakdown: Array<{
    source: string;
    count: number;
    percentageShare: number;
    totalVolumeEtb: number;
    formattedVolume: string;
  }>;
  aiModelsUsed: Array<{
    model: string;
    eventCount: number;
    percentageShare: number;
  }>;
  averageExtractionConfidence: number;
  clarificationCandidateRatePct: number;
}
