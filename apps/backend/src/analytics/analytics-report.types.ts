export interface CountRate {
  numerator: number;
  denominator: number;
  percentage: string;
}

export interface RetentionMetric extends CountRate {
  eligibleCohortUsers: number;
  retainedUsers: number;
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

export interface AnalyticsReport {
  generatedAt: string;
  asOf: string;
  timezone: 'Africa/Addis_Ababa';
  definitions: {
    activeUser: string;
    retention: string;
    deletion: string;
  };
  acquisition: {
    signups: number;
    consentCompletions: number;
    consentConversion: CountRate;
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
    otherRate: CountRate;
  };
  activeUsers: { dau: number; wau: number; mau: number };
  notifications: {
    eligibleUsers: number;
    usersWithAnyDisabled: number;
    currentOptOutRate: CountRate;
    optOutEvents: number;
  };
  clarifications: {
    requested: number;
    resolved: number;
    failed: number;
    measurableAttempts: number;
    requestRate: CountRate;
    resolutionRate: CountRate;
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
  dashboard: { opens: number; weekOpens: number; monthOpens: number; customOpens: number };
  retention: { d7: RetentionMetric; d30: RetentionMetric };

  // Data Collection & Financial Intelligence Extensions
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
