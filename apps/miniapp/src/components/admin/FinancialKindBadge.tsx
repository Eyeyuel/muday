import { ArrowDownLeft, ArrowUpRight, Coins, Receipt, RotateCcw, Tag, Undo2 } from 'lucide-react';
import type { Locale } from '../../api/dashboard-types';

interface FinancialKindBadgeProps {
  kind?: string | null;
  type?: string | null;
  locale?: Locale;
  showIcon?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function getKindMetadata(kind?: string | null, type?: string | null, locale: Locale = 'en') {
  const normalized = (kind || type || 'EXPENSE').toUpperCase().trim();

  switch (normalized) {
    case 'INCOME':
      return {
        label: locale === 'am' ? 'ገቢ' : 'Income',
        icon: ArrowDownLeft,
        isIncoming: true,
        badgeStyle:
          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'EXPENSE':
      return {
        label: locale === 'am' ? 'ወጪ' : 'Expense',
        icon: ArrowUpRight,
        isIncoming: false,
        badgeStyle:
          'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/15',
        iconColor: 'text-rose-600 dark:text-rose-400',
      };
    case 'LOAN_RECEIVED':
      return {
        label: locale === 'am' ? 'የተወሰደ ብድር' : 'Loan Received',
        icon: Coins,
        isIncoming: true,
        badgeStyle:
          'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/15',
        iconColor: 'text-blue-600 dark:text-blue-400',
      };
    case 'LOAN_REPAYMENT':
      return {
        label: locale === 'am' ? 'የብድር ክፍያ' : 'Loan Repaid',
        icon: RotateCcw,
        isIncoming: false,
        badgeStyle:
          'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/15',
        iconColor: 'text-amber-600 dark:text-amber-400',
      };
    case 'REFUND':
      return {
        label: locale === 'am' ? 'ተመላሽ' : 'Refund',
        icon: Undo2,
        isIncoming: true,
        badgeStyle:
          'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/15',
        iconColor: 'text-cyan-600 dark:text-cyan-400',
      };
    case 'REIMBURSEMENT':
      return {
        label: locale === 'am' ? 'ካሳ / መልሶ ክፍያ' : 'Reimbursement',
        icon: Receipt,
        isIncoming: true,
        badgeStyle:
          'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20 hover:bg-teal-500/15',
        iconColor: 'text-teal-600 dark:text-teal-400',
      };
    default:
      return {
        label: kind ? kind.replace(/_/g, ' ') : 'Transaction',
        icon: Tag,
        isIncoming: false,
        badgeStyle:
          'bg-[var(--surface-ivory)] text-[var(--slate-gray)] border-[var(--border-hairline)]',
        iconColor: 'text-[var(--slate-gray)]',
      };
  }
}

export function FinancialKindBadge({
  kind,
  type,
  locale = 'en',
  showIcon = true,
  size = 'sm',
  className = '',
}: FinancialKindBadgeProps) {
  const meta = getKindMetadata(kind, type, locale);
  const Icon = meta.icon;

  const sizeClasses = {
    xs: 'px-1.5 py-0.2 text-[9px] gap-1',
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-[11px] gap-1.5',
  }[size];

  const iconSizes = {
    xs: 'size-2.5',
    sm: 'size-3',
    md: 'size-3.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md border tracking-tight shrink-0 transition-colors ${sizeClasses} ${meta.badgeStyle} ${className}`}
    >
      {showIcon ? <Icon className={`${iconSizes} ${meta.iconColor} shrink-0`} /> : null}
      <span className="capitalize">{meta.label}</span>
    </span>
  );
}
