export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<
      string,
      {
        type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
        description: string;
        enum?: string[];
        items?: { type: string };
      }
    >;
    required?: string[];
  };
}

export const ADMIN_AI_TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: 'getSpendingHabitsAndCategoryAnalytics',
    description:
      'Analyzes consumer spending habits, top expense/income categories, wallet share percentages, and average transaction sizes across users or for specific cohorts in Ethiopia.',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: {
          type: 'STRING',
          description: 'Optional ISO-8601 start date (e.g. "2026-08-01") or relative date.',
        },
        endDate: {
          type: 'STRING',
          description: 'Optional ISO-8601 end date (e.g. "2026-08-31").',
        },
        type: {
          type: 'STRING',
          description: 'Transaction direction/type to analyze: "EXPENSE" (default) or "INCOME".',
          enum: ['EXPENSE', 'INCOME'],
        },
        limit: {
          type: 'INTEGER',
          description: 'Maximum number of top categories to return (default: 10, max: 25).',
        },
      },
    },
  },
  {
    name: 'getPaymentMethodAndBankDistribution',
    description:
      'Analyzes transaction volume, transaction counts, and market share across Ethiopian payment channels including Telebirr, CBE (Commercial Bank of Ethiopia), Bank of Abyssinia, Awash, Dashen, CBE Birr, and Cash.',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: {
          type: 'STRING',
          description: 'Optional ISO-8601 start date (e.g. "2026-08-01").',
        },
        endDate: {
          type: 'STRING',
          description: 'Optional ISO-8601 end date (e.g. "2026-08-31").',
        },
        category: {
          type: 'STRING',
          description:
            'Optional spending category filter to analyze platform share for a specific category (e.g. "food", "transport", "utilities").',
        },
        minAmount: {
          type: 'NUMBER',
          description: 'Optional minimum transaction amount filter in ETB.',
        },
      },
    },
  },
  {
    name: 'queryTransactions',
    description:
      'Searches, filters, and paginates through transaction records matching specific multi-attribute criteria (dates, user, bank, category, amount thresholds).',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: {
          type: 'STRING',
          description: 'Optional ISO-8601 start date filter.',
        },
        endDate: {
          type: 'STRING',
          description: 'Optional ISO-8601 end date filter.',
        },
        userId: {
          type: 'STRING',
          description: 'Optional user UUID filter.',
        },
        telegramId: {
          type: 'STRING',
          description: 'Optional Telegram user numerical ID filter.',
        },
        category: {
          type: 'STRING',
          description: 'Optional category filter.',
        },
        paymentMethod: {
          type: 'STRING',
          description:
            'Optional payment method/bank filter (e.g. "telebirr", "cbe", "cash", "boa", "dashen", "awash").',
        },
        minAmount: {
          type: 'NUMBER',
          description: 'Optional minimum amount in ETB.',
        },
        maxAmount: {
          type: 'NUMBER',
          description: 'Optional maximum amount in ETB.',
        },
        limit: {
          type: 'INTEGER',
          description: 'Maximum number of transactions to retrieve (default: 20, max: 100).',
        },
      },
    },
  },
  {
    name: 'getTransactionDetail',
    description:
      'Retrieves the complete forensic audit detail of a single specific transaction by ID, including original voice audio transcript, OCR receipt scan text, categorization confidence, and user context.',
    parameters: {
      type: 'OBJECT',
      properties: {
        transactionId: {
          type: 'STRING',
          description: 'The unique UUID of the transaction to inspect.',
        },
      },
      required: ['transactionId'],
    },
  },
  {
    name: 'getUserProfileAndBehaviorSummary',
    description:
      'Inspects an individual user profile, lifetime financial activity, preferred banking channels, top expense categories, and monthly averages.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description:
            'User identifier: can be a first/last name, @username, Telegram numerical ID, or internal user UUID.',
        },
        timeframe: {
          type: 'STRING',
          description:
            'Timeframe for user analysis: "all_time" (default), "last_30_days", "last_90_days", "this_month".',
          enum: ['all_time', 'last_30_days', 'last_90_days', 'this_month'],
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'getPlatformOverviewAndKpiTrends',
    description:
      'Retrieves macro platform metrics, total financial volume, active registered users, and input method breakdown (% voice, % receipt OCR, % manual text, % bank SMS).',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: {
          type: 'STRING',
          description:
            'Aggregation period: "today", "yesterday", "this_week", "this_month", "last_month", "all_time".',
          enum: ['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'all_time'],
        },
      },
    },
  },
  {
    name: 'generateDocumentReport',
    description:
      'Generates a downloadable, beautifully styled Microsoft Excel (.xlsx) spreadsheet or Microsoft Word (.docx) executive report containing financial breakdowns, transaction records, or banking market share datasets.',
    parameters: {
      type: 'OBJECT',
      properties: {
        format: {
          type: 'STRING',
          description:
            'Document format to generate: "EXCEL" for .xlsx spreadsheet or "WORD" for .docx executive report.',
          enum: ['EXCEL', 'WORD'],
        },
        title: {
          type: 'STRING',
          description:
            'Descriptive title of the report (e.g. "Q3 CBE vs Telebirr Settlement Report", "High-Value Transaction Ledger").',
        },
        reportType: {
          type: 'STRING',
          description: 'Category of data to package into the document.',
          enum: [
            'TRANSACTIONS',
            'CATEGORY_BREAKDOWN',
            'BANK_DISTRIBUTION',
            'USER_AUDIT',
            'PLATFORM_OVERVIEW',
            'HOURLY_CURVE',
            'MOM_GROWTH',
            'USER_RETENTION',
            'AI_MODALITY_HEALTH',
          ],
        },
        startDate: {
          type: 'STRING',
          description: 'Optional ISO start date for data filtering (e.g. "2026-08-01").',
        },
        endDate: {
          type: 'STRING',
          description: 'Optional ISO end date for data filtering (e.g. "2026-08-31").',
        },
        category: {
          type: 'STRING',
          description: 'Optional spending category filter (e.g. "food", "transport", "utilities").',
        },
        paymentMethod: {
          type: 'STRING',
          description:
            'Optional payment method/bank filter (e.g. "telebirr", "cbe", "boa", "awash", "dashen", "cash").',
        },
        minAmount: {
          type: 'NUMBER',
          description: 'Optional minimum ETB amount filter.',
        },
        userQuery: {
          type: 'STRING',
          description: 'Optional user identifier if this is a user audit report.',
        },
        executiveSummary: {
          type: 'STRING',
          description: 'Key executive takeaways and insights to include in the document banner.',
        },
      },
      required: ['format', 'title', 'reportType'],
    },
  },
  {
    name: 'getHourlySpendingCurveAndPeakTimes',
    description:
      'Analyzes 24-hour time-of-day consumer spending curves in East Africa Time (EAT, UTC+3) and Day-of-Week spending behavior. Identifies peak shopping/dining hours (e.g. Lunch 12:00-14:00, Evening 18:00-21:00 EAT) across categories and banking channels.',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: {
          type: 'STRING',
          description: 'Optional ISO start date filter.',
        },
        endDate: {
          type: 'STRING',
          description: 'Optional ISO end date filter.',
        },
        category: {
          type: 'STRING',
          description:
            'Optional category filter to inspect time-of-day habits for a specific category (e.g. "food", "transport").',
        },
        paymentMethod: {
          type: 'STRING',
          description: 'Optional payment rail filter (e.g. "telebirr", "cbe").',
        },
      },
    },
  },
  {
    name: 'getMonthOverMonthCategoryTrends',
    description:
      'Compares consumer spending velocity and category growth between current (last 30 days) and previous (prior 30 days) periods. Identifies surging vs declining categories and computes net ETB volume variance.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: {
          type: 'STRING',
          description: 'Optional category filter to analyze growth rate for a specific category.',
        },
      },
    },
  },
  {
    name: 'getUserRetentionAndCohortAnalytics',
    description:
      'Analyzes user growth cohorts, active user retention rates (7-day, 30-day, 90-day active spenders), onboarding consent completion rates, language preferences (Amharic vs English), and average transaction frequency.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'getAiExtractionQualityAndModalityMetrics',
    description:
      'Evaluates Muday data collection modalities (% voice notes, % image receipt scans, % bank SMS, % manual text messages), STT/OCR AI model distribution, and pipeline extraction confidence telemetry.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];
