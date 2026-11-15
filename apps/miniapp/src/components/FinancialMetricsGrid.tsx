import { ArrowDownToLine, ArrowUpFromLine, WalletCards } from 'lucide-react';
import type { DashboardResponse, Locale } from '../api/dashboard-types';
import { t } from '../i18n/catalogs';
import { formatETB } from '@/lib/utils';
import { Card } from './ui/card';

export function FinancialMetricsGrid({
  summary,
  locale,
}: {
  summary: DashboardResponse['summary'];
  locale: Locale;
}) {
  const isNetPositive = Number(summary.earnedNetEtb) >= 0;

  const metrics = [
    {
      key: 'income' as const,
      label: t(locale, 'earnedIncome'),
      amount: summary.earnedIncomeEtb,
      sign: '+',
      borderClass: 'border-emerald-500/20 bg-emerald-500/5',
      iconClass: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
      textClass: 'text-emerald-500',
      icon: <ArrowDownToLine size={16} aria-hidden="true" />,
    },
    {
      key: 'expenses' as const,
      label: t(locale, 'ordinaryExpenses'),
      amount: summary.ordinaryExpenseEtb,
      sign: '−',
      borderClass: 'border-rose-500/20 bg-rose-500/5',
      iconClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
      textClass: 'text-rose-500',
      icon: <ArrowUpFromLine size={16} aria-hidden="true" />,
    },
    {
      key: 'net' as const,
      label: t(locale, 'earnedNet'),
      amount: summary.earnedNetEtb,
      sign: isNetPositive ? '+' : '',
      borderClass: isNetPositive
        ? 'border-violet-500/20 bg-violet-500/5'
        : 'border-rose-500/20 bg-rose-500/5',
      iconClass: isNetPositive
        ? 'bg-violet-500/15 text-violet-500 border-violet-500/30'
        : 'bg-rose-500/15 text-rose-500 border-rose-500/30',
      textClass: isNetPositive ? 'text-violet-500' : 'text-rose-500',
      icon: <WalletCards size={16} aria-hidden="true" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {metrics.map((item) => (
        <Card
          key={item.key}
          className={`flex flex-col justify-between p-4 border transition-all duration-200 hover:scale-[1.02] ${item.borderClass}`}
        >
          <div className="flex items-center gap-2.5 mb-2.5">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border shadow-2xs ${item.iconClass}`}
            >
              {item.icon}
            </div>
            <span className="text-xs font-semibold text-[var(--muted-foreground)] leading-tight truncate">
              {item.label}
            </span>
          </div>

          <div className="text-base sm:text-lg font-black text-[var(--foreground)] tabular-nums">
            <span className={item.textClass} aria-hidden="true">
              {item.sign}
            </span>
            ETB {formatETB(item.amount, locale)}
          </div>
        </Card>
      ))}
    </div>
  );
}
