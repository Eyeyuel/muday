import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Environment } from '../config/environment.js';
import { AdminAiSessionRepository } from './admin-ai-session.repository.js';
import { AdminAiToolsService } from './admin-ai-tools.service.js';
import { AdminAiExportService, type ExportReportData } from './admin-ai-export.service.js';
import { ADMIN_AI_TOOL_DECLARATIONS } from './admin-ai-tools.schema.js';
import type { AdminAiChatRequestDto, AdminAiChatResponseDto } from './admin-ai.dto.js';
import type {
  AiExtractionQualityResult,
  CategoryTrendsResult,
  ChatTurn,
  HourlySpendingCurveResult,
  PaymentMethodDistributionResult,
  PlatformOverviewResult,
  SpendingHabitsResult,
  ToolExecutionRecord,
  TransactionsQueryResult,
  UserCohortRetentionResult,
  VisualDataPayload,
} from './admin-ai.types.js';

export const ADMIN_AI_SYSTEM_INSTRUCTION = `You are Muday's Admin Data & Consumer Analytics Assistant.
Your mission is to provide accurate, business-critical insights regarding Ethiopian personal finance trends, consumer spending patterns, payment platform distribution (Telebirr, CBE, Bank of Abyssinia, Awash, Dashen, and Cash), time-of-day spending curves in East Africa Time (EAT, UTC+3), and system-wide data collection health.

Key Instructions:
1. Always call the appropriate tool to fetch real database data before answering questions about users, spending, transactions, time-of-day curves, trends, or system metrics.
2. When the admin asks for an Excel spreadsheet, Word document, report file, export, or audit file, invoke the \`generateDocumentReport\` tool with the requested format ('EXCEL' or 'WORD') and appropriate filters.
3. Never invent or hallucinate financial numbers or user records. If a tool returns no data, inform the admin clearly.
4. When answering:
   - Provide a clear, executive-level natural language summary with root-cause insights (e.g. correlate high category spend with specific hours of the day or preferred payment rails).
   - Highlight key actionable insights (e.g. "Food & Groceries accounts for 48% of wallet share with a sharp peak during the 12:00–14:00 EAT lunch window", "Telebirr has 68% market share for micro-transactions under 200 ETB").
   - Always reference Ethiopian local time as East Africa Time (EAT, UTC+3) when discussing hourly patterns or transaction timestamps.
   - Format money in ETB (e.g. "12,500.00 ETB").
   - Use structured bullet points and markdown tables when appropriate.
5. Support follow-up questions by leveraging conversation history (e.g. if the admin asks "What about the second user?" or "Now export this to Excel", refer to the previous tool output).
6. Never use emojis, diamond icons, sparkles, or informal symbols anywhere in your replies. Maintain a clean, professional, and corporate tone at all times.
7. Always format spending categories using proper human-readable Title Case (e.g., "Clothing & Personal Care", "Food & Groceries", "Housing & Rent", "Airtime & Internet", "Utilities & Bills", "Transportation & Travel", "Healthcare & Medical", "Education & Tuition", "Church & Charity", "Family Support", "Entertainment & Dining"). Never display raw database snake_case strings like "clothing_personal_care" or "food_groceries".`;

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
  thought_signature?: string;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      role?: string;
      parts?: GeminiPart[];
    };
  }>;
}

@Injectable()
export class AdminAiService {
  private readonly logger = new Logger(AdminAiService.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(AdminAiToolsService) private readonly toolsService: AdminAiToolsService,
    @Inject(AdminAiSessionRepository) private readonly sessionRepository: AdminAiSessionRepository,
    @Inject(AdminAiExportService) private readonly exportService: AdminAiExportService,
  ) {
    this.baseUrl = config.get('GEMINI_BASE_URL', { infer: true }).replace(/\/$/, '');
    this.model = config.get('GEMINI_MODEL', { infer: true }) ?? 'gemini-3.6-flash';
    this.apiKey = config.get('GEMINI_API_KEY', { infer: true });
    this.timeoutMs = config.get('GEMINI_TIMEOUT_MS', { infer: true }) ?? 60_000;
  }

