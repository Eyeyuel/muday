import { useMemo } from 'react';
import type { DashboardResponse, Locale } from '../api/dashboard-types';
import { MudayHeader } from './MudayHeader';
import { BalanceOverviewCard } from './BalanceOverviewCard';
import { BankAccountsCarousel } from './BankAccountsCarousel';
import { QuickActionFloatingBar } from './QuickActionFloatingBar';
import { TransactionFeedSection } from './TransactionFeedSection';

export function Dashboard({
  data,
  locale,
  currentPeriod = 'month',
  loadingMore,
  loadMoreError,
  onLoadMore,
  onOpenScanReceipt,
  onOpenVoiceNote,
  onOpenQuickAdd,
  onReviewPending,
  onOpenIncomeHistory,
  onOpenExpenseHistory,
  onPeriodChange,
  onLanguageChange,
  onOpenAnalytics,
  onRefresh,
}: {
  data: DashboardResponse;
  locale: Locale;
  currentPeriod?: 'today' | 'week' | 'month' | 'all' | 'custom';
  loadingMore?: boolean;
  loadMoreError?: boolean;
  onLoadMore?: () => void;
  onOpenScanReceipt?: () => void;
  onOpenVoiceNote?: () => void;
  onOpenQuickAdd?: () => void;
  onReviewPending?: () => void;
  onPeriodChange?: (period: 'today' | 'week' | 'month' | 'all' | 'custom') => void;
  onLanguageChange: (lang: Locale) => void;
  onOpenAnalytics: () => void;
  onOpenIncomeHistory?: () => void;
  onOpenExpenseHistory?: () => void;
  onRefresh?: () => void;
}) {
  const {
    summary,
    recentTransactions,
    hasMore,
    totalCount,
    uncategorizedCount: serverUncatCount,
  } = data;

  const uncategorizedCount = useMemo(() => {
    if (typeof serverUncatCount === 'number') return serverUncatCount;
    return (recentTransactions ?? []).filter((tx) => {
      const cat = (tx.category ?? '').toLowerCase().trim();
      return cat === 'uncategorized' || cat === 'pending' || cat === '';
    }).length;
  }, [recentTransactions, serverUncatCount]);

  const effectiveInflowEtb = summary.cashInflowEtb ?? summary.incomeEtb ?? '0.00';
  const effectiveOutflowEtb = summary.cashOutflowEtb ?? summary.expenseEtb ?? '0.00';
  const totalVolumeEtb = (
    Math.abs(Number(effectiveInflowEtb || 0)) + Math.abs(Number(effectiveOutflowEtb || 0))
  ).toFixed(2);

  return (
    <div className="flex flex-col min-h-screen w-full select-none">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP SECTION: Solid White Card Container with Rounded Bottom
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[var(--card)] rounded-b-[2.5rem] px-5 pt-3 pb-6 flex flex-col gap-1 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)]">
        {/* Muday Brand Header */}
        <MudayHeader
          locale={locale}
          onLanguageChange={onLanguageChange}
          onOpenAnalytics={onOpenAnalytics}
        />

        {/* Total Transactions Overview with Privacy Mode */}
        <BalanceOverviewCard totalAmount={totalVolumeEtb} locale={locale} />

        {/* Financial Flow & Review Carousel */}
        <BankAccountsCarousel
          incomeEtb={effectiveInflowEtb}
          expenseEtb={effectiveOutflowEtb}
          pendingCount={uncategorizedCount}
          locale={locale}
          onReviewPending={onReviewPending}
          onOpenIncomeHistory={onOpenIncomeHistory}
          onOpenExpenseHistory={onOpenExpenseHistory}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MIDDLE SECTION: Instant Direct-Capture Floating Toolbar
          ───────────────────────────────────────────────────────────── */}
      <div className="py-4 px-4 w-full flex justify-center">
        <QuickActionFloatingBar
          locale={locale}
          onOpenScanReceipt={onOpenScanReceipt}
          onOpenVoiceNote={onOpenVoiceNote}
          onOpenQuickAdd={onOpenQuickAdd}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. BOTTOM SECTION: Solid White Card Container with Rounded Top
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[var(--card)] rounded-t-[2.5rem] px-5 pt-6 pb-28 min-h-[500px] flex-1 shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.03)]">
        <TransactionFeedSection
          transactions={recentTransactions}
          locale={locale}
          currentPeriod={currentPeriod}
          totalCount={totalCount}
          uncategorizedCount={uncategorizedCount}
          bankCounts={data.bankCounts}
          hasMore={hasMore}
          loadingMore={loadingMore}
          loadMoreError={loadMoreError}
          onLoadMore={onLoadMore}
          onPeriodChange={onPeriodChange}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}
