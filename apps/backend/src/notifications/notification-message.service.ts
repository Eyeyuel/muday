import { Inject, Injectable } from '@nestjs/common';

import { I18nService, type Locale } from '../i18n/i18n.service.js';
import type { MessageKey } from '../i18n/message-key.js';
import { formatCents } from '../summaries/summary-money.js';
import { SummaryFormatterService } from '../summaries/summary-formatter.service.js';
import { SummaryService } from '../summaries/summary.service.js';
import type { NotificationKind } from './notification.types.js';

@Injectable()
export class NotificationMessageService {
  constructor(
    @Inject(SummaryService) private readonly summaries: SummaryService,
    @Inject(SummaryFormatterService) private readonly formatter: SummaryFormatterService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  async build(
    userId: string,
    kind: NotificationKind,
    locale: Locale,
    now: Date = new Date(),
  ): Promise<string> {
    if (kind === 'morning_reminder') {
      const day = this.eatDayNumber(now);
      return this.i18n.translate(`notification.morning.${day % 3}` as MessageKey, locale);
    }
    if (kind === 'night_status') {
      const summary = await this.summaries.get(userId, 'today', now);
      if (summary.transactionCount === 0) {
        return this.i18n.translate('notification.night.empty', locale);
      }
      return this.i18n.translate('notification.night.body', locale, {
        income: formatCents(summary.incomeCents),
        expenses: formatCents(summary.expenseCents),
        net: formatCents(summary.netCents),
        cashInflow: formatCents(summary.cashInflowCents),
        cashOutflow: formatCents(summary.cashOutflowCents),
        cashNet: formatCents(summary.cashFlowNetCents),
        count: summary.transactionCount,
        insight: this.insight(summary.insight, locale),
      });
    }
    if (kind === 'weekly_summary') {
      const summary = await this.summaries.get(userId, 'week', now);
      return this.formatter.format(
        summary,
        locale,
        this.i18n.translate('notification.weekly.title', locale),
      );
    }
    const previousMonthReference = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const summary = await this.summaries.get(userId, 'month', previousMonthReference);
    const largest = summary.largestExpense
      ? this.i18n.translate('notification.monthly.largest', locale, {
          category: this.i18n.translate(
            `category.${summary.largestExpense.category}` as MessageKey,
            locale,
          ),
          amount: summary.largestExpense.amount,
        })
      : this.i18n.translate('notification.monthly.no_largest', locale);
    return `${this.formatter.format(
      summary,
      locale,
      this.i18n.translate('notification.monthly.title', locale),
    )}\n\n${largest}`;
  }

  private insight(insight: { kind: string; category?: string }, locale: Locale): string {
    if (insight.kind === 'top_category' && insight.category) {
      return this.i18n.translate('summary.insight.top_category', locale, {
        category: this.i18n.translate(`category.${insight.category}` as MessageKey, locale),
      });
    }
    return this.i18n.translate(`summary.insight.${insight.kind}` as MessageKey, locale);
  }

  private eatDayNumber(now: Date): number {
    const eat = new Date(now.getTime() + 3 * 60 * 60 * 1_000);
    return Math.floor(
      Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate()) / 86_400_000,
    );
  }
}
