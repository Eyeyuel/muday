import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Briefcase,
  Car,
  CheckCircle2,
  Church,
  Film,
  Filter,
  Folder,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Loader2,
  MessageSquare,
  Mic,
  Phone,
  Receipt,
  ReceiptText,
  RotateCcw,
  Search,
  Shirt,
  ShoppingBag,
  Users,
  Utensils,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import type { DashboardResponse, Locale } from '../api/dashboard-types';
import { categoryLabels, movementLabels, platformLabels, t } from '../i18n/catalogs';
import { formatETB } from '@/lib/utils';
import { useDebounce } from '../hooks/use-debounce';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { getPlatformBadgeClasses } from './TransactionFeedSection';
import { TransactionDetailModal } from './TransactionDetailModal';
import { Card, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const categoryIconMap: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  food: Utensils,
  food_groceries: Utensils,
  groceries: Utensils,
  cafe: Utensils,
  transport: Car,
  rent: Home,
  housing_rent: Home,
  housing: Home,
  utilities: Zap,
  airtime_data: Phone,
  airtime_internet: Phone,
  health: HeartPulse,
  education: GraduationCap,
  family_support: Users,
  entertainment: Film,
  clothing: Shirt,
  clothing_personal_care: Shirt,
  church_charity: Church,
  church_charity_gifts: Church,
  business: ShoppingBag,
  salary: ShoppingBag,
  freelance: Briefcase,
  gift_received: Gift,
  gift: Gift,
  investment_return: WalletCards,
  investment: WalletCards,
  rental_income: Home,
  shopping_household: ShoppingBag,
  shopping: ShoppingBag,
  fees_taxes: ReceiptText,
  travel: Car,
  other: Folder,
  other_income: Folder,
  other_expense: Folder,
  borrowed_money: HandCoins,
  debt_repayment: WalletCards,
  refund: RotateCcw,
  reimbursement: ReceiptText,
};

const kindIconMap = {
  loan_received: HandCoins,
  loan_repayment: WalletCards,
  refund: RotateCcw,
  reimbursement: ReceiptText,
};

const sourceIconMap = {
  text: MessageSquare,
  voice: Mic,
  receipt: Receipt,
};

type FilterType = 'all' | 'income' | 'expense' | 'special';
type SourceFilter = 'all' | 'text' | 'voice' | 'receipt';

