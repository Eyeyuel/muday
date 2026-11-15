import { ArrowDownRight, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { formatETB } from '@/lib/utils';

export function BankAccountsCarousel({
  incomeEtb = '0.00',
  expenseEtb = '0.00',
  pendingCount = 0,
  locale,
  onReviewPending,
  onOpenIncomeHistory,
  onOpenExpenseHistory,
}: {
  incomeEtb?: string;
  expenseEtb?: string;
  pendingCount?: number;
  locale: Locale;
  onReviewPending?: () => void;
  onOpenIncomeHistory?: () => void;
  onOpenExpenseHistory?: () => void;
}) {
  return (
    <div className="w-full pb-2 select-none">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {/* 1. Total Income Card */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onOpenIncomeHistory?.();
          }}
          className="flex flex-col justify-between min-w-[135px] sm:min-w-[145px] h-[88px] p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-2xs hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all active:scale-97 cursor-pointer text-left shrink-0"
        >
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight size={13} />
            </div>
            <span className="text-[11px] font-extrabold text-[var(--foreground)] truncate">
              {locale === 'en' ? 'Income' : 'ገቢ'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              +ETB {formatETB(incomeEtb, locale)}
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {locale === 'en' ? 'All sources' : 'ከሁሉም ምንጮች'}
            </span>
          </div>
        </button>

        {/* 2. Total Expense Card */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onOpenExpenseHistory?.();
          }}
          className="flex flex-col justify-between min-w-[135px] sm:min-w-[145px] h-[88px] p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20 shadow-2xs hover:border-rose-500/40 hover:bg-rose-500/10 transition-all active:scale-97 cursor-pointer text-left shrink-0"
        >
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <ArrowDownRight size={13} />
            </div>
            <span className="text-[11px] font-extrabold text-[var(--foreground)] truncate">
              {locale === 'en' ? 'Expense' : 'ወጪ'}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-black text-rose-600 dark:text-rose-400 tabular-nums">
              -ETB {formatETB(expenseEtb, locale)}
            </span>
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {locale === 'en' ? 'Expenses' : 'የወጡ ክፍያዎች'}
            </span>
          </div>
        </button>

        {/* 3. Pending Review / Uncategorized Card */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            onReviewPending?.();
          }}
          className={`flex flex-col justify-between min-w-[135px] sm:min-w-[145px] h-[88px] p-3 rounded-2xl border shadow-2xs transition-all active:scale-97 cursor-pointer text-left shrink-0 ${
            pendingCount > 0
              ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
              : 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                pendingCount > 0
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {pendingCount > 0 ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
            </div>
            <span className="text-[11px] font-extrabold text-[var(--foreground)] truncate">
              {locale === 'en' ? 'Review' : 'ግምገማ'}
            </span>
          </div>

          <div className="flex flex-col">
            {pendingCount > 0 ? (
              <>
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {pendingCount} {locale === 'en' ? 'Uncategorized' : 'ያልተመደቡ'}
                </span>
                <span className="text-[10px] font-bold text-amber-600/80 dark:text-amber-400/80">
                  {locale === 'en' ? 'Tap to review ↗' : 'ለመገምገም ንካ ↗'}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {locale === 'en' ? 'All Categorized' : 'ሁሉም ተመድቧል'}
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {locale === 'en' ? 'Up to date' : 'ትክክለኛ ነው'}
                </span>
              </>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
