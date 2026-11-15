import { Inject, Injectable } from '@nestjs/common';

import { I18nService, type Locale } from '../i18n/i18n.service.js';
import type { MessageKey } from '../i18n/message-key.js';
import { formatCents, formatPercentage } from './summary-money.js';
import type { FinancialSummary, SummaryCategory } from './summary.types.js';

@Injectable()
export class SummaryFormatterService {
  constructor(@Inject(I18nService) private readonly i18n: I18nService) {}

  format(summary: FinancialSummary, locale: Locale, title?: string): string {
    const categories =
      summary.categories.length === 0
        ? this.i18n.translate('summary.categories.none', locale)
        : summary.categories
            .map((category, index) =>
              this.i18n.translate('summary.category.line', locale, {
                rank: index + 1,
                category: this.category(category.category),
                amount: formatCents(category.amountCents),
                percentage: formatPercentage(category.percentageHundredths),
              }),
            )
            .join('\n');
    const titleKey = (
      summary.period === 'custom' ? 'summary.title.month' : `summary.title.${summary.period}`
    ) as MessageKey;

    return this.i18n.translate('summary.body', locale, {
      title: title ?? this.i18n.translate(titleKey, locale),
      income: formatCents(summary.incomeCents),
      expenses: formatCents(summary.expenseCents),
      net: formatCents(summary.netCents),
      cashInflow: formatCents(summary.cashInflowCents),
      cashOutflow: formatCents(summary.cashOutflowCents),
      cashNet: formatCents(summary.cashFlowNetCents),
      movements: this.movements(summary, locale),
      count: summary.transactionCount,
      categories,
      comparison: this.comparison(summary, locale),
      insight: this.insight(summary, locale),
    });
  }

  private movements(summary: FinancialSummary, locale: Locale): string {
    if (summary.specialMovements.length === 0) {
      return this.i18n.translate('summary.movements.none', locale);
    }
    return summary.specialMovements
      .map(({ kind, amountCents }) =>
        this.i18n.translate('summary.movement.line', locale, {
          kind: this.i18n.translate(`transaction.type.${kind}` as MessageKey, locale),
          amount: formatCents(amountCents),
        }),
      )
      .join('\n');
  }

  private comparison(summary: FinancialSummary, locale: Locale): string {
    const comparison = summary.comparison;
    if (comparison.direction === 'unchanged') {
      return this.i18n.translate('summary.comparison.unchanged', locale);
    }
    if (comparison.direction === 'no_prior') {
      return this.i18n.translate('summary.comparison.no_prior', locale, {
        amount: formatCents(comparison.amountCents),
      });
    }
    if (comparison.direction === 'recovery_exceeded') {
      return this.i18n.translate('summary.comparison.recovery_exceeded', locale, {
        amount: formatCents(comparison.amountCents),
      });
    }
    return this.i18n.translate(`summary.comparison.${comparison.direction}`, locale, {
      amount: formatCents(comparison.amountCents),
      percentage: formatPercentage(comparison.percentageHundredths),
    });
  }

  private insight(summary: FinancialSummary, locale: Locale): string {
    if (summary.insight.kind === 'top_category') {
      return this.i18n.translate('summary.insight.top_category', locale, {
        category: this.category(summary.insight.category),
      });
    }
    return this.i18n.translate(`summary.insight.${summary.insight.kind}`, locale);
  }

  private category(category: SummaryCategory): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
