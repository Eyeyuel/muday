import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  RotateCw,
  LayoutGrid,
  ArrowUpRight,
  ArrowDownRight,
  Utensils,
  Zap,
  Shirt,
  Car,
  HeartPulse,
  GraduationCap,
  ShoppingBag,
  Home,
  Phone,
  Film,
  Church,
  Users,
  Briefcase,
  Gift,
  WalletCards,
  RotateCcw,
  ReceiptText,
  AlertCircle,
  X,
  Loader2,
  CheckCircle2,
  Calendar,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardResponse, Locale } from '../api/dashboard-types';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { categoryLabels } from '../i18n/catalogs';
import { formatETB } from '@/lib/utils';
import { TransactionDetailModal } from './TransactionDetailModal';
import { DateRangePickerModal } from './DateRangePickerModal';
import { detectBank, KNOWN_BANKS, type BankConfig } from './TransactionFeedSection';

interface CategoryStyle {
  icon: LucideIcon | null;
  bgColor: string;
  iconColor: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  food: {
    icon: Utensils,
    bgColor: 'bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  utilities: {
    icon: Zap,
    bgColor: 'bg-orange-500/15',
    iconColor: 'text-orange-600 dark:text-orange-400',
  },
  clothing: {
    icon: Shirt,
    bgColor: 'bg-purple-500/15',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  transport: {
    icon: Car,
    bgColor: 'bg-cyan-500/15',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
  },
  housing: {
    icon: Home,
    bgColor: 'bg-indigo-500/15',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  telecom: {
    icon: Phone,
    bgColor: 'bg-blue-500/15',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  health: {
    icon: HeartPulse,
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  education: {
    icon: GraduationCap,
    bgColor: 'bg-blue-500/15',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  family_support: {
    icon: Users,
    bgColor: 'bg-teal-500/15',
    iconColor: 'text-teal-600 dark:text-teal-400',
  },
  entertainment: {
    icon: Film,
    bgColor: 'bg-rose-500/15',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  church_charity: {
    icon: Church,
    bgColor: 'bg-violet-500/15',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
  salary: {
    icon: ShoppingBag,
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  business: {
    icon: ShoppingBag,
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  freelance: {
    icon: Briefcase,
    bgColor: 'bg-blue-500/15',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  gift_received: {
    icon: Gift,
    bgColor: 'bg-pink-500/15',
    iconColor: 'text-pink-600 dark:text-pink-400',
  },
  investment_return: {
    icon: WalletCards,
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  borrowed_money: {
    icon: WalletCards,
    bgColor: 'bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  debt_repayment: {
    icon: WalletCards,
    bgColor: 'bg-rose-500/15',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  refund: {
    icon: RotateCcw,
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  reimbursement: {
    icon: ReceiptText,
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  shopping: {
    icon: ShoppingBag,
    bgColor: 'bg-pink-500/15',
    iconColor: 'text-pink-600 dark:text-pink-400',
  },
  groceries: {
    icon: ShoppingBag,
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  uncategorized: {
    icon: AlertCircle,
    bgColor: 'bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  default: {
    icon: null,
    bgColor: 'bg-slate-500/15',
    iconColor: 'text-slate-600 dark:text-slate-400',
  },
};

function getCategoryStyle(categoryKey: string): CategoryStyle {
  const normalized = categoryKey.toLowerCase().replace(/\s+/g, '_');
  return (
    CATEGORY_STYLES[normalized] ??
    CATEGORY_STYLES.default ?? {
      icon: null,
      bgColor: 'bg-slate-500/15',
      iconColor: 'text-slate-600 dark:text-slate-400',
    }
  );
}

function getDateGroupHeader(dateStr: string, locale: Locale): string {
  const date = new Date(dateStr);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return locale === 'en' ? 'TODAY' : 'ዛሬ';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return locale === 'en' ? 'YESTERDAY' : 'ትናንት';

  const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo < 7) {
    return date
      .toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US', { weekday: 'long' })
      .toUpperCase();
  }

  return date
    .toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US', {
      day: 'numeric',
      month: 'short',
    })
    .toUpperCase();
}

type TimeframeOption = 'all' | 'today' | 'week' | 'month' | 'custom';
type TypeOption = 'all' | 'expense' | 'income';
type SortOption = 'newest' | 'highest' | 'lowest';
export function HistoryView({
  data,
  locale,
  initialFilter,
  currentPeriod,
  customStartDate,
  customEndDate,
  onPeriodChange,
  hasMore,
  loadingMore,
  onLoadMore,
  onRefresh,
}: {
  data: DashboardResponse;
  locale: Locale;
  initialFilter?: string;
  currentPeriod?: 'today' | 'week' | 'month' | 'all' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
  onPeriodChange?: (
    period: 'today' | 'week' | 'month' | 'all' | 'custom',
    start?: string,
    end?: string,
  ) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
}) {
  // 1. Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [timeframe, setTimeframe] = useState<TimeframeOption>(() => {
    if (currentPeriod === 'today') return 'today';
    if (currentPeriod === 'week') return 'week';
    if (currentPeriod === 'month') return 'month';
    if (currentPeriod === 'custom') return 'custom';
    return 'all';
  });
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(() => {
    if (customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    }
    return null;
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  useEffect(() => {
    if (currentPeriod) {
      setTimeframe(currentPeriod === 'all' ? 'all' : currentPeriod);
    }
  }, [currentPeriod]);

  useEffect(() => {
    if (customStartDate && customEndDate) {
      setCustomRange({ start: customStartDate, end: customEndDate });
    }
  }, [customStartDate, customEndDate]);

  const handleTimeframeClick = (tf: TimeframeOption) => {
    triggerHaptic('selection');
    setTimeframe(tf);
    if (onPeriodChange) {
      if (tf === 'today') onPeriodChange('today');
      else if (tf === 'week') onPeriodChange('week');
      else if (tf === 'month') onPeriodChange('month');
      else if (tf === 'all') onPeriodChange('all');
    }
  };

  const isInitialType = initialFilter === 'income' || initialFilter === 'expense';
  const [typeFilter, setTypeFilter] = useState<TypeOption>(isInitialType ? initialFilter : 'all');
  const [selectedChip, setSelectedChip] = useState<string>(
    isInitialType ? 'all' : initialFilter || 'all',
  );
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    if (initialFilter === 'income' || initialFilter === 'expense') {
      setTypeFilter(initialFilter);
      setSelectedChip('all');
    } else {
      setSelectedChip(initialFilter || 'all');
      setTypeFilter('all');
    }
  }, [initialFilter]);

  const [selectedTx, setSelectedTx] = useState<
    DashboardResponse['recentTransactions'][number] | null
  >(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  // Master Transaction List
  const transactions = useMemo(() => {
    return data.recentTransactions ?? [];
  }, [data.recentTransactions]);

  // Distinct banks and categories present in transactions
  const availableBanks = useMemo(() => {
    const set = new Map<string, BankConfig>();
    for (const tx of transactions) {
      const pKey = tx.platform ? tx.platform.toLowerCase() : null;
      const normalizedKey = pKey === 'boa' ? 'abyssinia' : pKey === 'cbe_birr' ? 'cbe' : pKey;
      const b = normalizedKey
        ? KNOWN_BANKS.find((k) => k.id === normalizedKey) || detectBank(tx.note)
        : detectBank(tx.note);
      if (b && !set.has(b.id)) {
        set.set(b.id, b);
      }
    }
    return Array.from(set.values());
  }, [transactions]);

  const availableCategories = useMemo(() => {
    const fromTx = transactions.map((t) => t.category);
    const set = new Set(
      fromTx.filter(
        (c) =>
          c && c.toLowerCase().trim() !== 'uncategorized' && c.toLowerCase().trim() !== 'pending',
      ),
    );
    return Array.from(set);
  }, [transactions]);

  // Stage 1: Filter transactions by Active Timeframe
  const timeframeList = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - dayOfWeek,
    ).getTime();

    return transactions.filter((tx) => {
      const txTime = new Date(tx.occurredAt).getTime();
      const txDate = new Date(tx.occurredAt);

      if (!onPeriodChange) {
        if (timeframe === 'today' && txTime < todayStart) return false;
        if (timeframe === 'week' && txTime < weekStart) return false;
        if (
          timeframe === 'month' &&
          (txDate.getFullYear() !== now.getFullYear() || txDate.getMonth() !== now.getMonth())
        ) {
          return false;
        }
      }

      if (timeframe === 'custom' && customRange) {
        const startParts = customRange.start.split('-').map(Number);
        const endParts = customRange.end.split('-').map(Number);
        if (
          startParts.length === 3 &&
          endParts.length === 3 &&
          startParts[0] !== undefined &&
          startParts[1] !== undefined &&
          startParts[2] !== undefined &&
          endParts[0] !== undefined &&
          endParts[1] !== undefined &&
          endParts[2] !== undefined
        ) {
          const startMs = new Date(startParts[0], startParts[1] - 1, startParts[2]).getTime();
          const endMs = new Date(
            endParts[0],
            endParts[1] - 1,
            endParts[2],
            23,
            59,
            59,
            999,
          ).getTime();
          if (txTime < startMs || txTime > endMs) return false;
        }
      }

      return true;
    });
  }, [transactions, timeframe, customRange, onPeriodChange]);

  // Dynamic KPI Header: Derived strictly from timeframe period (NOT secondary feed filters)
  const dynamicKPI = useMemo(() => {
    // Authoritative server summary when currentPeriod matches active timeframe
    if (
      data?.summary &&
      ((timeframe === 'today' && currentPeriod === 'today') ||
        (timeframe === 'week' && currentPeriod === 'week') ||
        (timeframe === 'month' && currentPeriod === 'month') ||
        (timeframe === 'all' && currentPeriod === 'all') ||
        (timeframe === 'custom' && currentPeriod === 'custom'))
    ) {
      const serverInflow =
        parseFloat(data.summary.cashInflowEtb ?? data.summary.incomeEtb ?? '0') || 0;
      const serverOutflow =
        parseFloat(data.summary.cashOutflowEtb ?? data.summary.expenseEtb ?? '0') || 0;
      const totalVolume = Math.abs(serverInflow) + Math.abs(serverOutflow);

      return {
        totalVolume,
        totalExpense: serverOutflow,
        totalIncome: serverInflow,
        inflow: serverInflow,
        outflow: serverOutflow,
        count: typeof data.totalCount === 'number' ? data.totalCount : timeframeList.length,
      };
    }

    let totalInflow = 0;
    let totalOutflow = 0;

    for (const t of timeframeList) {
      const amt = parseFloat(t.amountEtb) || 0;
      const isPureIncome = t.type === 'income' || t.kind === 'income';
      const isCashInflow =
        isPureIncome || ['loan_received', 'refund', 'reimbursement'].includes(t.kind);
      const isPureExpense = t.type === 'expense' || t.kind === 'expense';
      const isCashOutflow = isPureExpense || ['loan_repayment'].includes(t.kind);

      if (isCashInflow) {
        totalInflow += amt;
      }
      if (isCashOutflow) {
        totalOutflow += amt;
      }
    }

    const totalVolume = Math.abs(totalInflow) + Math.abs(totalOutflow);

    return {
      totalVolume,
      totalExpense: totalOutflow,
      totalIncome: totalInflow,
      inflow: totalInflow,
      outflow: totalOutflow,
      count: timeframeList.length,
    };
  }, [timeframeList, data, timeframe, currentPeriod]);

  // Stage 2: Derive filteredList for Feed (Applying Type, Chip, and Search)
  const filteredList = useMemo(() => {
    return timeframeList
      .filter((tx) => {
        // 2. Transaction Type Filter
        if (typeFilter === 'expense' && tx.type !== 'expense') return false;
        if (typeFilter === 'income' && tx.type !== 'income') return false;

        // 3. Chip Selector (All, Uncategorized, Bank, or Category)
        if (selectedChip === 'uncategorized') {
          const cat = (tx.category ?? '').toLowerCase().trim();
          const isUncat = cat === 'uncategorized' || cat === 'pending' || !cat;
          if (!isUncat) return false;
        } else if (selectedChip.startsWith('bank:')) {
          const bankId = selectedChip.replace('bank:', '');
          const pKey = tx.platform ? tx.platform.toLowerCase() : null;
          const normalizedKey = pKey === 'boa' ? 'abyssinia' : pKey === 'cbe_birr' ? 'cbe' : pKey;
          const detected = normalizedKey
            ? KNOWN_BANKS.find((k) => k.id === normalizedKey) || detectBank(tx.note)
            : detectBank(tx.note);
          if (!detected || detected.id !== bankId) return false;
        } else if (selectedChip.startsWith('cat:')) {
          const targetCat = selectedChip.replace('cat:', '').toLowerCase();
          const normTxCat = (tx.category ?? '').toLowerCase();
          if (
            normTxCat !== targetCat &&
            normTxCat.replace(/_/g, ' ') !== targetCat.replace(/_/g, ' ')
          ) {
            return false;
          }
        }

        // 4. Text Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const noteMatch = (tx.note ?? '').toLowerCase().includes(q);
          const catMatch = tx.category.toLowerCase().includes(q);
          const amtMatch = tx.amountEtb.includes(q);
          const pKey = tx.platform ? tx.platform.toLowerCase() : '';
          const platformMatch = pKey.includes(q);
          const bankMatch = detectBank(tx.note)?.name.toLowerCase().includes(q) ?? false;
          if (!noteMatch && !catMatch && !amtMatch && !bankMatch && !platformMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'highest') {
          return parseFloat(b.amountEtb) - parseFloat(a.amountEtb);
        }
        if (sortBy === 'lowest') {
          return parseFloat(a.amountEtb) - parseFloat(b.amountEtb);
        }
        return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      });
  }, [timeframeList, typeFilter, selectedChip, searchQuery, sortBy]);

  // Dynamic Chip Counts (matching current timeframe & type)
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      uncategorized: 0,
    };

    for (const tx of timeframeList) {
      // Respect type
      if (typeFilter === 'expense' && tx.type !== 'expense') continue;
      if (typeFilter === 'income' && tx.type !== 'income') continue;

      counts.all = (counts.all ?? 0) + 1;

      // Uncategorized check
      const cat = (tx.category ?? '').toLowerCase().trim();
      if (cat === 'uncategorized' || cat === 'pending' || !cat) {
        counts.uncategorized = (counts.uncategorized ?? 0) + 1;
      } else {
        const catKey = `cat:${cat}`;
        counts[catKey] = (counts[catKey] ?? 0) + 1;
      }

      // Bank check
      const pKey = tx.platform ? tx.platform.toLowerCase() : null;
      const normalizedKey = pKey === 'boa' ? 'abyssinia' : pKey === 'cbe_birr' ? 'cbe' : pKey;
      const bank = normalizedKey
        ? KNOWN_BANKS.find((k) => k.id === normalizedKey) || detectBank(tx.note)
        : detectBank(tx.note);
      if (bank) {
        const bankKey = `bank:${bank.id}`;
        counts[bankKey] = (counts[bankKey] ?? 0) + 1;
      }
    }

    return counts;
  }, [timeframeList, typeFilter]);

  // Group by Date for UI List
  const groupedByDate = useMemo(() => {
    const map = new Map<string, typeof filteredList>();

    for (const tx of filteredList) {
      const header = getDateGroupHeader(tx.occurredAt, locale);
      if (!map.has(header)) {
        map.set(header, []);
      }
      map.get(header)!.push(tx);
    }

    return Array.from(map.entries());
  }, [filteredList, locale]);

  return (
    <div className="flex flex-col w-full pb-32 select-none animate-fade-in">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP LIVE DYNAMIC SUMMARY BAR (Solid Premium Card)
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[var(--card)] rounded-b-[2.5rem] px-5 pt-3 pb-6 flex flex-col gap-4 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)]">
        {/* Brand & Refresh */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="Muday" className="h-8 w-8 object-contain" />
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-[var(--foreground)]">
                MUDAY
              </span>
              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                {locale === 'en' ? 'Transaction History' : 'የግብይት ታሪክ'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Active Record Match Counter */}
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)] tabular-nums">
              {dynamicKPI.count} {locale === 'en' ? 'records' : 'ግብይቶች'}
            </span>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onRefresh?.();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--secondary)]/80 text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all active:scale-95 cursor-pointer shadow-2xs"
              aria-label="Refresh"
            >
              <RotateCw size={16} />
            </button>
          </div>
        </div>

        {/* 3-Card Dynamic KPI Banner (Total, Income, Expense) */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {/* 1. Total Activity Volume (Inflow + Outflow) */}
          <div className="p-3 rounded-2xl bg-[var(--secondary)]/60 border border-[var(--border)] flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--muted-foreground)]">
              <ReceiptText size={12} />
              <span>{locale === 'en' ? 'Total' : 'ጠቅላላ'}</span>
            </div>
            <span className="text-sm font-black text-[var(--foreground)] tabular-nums truncate">
              {formatETB(dynamicKPI.totalVolume, locale)}
            </span>
          </div>

          {/* 2. Total Income (Inflow) */}
          <div className="p-3 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={12} />
              <span>{locale === 'en' ? 'Income' : 'ገቢ'}</span>
            </div>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
              {formatETB(dynamicKPI.totalIncome, locale)}
            </span>
          </div>

          {/* 3. Total Expense (Outflow) */}
          <div className="p-3 rounded-2xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
              <TrendingDown size={12} />
              <span>{locale === 'en' ? 'Expense' : 'ወጪ'}</span>
            </div>
            <span className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums truncate">
              {formatETB(dynamicKPI.totalExpense, locale)}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MULTI-DIMENSIONAL FILTER CONTROLS
          ───────────────────────────────────────────────────────────── */}
      <div className="py-3 px-4 flex flex-col gap-3 w-full">
        {/* Search & Sort Row */}
        <div className="flex items-center gap-2 w-full">
          {/* Search Box */}
          <div className="relative flex items-center flex-1">
            <Search size={15} className="absolute left-3 text-[var(--muted-foreground)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                locale === 'en'
                  ? 'Search notes, category, bank, or ETB...'
                  : 'ማስታወሻ፣ ምድብ፣ ባንክ ወይም መጠን ፈልግ...'
              }
              className="w-full h-10 pl-8 pr-7 rounded-2xl bg-white dark:bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#10B981] shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Sort Dropdown */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                if (sortBy === 'newest') setSortBy('highest');
                else if (sortBy === 'highest') setSortBy('lowest');
                else setSortBy('newest');
              }}
              className="flex items-center gap-1.5 h-10 px-3 rounded-2xl bg-white dark:bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] hover:border-[#10B981] shadow-2xs transition-all cursor-pointer active:scale-95"
              title="Sort Transactions"
            >
              <ArrowUpDown size={13} className="text-[#10B981]" />
              <span className="text-[11px]">
                {sortBy === 'newest' && (locale === 'en' ? 'Newest' : 'አዳዲስ')}
                {sortBy === 'highest' && (locale === 'en' ? 'Highest' : 'ከፍተኛ')}
                {sortBy === 'lowest' && (locale === 'en' ? 'Lowest' : 'ዝቅተኛ')}
              </span>
            </button>
          </div>
        </div>

        {/* 📅 Filter Dimension 1: TIMEFRAMES (Today, Week, Month, All, Custom) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* Today */}
          <button
            type="button"
            onClick={() => handleTimeframeClick('today')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
              timeframe === 'today'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-black shadow-sm ring-2 ring-emerald-500/30'
                : 'bg-white dark:bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)]'
            }`}
          >
            {locale === 'en' ? 'Today' : 'ዛሬ'}
          </button>

          {/* This Week */}
          <button
            type="button"
            onClick={() => handleTimeframeClick('week')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
              timeframe === 'week'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-black shadow-sm ring-2 ring-emerald-500/30'
                : 'bg-white dark:bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)]'
            }`}
          >
            {locale === 'en' ? 'This Week' : 'ይህ ሳምንት'}
          </button>

          {/* This Month */}
          <button
            type="button"
            onClick={() => handleTimeframeClick('month')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
              timeframe === 'month'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-black shadow-sm ring-2 ring-emerald-500/30'
                : 'bg-white dark:bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)]'
            }`}
          >
            {locale === 'en' ? 'This Month' : 'ይህ ወር'}
          </button>

          {/* All Time */}
          <button
            type="button"
            onClick={() => handleTimeframeClick('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
              timeframe === 'all'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-black shadow-sm ring-2 ring-emerald-500/30'
                : 'bg-white dark:bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)]'
            }`}
          >
            {locale === 'en' ? 'All Time' : 'ሁሉም ጊዜ'}
          </button>

          {/* Custom Date Range */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setIsDatePickerOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
              timeframe === 'custom'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-black shadow-sm ring-2 ring-emerald-500/30'
                : 'bg-white dark:bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)]'
            }`}
          >
            <Calendar size={13} />
            <span>
              {timeframe === 'custom' && customRange
                ? `${customRange.start.slice(5)} → ${customRange.end.slice(5)}`
                : locale === 'en'
                  ? 'Custom 📅'
                  : 'የተመረጠ ቀን 📅'}
            </span>
          </button>
        </div>

        {/* 💳 Filter Dimension 2: TYPE (All, Expenses Only, Income Only) */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--secondary)] border border-[var(--border)] w-full">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setTypeFilter('all');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-black shadow-md'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-semibold'
            }`}
          >
            <LayoutGrid size={14} />
            <span>{locale === 'en' ? 'All Types' : 'ሁሉም'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setTypeFilter('expense');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
              typeFilter === 'expense'
                ? 'bg-rose-600 dark:bg-rose-500 text-white font-black shadow-md'
                : 'text-[var(--muted-foreground)] hover:text-rose-500 font-semibold'
            }`}
          >
            <ArrowUpRight size={14} />
            <span>{locale === 'en' ? 'Expenses' : 'ወጪ'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setTypeFilter('income');
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs transition-all cursor-pointer ${
              typeFilter === 'income'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-black shadow-md'
                : 'text-[var(--muted-foreground)] hover:text-emerald-500 font-semibold'
            }`}
          >
            <ArrowDownRight size={14} />
            <span>{locale === 'en' ? 'Income' : 'ገቢ'}</span>
          </button>
        </div>

        {/* 🏷️ Filter Dimension 3: SMART CHIPS (All, Pending, Banks, Categories) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* All */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setSelectedChip('all');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
              selectedChip === 'all'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-black shadow-sm ring-2 ring-emerald-500/30'
                : 'bg-white dark:bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)] font-semibold'
            }`}
          >
            <span>{locale === 'en' ? 'All' : 'ሁሉም'}</span>
            <span className="text-[11px] opacity-80 tabular-nums font-bold">
              ({chipCounts.all ?? 0})
            </span>
          </button>

          {/* Pending / Uncategorized Drafts Chip */}
          {(chipCounts.uncategorized ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setSelectedChip(selectedChip === 'uncategorized' ? 'all' : 'uncategorized');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                selectedChip === 'uncategorized'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-500/40'
                  : 'bg-white dark:bg-[var(--card)] text-amber-600 dark:text-amber-400 border border-amber-500/40 hover:border-amber-500 font-semibold'
              }`}
            >
              <AlertCircle size={13} />
              <span>{locale === 'en' ? 'Pending' : 'ያልተመደቡ'}</span>
              <span className="text-[11px] opacity-90 tabular-nums font-black">
                ({chipCounts.uncategorized ?? 0})
              </span>
            </button>
          )}

          {/* Banks Chips (Real Logos) */}
          {availableBanks.map((bank) => {
            const bankKey = `bank:${bank.id}`;
            const count = chipCounts[bankKey] ?? 0;
            if (count === 0) return null;
            const isSelected = selectedChip === bankKey;

            return (
              <button
                key={bank.id}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedChip(isSelected ? 'all' : bankKey);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-black shadow-sm ring-2 ring-emerald-500/30'
                    : 'bg-white dark:bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:border-emerald-500/50 font-semibold'
                }`}
              >
                <img
                  src={bank.logo}
                  alt={bank.name}
                  className="w-3.5 h-3.5 object-contain shrink-0"
                />
                <span>{locale === 'am' ? bank.nameAm : bank.name}</span>
                <span className="text-[11px] opacity-80 tabular-nums font-bold">({count})</span>
              </button>
            );
          })}

          {/* User Categories */}
          {availableCategories.map((catKey) => {
            const countKey = `cat:${catKey.toLowerCase()}`;
            const count = chipCounts[countKey] ?? 0;
            if (count === 0) return null;
            const isSelected = selectedChip === countKey;
            const style = getCategoryStyle(catKey);
            const Icon = style.icon;
            const labelName =
              categoryLabels[locale][catKey] ??
              catKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

            return (
              <button
                key={catKey}
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedChip(isSelected ? 'all' : countKey);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-black shadow-sm ring-2 ring-emerald-500/30'
                    : 'bg-white dark:bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)] font-semibold'
                }`}
              >
                {Icon ? <Icon size={12} /> : null}
                <span>{labelName}</span>
                <span className="text-[11px] opacity-80 tabular-nums font-bold">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. DATE-GROUPED TRANSACTIONS LIST
          ───────────────────────────────────────────────────────────── */}
      <div className="px-4 flex flex-col gap-5 w-full">
        {groupedByDate.length > 0 ? (
          groupedByDate.map(([header, items], gIdx) => (
            <div key={gIdx} className="flex flex-col gap-2">
              {/* Date Header Title */}
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black tracking-wider text-[var(--muted-foreground)] uppercase">
                  {header}
                </span>
                <span className="text-[10px] font-bold text-[var(--muted-foreground)] opacity-70">
                  {items.length} {locale === 'en' ? 'items' : 'ግብይት'}
                </span>
              </div>

              {/* Transactions Container Card */}
              <div className="p-4 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col divide-y divide-[var(--border)]">
                {items.map((tx, idx) => {
                  const style = getCategoryStyle(tx.category);
                  const Icon = style.icon;
                  const pKey = tx.platform ? tx.platform.toLowerCase() : null;
                  const normalizedKey =
                    pKey === 'boa' ? 'abyssinia' : pKey === 'cbe_birr' ? 'cbe' : pKey;
                  const bank = normalizedKey
                    ? KNOWN_BANKS.find((k) => k.id === normalizedKey) || detectBank(tx.note)
                    : detectBank(tx.note);
                  const labelName =
                    categoryLabels[locale][tx.category] ??
                    tx.category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

                  const timeStr = new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  }).format(new Date(tx.occurredAt));

                  const isExpense = tx.type === 'expense';
                  const txCat = (tx.category ?? '').toLowerCase().trim();
                  const isUncat = txCat === 'uncategorized' || txCat === 'pending' || !txCat;

                  return (
                    <div
                      key={tx.id || idx}
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedTx(tx);
                      }}
                      className="flex items-center justify-between py-3 select-none first:pt-1 last:pb-1 cursor-pointer hover:opacity-80 active:scale-98 transition-all"
                    >
                      {/* Left: Bank Logo / Category Icon & Title */}
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        {bank ? (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-white/10 border border-[var(--border)] p-1.5 shadow-2xs">
                            <img
                              src={bank.logo}
                              alt={bank.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${style.bgColor} ${style.iconColor} font-black text-xs`}
                          >
                            {Icon ? (
                              <Icon size={18} />
                            ) : (
                              <span>{(tx.note || labelName).charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-bold text-[var(--foreground)] truncate">
                              {isUncat ? (locale === 'en' ? 'Uncategorized' : 'ያልተመደበ') : labelName}
                            </span>
                            {isUncat && (
                              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-black tracking-tight shrink-0">
                                {locale === 'en' ? 'PENDING' : 'ያልተመደበ'}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                            {bank ? (locale === 'am' ? bank.nameAm : bank.name) + ' · ' : ''}
                            {timeStr}
                          </span>
                        </div>
                      </div>

                      {/* Right: Amount & Currency */}
                      <div className="flex flex-col items-end shrink-0 pl-2">
                        <span
                          className={`text-xs sm:text-sm font-black tabular-nums ${
                            isExpense ? 'text-rose-500' : 'text-emerald-500'
                          }`}
                        >
                          {isExpense ? '-ETB ' : '+ETB '}
                          {formatETB(tx.amountEtb, locale)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center rounded-3xl bg-[var(--card)] border border-[var(--border)] flex flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
            <Search size={24} className="opacity-40" />
            <span className="text-xs font-bold">
              {locale === 'en' ? 'No transactions match these filters' : 'ምንም ግብይት አልተገኘም'}
            </span>
            <button
              type="button"
              onClick={() => {
                setTimeframe('all');
                setTypeFilter('all');
                setSelectedChip('all');
                setSearchQuery('');
              }}
              className="mt-2 text-xs font-bold text-[#10B981] hover:underline cursor-pointer"
            >
              {locale === 'en' ? 'Clear all filters' : 'ማጣሪያዎችን አጽዳ'}
            </button>
          </div>
        )}

        {/* Infinite Scroll / End of List indicator */}
        {transactions.length > 0 ? (
          hasMore ? (
            <div
              ref={sentinelRef}
              className="flex flex-col items-center justify-center gap-2 py-4 text-xs text-[var(--muted-foreground)]"
            >
              {loadingMore ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin text-[#10B981]" />
                  <span>
                    {locale === 'en' ? 'Loading more transactions...' : 'ተጨማሪ ግብይቶች በመጫን ላይ...'}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onLoadMore}
                  className="px-4 py-2 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] hover:border-emerald-500 transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  {locale === 'en' ? 'Load older transactions ↓' : 'የቀድሞ ግብይቶችን አሳይ ↓'}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 py-4 text-[11px] font-medium text-[var(--muted-foreground)] opacity-70">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>{locale === 'en' ? 'All transactions loaded' : 'ሁሉም ግብይቶች ተጭነዋል'}</span>
            </div>
          )
        ) : null}
      </div>

      {/* Date Range Picker Modal */}
      <DateRangePickerModal
        isOpen={isDatePickerOpen}
        locale={locale}
        initialStartDate={customRange?.start || customStartDate}
        initialEndDate={customRange?.end || customEndDate}
        onApply={(start, end) => {
          setCustomRange({ start, end });
          setTimeframe('custom');
          setIsDatePickerOpen(false);
          onPeriodChange?.('custom', start, end);
        }}
        onClose={() => setIsDatePickerOpen(false)}
      />

      {/* Transaction Edit/Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTx}
        locale={locale}
        onClose={() => setSelectedTx(null)}
        onSuccess={onRefresh}
      />
    </div>
  );
}