  async chat(adminId: string, dto: AdminAiChatRequestDto): Promise<AdminAiChatResponseDto> {
    const sessionId = dto.sessionId?.trim() || randomUUID();
    const existingSession = await this.sessionRepository.getSession(adminId, sessionId);
    const turns: ChatTurn[] = existingSession ? [...existingSession.turns] : [];

    // Add user's message turn
    turns.push({
      role: 'user',
      parts: [{ text: dto.message.trim() }],
    });

    const toolsExecuted: ToolExecutionRecord[] = [];
    const visualData: VisualDataPayload = {};
    let finalReply = '';
    const maxToolIterations = 5;

    for (let iteration = 0; iteration < maxToolIterations; iteration++) {
      const response = await this.callGemini(turns);
      const candidate = response.candidates?.[0]?.content;
      if (!candidate || !candidate.parts || candidate.parts.length === 0) {
        finalReply = 'I apologize, but I could not generate a response at this moment.';
        break;
      }

      // Check if Gemini invoked a function call
      const functionCallPart = candidate.parts.find((p) => p.functionCall);

      if (functionCallPart && functionCallPart.functionCall) {
        const { name, args } = functionCallPart.functionCall;
        const callArgs = args ?? {};

        this.logger.log(`Gemini invoked tool: ${name} with args: ${JSON.stringify(callArgs)}`);
        toolsExecuted.push({
          toolName: name,
          args: callArgs,
          timestamp: new Date().toISOString(),
        });

        // Execute tool and collect visual data
        const toolResult = await this.executeTool(name, callArgs, visualData);

        // Record model's complete parts (preserving thought_signature if present)
        turns.push({
          role: 'model',
          parts: candidate.parts,
        });

        // Record function response turn (sent with role 'user' for Gemini REST API v1beta)
        turns.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name,
                response: { name, content: toolResult },
              },
            },
          ],
        });

        // Continue loop to let Gemini interpret the tool output
        continue;
      }

      // Model returned natural language answer
      const textPart = candidate.parts.find((p) => p.text);
      if (textPart && textPart.text) {
        finalReply = textPart.text.trim();
        turns.push({
          role: 'model',
          parts: candidate.parts,
        });
      }
      break;
    }

    // Sanitize any potential internal pseudo-call tokens or token leaks from the final reply
    finalReply = this.sanitizeReply(finalReply, visualData, toolsExecuted);

    // Save clean multi-turn dialogue history to Redis
    const persistedTurns: ChatTurn[] = existingSession ? [...existingSession.turns] : [];
    persistedTurns.push({
      role: 'user',
      parts: [{ text: dto.message.trim() }],
    });
    persistedTurns.push({
      role: 'model',
      parts: [{ text: finalReply }],
    });
    await this.sessionRepository.saveSession(adminId, sessionId, persistedTurns);

    return {
      sessionId,
      reply: finalReply,
      toolsExecuted,
      visualData: Object.keys(visualData).length > 0 ? visualData : undefined,
    };
  }

  private sanitizeReply(
    rawReply: string,
    visualData: VisualDataPayload,
    toolsExecuted: ToolExecutionRecord[],
  ): string {
    let text = (rawReply || '').trim();

    // Check if the reply contains internal pseudo-tool syntax or tokenizer artifacts
    const hasPseudoCallLeak =
      text.includes('call:') ||
      text.includes('default_api:') ||
      text.includes('回家') ||
      /^[a-zA-Z0-9_]+:\s*\{/.test(text) ||
      /^\{[\s\S]*\}$/.test(text);

    if (hasPseudoCallLeak) {
      // Strip out the leaked pseudo-call blocks
      text = text
        .replace(/[\u4e00-\u9fa5]*call:[a-zA-Z0-9_:]+\s*\{[\s\S]*?\}?/g, '')
        .replace(/default_api:[a-zA-Z0-9_]+/g, '')
        .replace(/回家/g, '')
        .trim();
    }

    // If text is empty or meaningless after stripping, provide a clean executive synthesis
    if (!text || text.length < 5) {
      if (visualData.fileAttachment) {
        const fmt = visualData.fileAttachment.format;
        const title = visualData.fileAttachment.title || 'Executive Financial Report';
        return `I have generated the ${fmt} report **"${title}"** with all analyzed data and metrics. You can download the file directly from the attachment card below.`;
      }
      if (visualData.table) {
        return `Here is the financial breakdown for ${visualData.table.title || 'your inquiry'}. You can inspect the detailed ledger and export it using the buttons below.`;
      }
      if (toolsExecuted.length > 0) {
        return 'The requested financial data has been gathered and summarized in the dashboard widgets below.';
      }
      return 'Data inquiry processed successfully.';
    }

    return text;
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    visualData: VisualDataPayload,
  ): Promise<Record<string, unknown>> {
    switch (name) {
      case 'getSpendingHabitsAndCategoryAnalytics': {
        const result: SpendingHabitsResult = await this.toolsService.getSpendingHabits(args);
        visualData.kpis = [
          { label: 'Total Analyzed Volume', value: result.formattedTotalVolume },
          { label: 'Total Transactions', value: String(result.totalCount) },
        ];
        if (result.categories.length > 0) {
          visualData.table = {
            title: `Spending Habits (${result.timeframe})`,
            headers: ['Category', 'Volume (ETB)', 'Count', 'Share (%)', 'Avg Size'],
            rows: result.categories.map((c) => [
              c.category,
              c.formattedVolume,
              c.transactionCount,
              `${c.percentageShare}%`,
              this.formatEtb(c.averageTransactionSize),
            ]),
          };
          visualData.chart = {
            title: 'Expense Distribution by Category',
            chartType: 'pie',
            data: result.categories.slice(0, 6).map((c) => ({
              label: c.category,
              value: c.totalVolume,
            })),
          };
        }
        return result as unknown as Record<string, unknown>;
      }

      case 'getPaymentMethodAndBankDistribution': {
        const result: PaymentMethodDistributionResult =
          await this.toolsService.getPaymentMethodDistribution(args);
        visualData.kpis = [
          { label: 'Total Platform Volume', value: result.formattedTotalVolume },
          { label: 'Total Transactions', value: String(result.totalCount) },
        ];
        if (result.platforms.length > 0) {
          visualData.table = {
            title: 'Payment Channel Market Share',
            headers: ['Platform / Bank', 'Volume (ETB)', 'Count', 'Share (%)', 'Avg Size'],
            rows: result.platforms.map((p) => [
              p.paymentMethod,
              p.formattedVolume,
              p.transactionCount,
              `${p.percentageShare}%`,
              this.formatEtb(p.averageTransactionSize),
            ]),
          };
          visualData.chart = {
            title: 'Payment Platform Volume (ETB)',
            chartType: 'bar',
            data: result.platforms.map((p) => ({
              label: p.paymentMethod,
              value: p.totalVolume,
            })),
          };
        }
        return result as unknown as Record<string, unknown>;
      }

      case 'queryTransactions': {
        const result: TransactionsQueryResult = await this.toolsService.queryTransactions(args);
        visualData.kpis = [
          { label: 'Matching Transactions', value: String(result.count) },
          { label: 'Matching Volume', value: result.formattedTotalVolume },
        ];
        if (result.transactions.length > 0) {
          visualData.table = {
            title: 'Transaction Records',
            headers: ['Date', 'User', 'Category', 'Method', 'Amount', 'Source'],
            rows: result.transactions
              .slice(0, 15)
              .map((t) => [
                t.date,
                t.userName ?? 'User',
                t.category,
                t.paymentMethod,
                t.formattedAmount,
                t.source,
              ]),
          };
        }
        return result as unknown as Record<string, unknown>;
      }

      case 'getTransactionDetail': {
        const result = await this.toolsService.getTransactionDetail(
          args as { transactionId: string },
        );
        if (result.found && result.transaction) {
          visualData.kpis = [
            { label: 'Amount', value: result.transaction.formattedAmount },
            { label: 'Category', value: result.transaction.category },
            { label: 'Payment Method', value: result.transaction.paymentMethod },
          ];
        }
        return result as unknown as Record<string, unknown>;
      }

      case 'getUserProfileAndBehaviorSummary': {
        const result = await this.toolsService.getUserProfileSummary(
          args as { query: string; timeframe?: string },
        );
        if (result.found && result.user) {
          visualData.kpis = [
            { label: 'User Name', value: result.user.name ?? 'User' },
            { label: 'Lifetime Volume', value: result.user.formattedTotalVolume },
            { label: 'Transactions', value: String(result.user.transactionCount) },
            { label: 'Top Bank', value: result.user.preferredPaymentMethod ?? 'None' },
          ];
          if (result.user.topCategories.length > 0) {
            visualData.table = {
              title: `${result.user.name}'s Top Categories`,
              headers: ['Category', 'Volume (ETB)', 'Share (%)'],
              rows: result.user.topCategories.map((c) => [
                c.category,
                this.formatEtb(c.volume),
                `${c.share}%`,
              ]),
            };
          }
        }
        return result as unknown as Record<string, unknown>;
      }

      case 'getPlatformOverviewAndKpiTrends': {
        const result: PlatformOverviewResult = await this.toolsService.getPlatformOverview(args);
        visualData.kpis = [
          { label: 'Active Users', value: String(result.activeUsers) },
          { label: 'Total Volume', value: result.formattedTotalVolume },
          { label: 'Transactions', value: String(result.totalTransactions) },
          { label: 'Voice Share', value: `${result.sourceBreakdown.voiceShare}%` },
        ];
        visualData.table = {
          title: `Input Channel Breakdown (${result.period})`,
          headers: ['Input Method', 'Count', 'Share (%)'],
          rows: [
            [
              'Voice Notes',
              result.sourceBreakdown.voiceCount,
              `${result.sourceBreakdown.voiceShare}%`,
            ],
            [
              'Receipt Scans',
              result.sourceBreakdown.receiptCount,
              `${result.sourceBreakdown.receiptShare}%`,
            ],
            [
              'Manual Text',
              result.sourceBreakdown.textCount,
              `${result.sourceBreakdown.textShare}%`,
            ],
            ['Bank SMS', result.sourceBreakdown.smsCount, `${result.sourceBreakdown.smsShare}%`],
          ],
        };
        return result as unknown as Record<string, unknown>;
      }

      case 'getHourlySpendingCurveAndPeakTimes': {
        const result: HourlySpendingCurveResult =
          await this.toolsService.getHourlySpendingCurve(args);
        visualData.kpis = [
          { label: 'Analyzed Volume', value: result.formattedTotalVolume },
          { label: 'Transactions', value: String(result.totalTransactions) },
          {
            label: 'Peak Spending Window',
            value: result.peakWindow.label,
            subtext: `${result.peakWindow.percentageShare}% of daily spend`,
          },
        ];
        visualData.table = {
          title: `24-Hour Spending Distribution (EAT UTC+3)`,
          headers: ['Time Window', 'Volume (ETB)', 'Transactions', 'Share (%)'],
          rows: result.hourlyCurve
            .filter((h) => h.count > 0 || [8, 12, 13, 14, 18, 19, 20].includes(h.hourEAT))
            .map((h) => [h.timeLabel, h.formattedVolume, h.count, `${h.sharePercentage}%`]),
        };
        visualData.chart = {
          title: 'Hourly Spending Curve (EAT)',
          chartType: 'line',
          data: result.hourlyCurve.map((h) => ({
            label: `${h.hourEAT}:00`,
            value: h.volumeEtb,
          })),
        };
        return result as unknown as Record<string, unknown>;
      }

      case 'getMonthOverMonthCategoryTrends': {
        const result: CategoryTrendsResult =
          await this.toolsService.getMonthOverMonthCategoryTrends(args);
        visualData.kpis = [
          { label: 'Current 30D Volume', value: result.formattedCurrentVolume },
          {
            label: 'Net Growth Rate',
            value: `${result.overallGrowthPercentage >= 0 ? '+' : ''}${result.overallGrowthPercentage}%`,
          },
          ...(result.fastestGrowingCategory
            ? [{ label: 'Fastest Surging', value: result.fastestGrowingCategory }]
            : []),
        ];
        visualData.table = {
          title: `Category Growth Comparison (${result.currentPeriod} vs ${result.previousPeriod})`,
          headers: ['Category', 'Current (ETB)', 'Prior (ETB)', 'Growth (%)', 'Net Delta (ETB)'],
          rows: result.categories.map((c) => [
            c.category,
            c.formattedCurrentVolume,
            c.formattedPreviousVolume,
            `${c.growthPercentage >= 0 ? '+' : ''}${c.growthPercentage}%`,
            c.formattedNetChange,
          ]),
        };
        visualData.chart = {
          title: 'Category Growth Rate (%)',
          chartType: 'bar',
          data: result.categories.slice(0, 8).map((c) => ({
            label: c.category,
            value: c.growthPercentage,
          })),
        };
        return result as unknown as Record<string, unknown>;
      }

      case 'getUserRetentionAndCohortAnalytics': {
        const result: UserCohortRetentionResult =
          await this.toolsService.getUserRetentionAndCohortAnalytics();
        visualData.kpis = [
          { label: 'Registered Users', value: String(result.totalRegisteredUsers) },
          { label: '30-Day Active Users', value: String(result.activeUsersLast30Days) },
          { label: '30D Retention Rate', value: `${result.retentionRate30DayPct}%` },
          { label: 'Consent Rate', value: `${result.consentStatusBreakdown.consentRatePct}%` },
        ];
        visualData.table = {
          title: 'User Cohorts & Engagement Telemetry',
          headers: ['Cohort / Segment', 'User Count', 'Percentage / Metric'],
          rows: [
            [
              'Active Last 7 Days',
              result.activeUsersLast7Days,
              `${result.totalRegisteredUsers > 0 ? ((result.activeUsersLast7Days / result.totalRegisteredUsers) * 100).toFixed(1) : 0}%`,
            ],
            [
              'Active Last 30 Days',
              result.activeUsersLast30Days,
              `${result.retentionRate30DayPct}%`,
            ],
            [
              'Active Last 90 Days',
              result.activeUsersLast90Days,
              `${result.totalRegisteredUsers > 0 ? ((result.activeUsersLast90Days / result.totalRegisteredUsers) * 100).toFixed(1) : 0}%`,
            ],
            [
              'Active Consent Status',
              result.consentStatusBreakdown.activeUsers,
              `${result.consentStatusBreakdown.consentRatePct}%`,
            ],
            [
              'Pending Consent',
              result.consentStatusBreakdown.pendingConsentUsers,
              `${(100 - result.consentStatusBreakdown.consentRatePct).toFixed(1)}%`,
            ],
            [
              'Amharic Language Preference',
              result.languageBreakdown.amharicCount,
              `${result.languageBreakdown.amharicPct}%`,
            ],
            [
              'English Language Preference',
              result.languageBreakdown.englishCount,
              `${result.languageBreakdown.englishPct}%`,
            ],
            [
              'Avg Transactions / Active User',
              result.averageTransactionsPerActiveUser,
              `${result.averageTransactionsPerActiveUser} tx/user`,
            ],
            [
              'Avg Volume / Active User',
              result.averageVolumePerActiveUser,
              result.averageVolumePerActiveUser,
            ],
          ],
        };
        return result as unknown as Record<string, unknown>;
      }

      case 'getAiExtractionQualityAndModalityMetrics': {
        const result: AiExtractionQualityResult =
          await this.toolsService.getAiExtractionQualityMetrics();
        visualData.kpis = [
          { label: 'Total Ingestion Events', value: String(result.totalLoggedEvents) },
          { label: 'Confirmed Transactions', value: String(result.totalConfirmedTransactions) },
          { label: 'Extraction Confidence', value: `${result.averageExtractionConfidence}%` },
          { label: 'Clarification Rate', value: `${result.clarificationCandidateRatePct}%` },
        ];
        visualData.table = {
          title: 'Ingestion Channel Modality Breakdown',
          headers: ['Input Channel', 'Event Count', 'Share (%)'],
          rows: result.modalityBreakdown.map((m) => [m.source, m.count, `${m.percentageShare}%`]),
        };
        visualData.chart = {
          title: 'Data Collection Channel Share',
          chartType: 'pie',
          data: result.modalityBreakdown.map((m) => ({
            label: m.source,
            value: m.count,
          })),
        };
        return result as unknown as Record<string, unknown>;
      }

      case 'generateDocumentReport': {
        const format = ((args.format as string) || 'EXCEL').toUpperCase() as 'EXCEL' | 'WORD';
        const title = (args.title as string) || 'Muday Financial Intelligence Report';
        const reportType = (args.reportType as string) || 'TRANSACTIONS';
        const summary = args.executiveSummary as string | undefined;

        const exportData: ExportReportData = {
          title,
          subtitle: `Muday Financial Intelligence Report — ${reportType.replace(/_/g, ' ')}`,
          headers: ['Category / Attribute', 'Value'],
          rows: [],
          ...(summary ? { summary } : {}),
        };

        if (reportType === 'CATEGORY_BREAKDOWN') {
          const res = await this.toolsService.getSpendingHabits({
            startDate: args.startDate as string,
            endDate: args.endDate as string,
          });
          exportData.headers = [
            'Category',
            'Volume (ETB)',
            'Transaction Count',
            'Market Share (%)',
            'Avg Ticket Size (ETB)',
          ];
          exportData.rows = res.categories.map((c) => [
            c.category,
            c.totalVolume,
            c.transactionCount,
            `${c.percentageShare}%`,
            c.averageTransactionSize,
          ]);
          exportData.kpis = [
            { label: 'Total Volume', value: res.formattedTotalVolume },
            { label: 'Total Transactions', value: String(res.totalCount) },
          ];
        } else if (reportType === 'BANK_DISTRIBUTION') {
          const res = await this.toolsService.getPaymentMethodDistribution({
            startDate: args.startDate as string,
            endDate: args.endDate as string,
            category: args.category as string,
            minAmount: args.minAmount as number,
          });
          exportData.headers = [
            'Bank / Payment Rail',
            'Volume (ETB)',
            'Transaction Count',
            'Volume Share (%)',
            'Avg Ticket Size (ETB)',
          ];
          exportData.rows = res.platforms.map((p) => [
            p.paymentMethod,
            p.totalVolume,
            p.transactionCount,
            `${p.percentageShare}%`,
            p.averageTransactionSize,
          ]);
          exportData.kpis = [
            { label: 'Total Platform Volume', value: res.formattedTotalVolume },
            { label: 'Total Transactions', value: String(res.totalCount) },
          ];
        } else if (reportType === 'USER_AUDIT' && args.userQuery) {
          const res = await this.toolsService.getUserProfileSummary({
            query: args.userQuery as string,
          });
          if (res.found && res.user) {
            exportData.title = `User Financial Audit: ${res.user.name ?? 'User'}`;
            exportData.headers = ['Spending Category', 'Volume (ETB)', 'Share (%)'];
            exportData.rows = res.user.topCategories.map((c) => [
              c.category,
              c.volume,
              `${c.share}%`,
            ]);
            exportData.kpis = [
              { label: 'User Name', value: res.user.name ?? 'User' },
              { label: 'Lifetime Volume', value: res.user.formattedTotalVolume },
              { label: 'Total Transactions', value: String(res.user.transactionCount) },
              { label: 'Preferred Rail', value: res.user.preferredPaymentMethod ?? 'None' },
            ];
          }
        } else if (reportType === 'PLATFORM_OVERVIEW') {
          const res = await this.toolsService.getPlatformOverview({
            period: args.startDate ? 'custom' : 'all_time',
          });
          exportData.headers = ['Input Method / Rail', 'Count', 'Share (%)'];
          exportData.rows = [
            ['Voice Notes', res.sourceBreakdown.voiceCount, `${res.sourceBreakdown.voiceShare}%`],
            [
              'Receipt Scans',
              res.sourceBreakdown.receiptCount,
              `${res.sourceBreakdown.receiptShare}%`,
            ],
            [
              'Manual Text Messages',
              res.sourceBreakdown.textCount,
              `${res.sourceBreakdown.textShare}%`,
            ],
            ['Bank SMS', res.sourceBreakdown.smsCount, `${res.sourceBreakdown.smsShare}%`],
          ];
          exportData.kpis = [
            { label: 'Active Registered Users', value: String(res.activeUsers) },
            { label: 'Total System Volume', value: res.formattedTotalVolume },
            { label: 'Total Transactions', value: String(res.totalTransactions) },
          ];
        } else if (reportType === 'HOURLY_CURVE') {
          const res = await this.toolsService.getHourlySpendingCurve({
            startDate: args.startDate as string,
            endDate: args.endDate as string,
            category: args.category as string,
            paymentMethod: args.paymentMethod as string,
          });
          exportData.headers = [
            'Time Window (EAT)',
            'Volume (ETB)',
            'Transactions',
            'Daily Share (%)',
          ];
          exportData.rows = res.hourlyCurve.map((h) => [
            h.timeLabel,
            h.volumeEtb,
            h.count,
            `${h.sharePercentage}%`,
          ]);
          exportData.kpis = [
            { label: 'Analyzed Volume', value: res.formattedTotalVolume },
            { label: 'Total Transactions', value: String(res.totalTransactions) },
            { label: 'Peak Spending Window', value: res.peakWindow.label },
          ];
        } else if (reportType === 'MOM_GROWTH') {
          const res = await this.toolsService.getMonthOverMonthCategoryTrends({
            category: args.category as string,
          });
          exportData.headers = [
            'Category',
            'Current 30D (ETB)',
            'Prior 30D (ETB)',
            'Growth (%)',
            'Net Change (ETB)',
            'Trend Status',
          ];
          exportData.rows = res.categories.map((c) => [
            c.category,
            c.currentVolume,
            c.previousVolume,
            `${c.growthPercentage >= 0 ? '+' : ''}${c.growthPercentage}%`,
            c.netChangeEtb,
            c.trend.toUpperCase(),
          ]);
          exportData.kpis = [
            { label: 'Current 30D Volume', value: res.formattedCurrentVolume },
            {
              label: 'Overall Growth',
              value: `${res.overallGrowthPercentage >= 0 ? '+' : ''}${res.overallGrowthPercentage}%`,
            },
          ];
        } else if (reportType === 'USER_RETENTION') {
          const res = await this.toolsService.getUserRetentionAndCohortAnalytics();
          exportData.headers = ['Cohort Segment', 'User Count', 'Share / Rate'];
          exportData.rows = [
            ['Total Registered Users', res.totalRegisteredUsers, '100%'],
            [
              'Active Last 7 Days',
              res.activeUsersLast7Days,
              `${res.totalRegisteredUsers > 0 ? ((res.activeUsersLast7Days / res.totalRegisteredUsers) * 100).toFixed(1) : 0}%`,
            ],
            ['Active Last 30 Days', res.activeUsersLast30Days, `${res.retentionRate30DayPct}%`],
            [
              'Active Last 90 Days',
              res.activeUsersLast90Days,
              `${res.totalRegisteredUsers > 0 ? ((res.activeUsersLast90Days / res.totalRegisteredUsers) * 100).toFixed(1) : 0}%`,
            ],
            [
              'Amharic Users',
              res.languageBreakdown.amharicCount,
              `${res.languageBreakdown.amharicPct}%`,
            ],
            [
              'English Users',
              res.languageBreakdown.englishCount,
              `${res.languageBreakdown.englishPct}%`,
            ],
          ];
          exportData.kpis = [
            { label: 'Total Registered', value: String(res.totalRegisteredUsers) },
            { label: '30D Active Spenders', value: String(res.activeUsersLast30Days) },
            { label: '30D Retention Rate', value: `${res.retentionRate30DayPct}%` },
          ];
        } else if (reportType === 'AI_MODALITY_HEALTH') {
          const res = await this.toolsService.getAiExtractionQualityMetrics();
          exportData.headers = ['Ingestion Modality', 'Event Count', 'Modality Share (%)'];
          exportData.rows = res.modalityBreakdown.map((m) => [
            m.source,
            m.count,
            `${m.percentageShare}%`,
          ]);
          exportData.kpis = [
            { label: 'Total Logged Events', value: String(res.totalLoggedEvents) },
            { label: 'Confirmed Transactions', value: String(res.totalConfirmedTransactions) },
            { label: 'Extraction Confidence', value: `${res.averageExtractionConfidence}%` },
          ];
        } else {
          // Default: TRANSACTIONS
          const res = await this.toolsService.queryTransactions({
            startDate: args.startDate as string,
            endDate: args.endDate as string,
            category: args.category as string,
            paymentMethod: args.paymentMethod as string,
            minAmount: args.minAmount as number,
            limit: 100,
          });
          exportData.headers = [
            'Date & Time',
            'User',
            'Category',
            'Bank / Rail',
            'Amount (ETB)',
            'Ingestion Method',
            'Status',
          ];
          exportData.rows = res.transactions.map((t) => [
            t.date,
            t.userName ?? 'User',
            t.category,
            t.paymentMethod,
            t.amount,
            t.source,
            t.status,
          ]);
          exportData.kpis = [
            { label: 'Matching Transactions', value: String(res.count) },
            { label: 'Total Matching Volume', value: res.formattedTotalVolume },
          ];
        }

        const isExcel = format === 'EXCEL';
        const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `${sanitizedTitle}_${timestamp}.${isExcel ? 'xlsx' : 'docx'}`;
        const mimeType = isExcel
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        const buffer = isExcel
          ? await this.exportService.generateExcel(exportData)
          : await this.exportService.generateWord(exportData);

        const token = this.exportService.storeExportFile(filename, mimeType, buffer);

        visualData.fileAttachment = {
          fileId: token,
          filename,
          format,
          downloadUrl: `/api/admin/ai/export/download/${token}`,
          title,
          recordCount: exportData.rows.length,
          fileSizeBytes: buffer.length,
        };

        return {
          status: 'SUCCESS',
          message: `Generated ${format} report document "${filename}" with ${exportData.rows.length} records. Download link attached.`,
          fileAttachment: visualData.fileAttachment,
        };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  private async callGemini(turns: ChatTurn[]): Promise<GeminiGenerateResponse> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const payload = {
      systemInstruction: {
        parts: [{ text: ADMIN_AI_SYSTEM_INSTRUCTION }],
      },
      contents: turns,
      tools: [{ functionDeclarations: ADMIN_AI_TOOL_DECLARATIONS }],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`Gemini API error: HTTP ${response.status} - ${errText}`);
        throw new Error(`Gemini API returned HTTP ${response.status}`);
      }

      return (await response.json()) as GeminiGenerateResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  private formatEtb(amount: number): string {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
  }
}