export function RecentTransactionsCard({
  transactions,
  locale,
  hasMore,
  loadingMore,
  loadMoreError,
  onLoadMore,
}: {
  transactions: DashboardResponse['recentTransactions'];
  locale: Locale;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreError?: boolean;
  onLoadMore?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 250);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedSource, setSelectedSource] = useState<SourceFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTx, setSelectedTx] = useState<
    DashboardResponse['recentTransactions'][number] | null
  >(null);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Auto-trigger loadMore when scrolling near bottom
  const handleScroll = () => {
    if (!listContainerRef.current || !hasMore || loadingMore || !onLoadMore) return;
    const { scrollTop, scrollHeight, clientHeight } = listContainerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      onLoadMore();
    }
  };

  // IntersectionObserver sentinel fallback
  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { root: listContainerRef.current, threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  // Unique categories for dropdown
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      set.add(tx.category);
    }
    return Array.from(set).sort();
  }, [transactions]);

  // Memoized filtering logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      if (filterType === 'income' && item.type !== 'income') return false;
      if (filterType === 'expense' && (item.type !== 'expense' || item.kind !== 'expense'))
        return false;
      if (
        filterType === 'special' &&
        !['loan_received', 'loan_repayment', 'refund', 'reimbursement'].includes(item.kind)
      ) {
        return false;
      }

      if (selectedSource !== 'all' && (item.source ?? 'text') !== selectedSource) {
        return false;
      }

      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      if (!debouncedQuery.trim()) return true;
      const query = debouncedQuery.trim().toLowerCase();
      const label = (categoryLabels[locale][item.category] ?? item.category).toLowerCase();
      const note = (item.note ?? '').toLowerCase();
      return label.includes(query) || note.includes(query);
    });
  }, [transactions, filterType, selectedSource, selectedCategory, debouncedQuery, locale]);

  if (transactions.length === 0) return null;

  return (
    <>
      <Card className="p-5 flex flex-col gap-4" aria-labelledby="recent-heading">
        {/* Header with Title & Count */}
        <CardHeader className="p-0 flex flex-row items-center justify-between">
          <CardTitle id="recent-heading" className="text-sm font-bold text-[var(--foreground)]">
            {t(locale, 'recent')}
          </CardTitle>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border)]">
            {filteredTransactions.length} / {transactions.length}
          </span>
        </CardHeader>

        {/* Search Input Control */}
        <div className="relative flex items-center w-full">
          <Search
            size={15}
            className="absolute left-3.5 text-[var(--muted-foreground)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            inputMode="search"
            className="flex h-10 w-full rounded-xl border border-[var(--input)] bg-[var(--secondary)]/50 pl-9 pr-8 text-xs font-medium text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
            placeholder={t(locale, 'searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t(locale, 'searchPlaceholder')}
          />
          {searchQuery ? (
            <button
              type="button"
              className="absolute right-2.5 p-1 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {/* Filter Bar: Kind Tabs (Theme-Aware Contrast) */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
          role="tablist"
          aria-label="Transaction Filter"
        >
          {(['all', 'income', 'expense', 'special'] as const).map((type) => {
            const active = filterType === type;
            const labelKey =
              type === 'all'
                ? 'filterAll'
                : type === 'income'
                  ? 'filterIncome'
                  : type === 'expense'
                    ? 'filterExpense'
                    : 'filterSpecial';

            // Distinct theme-aware active styles with clear legible text
            const activeStyle =
              type === 'income'
                ? 'bg-emerald-500 text-white shadow-xs ring-1 ring-emerald-600'
                : type === 'expense'
                  ? 'bg-rose-500 text-white shadow-xs ring-1 ring-rose-600'
                  : type === 'special'
                    ? 'bg-amber-500 text-white shadow-xs ring-1 ring-amber-600'
                    : 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs ring-1 ring-[var(--primary)]';

            return (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={active}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all select-none cursor-pointer border ${
                  active
                    ? `${activeStyle} border-transparent`
                    : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border-transparent'
                }`}
                onClick={() => {
                  triggerHaptic('selection');
                  setFilterType(type);
                }}
              >
                {t(locale, labelKey)}
              </button>
            );
          })}
        </div>

        {/* Secondary Filters: Channel & Category */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-0.5">
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
            <button
              type="button"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                selectedSource === 'all'
                  ? 'bg-[var(--card)] text-[var(--foreground)] border-[var(--primary)] ring-1 ring-[var(--primary)]/30 shadow-2xs'
                  : 'bg-[var(--secondary)]/60 text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]'
              }`}
              onClick={() => {
                triggerHaptic('selection');
                setSelectedSource('all');
              }}
            >
              <span className="whitespace-nowrap">{t(locale, 'filterSourceAll')}</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                selectedSource === 'voice'
                  ? 'bg-[var(--card)] text-[var(--foreground)] border-[var(--primary)] ring-1 ring-[var(--primary)]/30 shadow-2xs'
                  : 'bg-[var(--secondary)]/60 text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]'
              }`}
              onClick={() => {
                triggerHaptic('selection');
                setSelectedSource('voice');
              }}
            >
              <Mic
                size={12}
                className={selectedSource === 'voice' ? 'text-[var(--primary)]' : ''}
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">{t(locale, 'sourceVoice')}</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                selectedSource === 'receipt'
                  ? 'bg-[var(--card)] text-[var(--foreground)] border-[var(--primary)] ring-1 ring-[var(--primary)]/30 shadow-2xs'
                  : 'bg-[var(--secondary)]/60 text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]'
              }`}
              onClick={() => {
                triggerHaptic('selection');
                setSelectedSource('receipt');
              }}
            >
              <Receipt
                size={12}
                className={selectedSource === 'receipt' ? 'text-[var(--primary)]' : ''}
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">{t(locale, 'sourceReceipt')}</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                selectedSource === 'text'
                  ? 'bg-[var(--card)] text-[var(--foreground)] border-[var(--primary)] ring-1 ring-[var(--primary)]/30 shadow-2xs'
                  : 'bg-[var(--secondary)]/60 text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]'
              }`}
              onClick={() => {
                triggerHaptic('selection');
                setSelectedSource('text');
              }}
            >
              <MessageSquare
                size={12}
                className={selectedSource === 'text' ? 'text-[var(--primary)]' : ''}
                aria-hidden="true"
              />
              <span className="whitespace-nowrap">{t(locale, 'sourceText')}</span>
            </button>
          </div>

          {/* shadcn UI Category Select */}
          {uniqueCategories.length > 1 ? (
            <div className="shrink-0">
              <Select
                value={selectedCategory}
                onValueChange={(val) => {
                  triggerHaptic('selection');
                  setSelectedCategory(val);
                }}
              >
                <SelectTrigger
                  className={`h-7 rounded-lg text-xs font-semibold whitespace-nowrap gap-1.5 transition-all ${
                    selectedCategory !== 'all'
                      ? 'bg-[var(--card)] text-[var(--foreground)] border-[var(--primary)] ring-1 ring-[var(--primary)]/30'
                      : 'bg-[var(--secondary)]/60 text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]'
                  }`}
                  aria-label="Filter by Category"
                >
                  <Filter
                    size={12}
                    className={
                      selectedCategory !== 'all'
                        ? 'text-[var(--primary)]'
                        : 'text-[var(--muted-foreground)]'
                    }
                    aria-hidden="true"
                  />
                  <SelectValue placeholder={t(locale, 'filterCategoryAll')}>
                    {selectedCategory === 'all'
                      ? t(locale, 'filterCategoryAll')
                      : (categoryLabels[locale][selectedCategory] ?? selectedCategory)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end" className="min-w-[10rem]">
                  <SelectItem value="all">{t(locale, 'filterCategoryAll')}</SelectItem>
                  {uniqueCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {categoryLabels[locale][cat] ?? cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {/* Transaction List & Internal Scroll Container */}
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-[var(--muted-foreground)]">
            <p className="m-0">{t(locale, 'empty')}</p>
          </div>
        ) : (
          <div
            className="flex flex-col max-h-[380px] overflow-y-auto no-scrollbar"
            ref={listContainerRef}
            onScroll={handleScroll}
          >
            <ul className="flex flex-col gap-2 p-0 m-0 list-none">
              {filteredTransactions.map((item, idx) => {
                const label = categoryLabels[locale][item.category] ?? item.category;
                const kindLabel =
                  item.kind in movementLabels[locale]
                    ? movementLabels[locale][item.kind as keyof (typeof movementLabels)['en']]
                    : null;
                const IconComponent =
                  kindIconMap[item.kind as keyof typeof kindIconMap] ??
                  categoryIconMap[item.category.toLowerCase()] ??
                  Folder;
                const SourceIcon = sourceIconMap[item.source ?? 'text'] ?? MessageSquare;
                const isIncome = item.type === 'income';
                const note = usefulNote(item.note, label);

                const formattedDate = new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(item.occurredAt));

                return (
                  <li
                    key={`${item.occurredAt}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[var(--secondary)]/40 hover:bg-[var(--secondary)] border border-[var(--border)] transition-all active:scale-[0.98] cursor-pointer select-none"
                    tabIndex={0}
                    role="button"
                    aria-label={`${label}, ${formatETB(item.amountEtb, locale)}`}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedTx(item);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedTx(item);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs ${
                          isIncome
                            ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                        }`}
                      >
                        <IconComponent size={18} aria-hidden="true" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-xs font-bold text-[var(--foreground)] truncate">
                            {note ?? label}
                          </strong>
                          {item.platform && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-black tracking-tight shrink-0 ${getPlatformBadgeClasses(
                                item.platform,
                              )}`}
                            >
                              {platformLabels[locale][item.platform.toLowerCase()] ?? item.platform}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--muted-foreground)] truncate">
                          {note ? `${label} • ${formattedDate}` : formattedDate}
                        </span>
                        {kindLabel ? (
                          <span className="mt-0.5 inline-block text-[10px] font-semibold text-amber-500">
                            {kindLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 pl-2">
                      <span
                        className={`text-xs sm:text-sm font-black tabular-nums ${
                          isIncome ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        <span aria-hidden="true">{isIncome ? '+' : '−'}</span>
                        ETB {formatETB(item.amountEtb, locale)}
                      </span>
                      <span
                        className="text-[10px] text-[var(--muted-foreground)] opacity-70 mt-0.5"
                        title={item.source}
                      >
                        <SourceIcon size={11} aria-hidden="true" />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Infinite Scroll Sentinel & End Indicators */}
            {loadMoreError ? (
              <div
                className="flex items-center justify-center gap-2 py-3 text-xs text-[var(--expense)]"
                role="alert"
              >
                <span>{t(locale, 'loadMoreError')}</span>
                <button
                  type="button"
                  className="underline font-bold cursor-pointer"
                  onClick={onLoadMore}
                >
                  {t(locale, 'retry')}
                </button>
              </div>
            ) : hasMore ? (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center gap-2 py-4 text-xs text-[var(--muted-foreground)]"
                role="status"
              >
                <Loader2 size={15} className="animate-spin text-[var(--primary)]" />
                <span>{t(locale, 'loadingMore')}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 py-4 text-[11px] font-medium text-[var(--muted-foreground)] opacity-70">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>{t(locale, 'endOfList')}</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Transaction Detail Modal Overlay */}
      <TransactionDetailModal
        transaction={selectedTx}
        locale={locale}
        onClose={() => setSelectedTx(null)}
      />
    </>
  );
}

function usefulNote(note: string | null, categoryLabel: string): string | null {
  const normalized = note?.trim();
  if (!normalized) return null;
  const comparable = (value: string) =>
    value
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  return comparable(normalized) === comparable(categoryLabel) ? null : normalized;
}
