import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  RotateCw,
  ArrowDownRight,
  ArrowUpRight,
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
  Briefcase,
  Gift,
  WalletCards,
  RotateCcw,
  ReceiptText,
  Folder,
  PieChart,
  BarChart3,
  Landmark,
  X,
  Filter,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardPeriod, DashboardResponse, Locale } from '../api/dashboard-types';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { categoryLabels } from '../i18n/catalogs';
import { formatETB, formatCompactETB } from '@/lib/utils';
import { TransactionDetailModal } from './TransactionDetailModal';

type TimeframeOption = 'daily' | 'weekly' | 'monthly' | 'all';

interface CategoryStyle {
  icon: LucideIcon | null;
  bgColor: string;
  iconColor: string;
  barColor: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  food: {
    icon: Utensils,
    bgColor: 'bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
    barColor: 'bg-amber-500',
  },
  food_groceries: {
    icon: Utensils,
    bgColor: 'bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
    barColor: 'bg-amber-500',
  },
  utilities: {
    icon: Zap,
    bgColor: 'bg-orange-500/15',
    iconColor: 'text-orange-600 dark:text-orange-400',
    barColor: 'bg-orange-500',
  },
  clothing: {
    icon: Shirt,
    bgColor: 'bg-purple-500/15',
    iconColor: 'text-purple-600 dark:text-purple-400',
    barColor: 'bg-purple-500',
  },
  transport: {
    icon: Car,
    bgColor: 'bg-cyan-500/15',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    barColor: 'bg-cyan-500',
  },
  housing: {
    icon: Home,
    bgColor: 'bg-indigo-500/15',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    barColor: 'bg-indigo-500',
  },
  telecom: {
    icon: Phone,
    bgColor: 'bg-blue-500/15',
    iconColor: 'text-blue-600 dark:text-blue-400',
    barColor: 'bg-blue-500',
  },
  health: {
    icon: HeartPulse,
    bgColor: 'bg-rose-500/15',
    iconColor: 'text-rose-600 dark:text-rose-400',
    barColor: 'bg-rose-500',
  },
  education: {
    icon: GraduationCap,
    bgColor: 'bg-teal-500/15',
    iconColor: 'text-teal-600 dark:text-teal-400',
    barColor: 'bg-teal-500',
  },
  entertainment: {
    icon: Film,
    bgColor: 'bg-pink-500/15',
    iconColor: 'text-pink-600 dark:text-pink-400',
    barColor: 'bg-pink-500',
  },
  shopping: {
    icon: ShoppingBag,
    bgColor: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    barColor: 'bg-fuchsia-500',
  },
  salary: {
    icon: Briefcase,
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    barColor: 'bg-emerald-500',
  },
  gift: {
    icon: Gift,
    bgColor: 'bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
    barColor: 'bg-amber-500',
  },
  investment: {
    icon: WalletCards,
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    barColor: 'bg-emerald-500',
  },
  refund: {
    icon: RotateCcw,
    bgColor: 'bg-emerald-500/15',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    barColor: 'bg-emerald-500',
  },
  default: {
    icon: Folder,
    bgColor: 'bg-slate-500/15',
    iconColor: 'text-slate-600 dark:text-slate-400',
    barColor: 'bg-slate-400',
  },
};

function getCategoryStyle(categoryKey: string): CategoryStyle {
  const normalized = categoryKey.toLowerCase().replace(/\s+/g, '_');
  return (
    CATEGORY_STYLES[normalized] ??
    CATEGORY_STYLES.default ?? {
      icon: Folder,
      bgColor: 'bg-slate-500/15',
      iconColor: 'text-slate-600 dark:text-slate-400',
      barColor: 'bg-slate-400',
    }
  );
}

export function AnalyticsView({
  data,
  locale,
  currentPeriod = 'month',
  onBack,
  onRefresh,
  onPeriodChange,
}: {
  data: DashboardResponse;
  locale: Locale;
  currentPeriod?: DashboardPeriod;
  onBack: () => void;
  onRefresh?: () => void;
  onPeriodChange?: (period: DashboardPeriod) => void;
}) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>(() => {
    if (currentPeriod === 'today') return 'daily';
    if (currentPeriod === 'week') return 'weekly';
    if (currentPeriod === 'all') return 'all';
    return 'monthly';
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<
    DashboardResponse['recentTransactions'][number] | null
  >(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Synchronize timeframe when currentPeriod prop changes
  useEffect(() => {
    if (currentPeriod === 'today' && timeframe !== 'daily') {
      setTimeframe('daily');
    } else if (currentPeriod === 'week' && timeframe !== 'weekly') {
      setTimeframe('weekly');
    } else if (currentPeriod === 'month' && timeframe !== 'monthly') {
      setTimeframe('monthly');
    } else if (currentPeriod === 'all' && timeframe !== 'all') {
      setTimeframe('all');
    }
  }, [currentPeriod, timeframe]);

  const { summary, expenseCategories, recentTransactions } = data;

  // 1. Timeframe-Filtered Transactions
  const timeframeTransactions = useMemo(() => {
    const allTx = recentTransactions ?? [];
    const now = new Date();

    if (timeframe === 'daily') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return allTx.filter((t) => new Date(t.occurredAt).getTime() >= todayStart);
    }

    if (timeframe === 'weekly') {
      const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return allTx.filter((t) => new Date(t.occurredAt).getTime() >= sevenDaysAgo);
    }

    return allTx;
  }, [recentTransactions, timeframe]);

  // 2. Category-Filtered Transactions (Filtered by both Timeframe AND Category)
  const filteredTransactions = useMemo(() => {
    if (!selectedCategory) return timeframeTransactions;
    const catNorm = selectedCategory.toLowerCase().trim();
    return timeframeTransactions.filter(
      (tx) =>
        tx.category?.toLowerCase() === catNorm ||
        tx.category?.replace(/_/g, ' ').toLowerCase() === catNorm,
    );
  }, [timeframeTransactions, selectedCategory]);

  // 3. Metrics calculation (Total Transactions Volume, Income, Expense, Net Savings)
  const { totalVolumeNum, totalExpenseNum, totalIncomeNum, netSavingsNum } = useMemo(() => {
    if (!selectedCategory) {
      const inc = parseFloat(summary.cashInflowEtb ?? summary.incomeEtb ?? '0') || 0;
      const exp = parseFloat(summary.cashOutflowEtb ?? summary.expenseEtb ?? '0') || 0;
      const net = inc - exp;
      const totalVolume = Math.abs(inc) + Math.abs(exp);
      return {
        totalVolumeNum: totalVolume,
        totalExpenseNum: exp,
        totalIncomeNum: inc,
        netSavingsNum: net,
      };
    }

    let exp = 0;
    let inc = 0;
    for (const tx of filteredTransactions) {
      const amt = parseFloat(tx.amountEtb) || 0;
      if (tx.type === 'income') inc += amt;
      else exp += amt;
    }
    return {
      totalVolumeNum: Math.abs(inc) + Math.abs(exp),
      totalExpenseNum: exp,
      totalIncomeNum: inc,
      netSavingsNum: inc - exp,
    };
  }, [summary, filteredTransactions, selectedCategory]);

  // 4. Dynamic Categories Breakdown
  const displayCategories = useMemo(() => {
    if (!selectedCategory && (timeframe === 'monthly' || timeframe === 'all')) {
      return (expenseCategories ?? []).map((c) => ({
        category: c.category,
        percentage: c.percentage,
        amountEtb: c.amountEtb,
      }));
    }

    const catMap = new Map<string, number>();
    let total = 0;
    for (const tx of timeframeTransactions) {
      if (tx.type === 'expense') {
        const amt = parseFloat(tx.amountEtb) || 0;
        total += amt;
        catMap.set(tx.category, (catMap.get(tx.category) || 0) + amt);
      }
    }

    if (total <= 0) return [];

    return Array.from(catMap.entries()).map(([category, amount]) => ({
      category,
      amountEtb: amount.toFixed(2),
      percentage: (amount / total) * 100,
    }));
  }, [expenseCategories, timeframeTransactions, timeframe, selectedCategory]);

  // 5. Dynamic Spending Activity Chart (Truly Adapts to Timeframe & Category)
  const activityData = useMemo(() => {
    const expenses = filteredTransactions.filter((tx) => tx.type === 'expense');

    if (timeframe === 'daily') {
      // 4 time buckets: Morning (06-12), Afternoon (12-18), Evening (18-24), Night (00-06)
      const buckets = [
        { label: locale === 'am' ? 'ጠዋት' : 'Morning', amount: 0 },
        { label: locale === 'am' ? 'ከሰዓት' : 'Afternoon', amount: 0 },
        { label: locale === 'am' ? 'ምሽት' : 'Evening', amount: 0 },
        { label: locale === 'am' ? 'ሌሊት' : 'Night', amount: 0 },
      ];

      for (const tx of expenses) {
        const hour = new Date(tx.occurredAt).getHours();
        const amt = parseFloat(tx.amountEtb) || 0;
        if (hour >= 6 && hour < 12) buckets[0]!.amount += amt;
        else if (hour >= 12 && hour < 18) buckets[1]!.amount += amt;
        else if (hour >= 18) buckets[2]!.amount += amt;
        else buckets[3]!.amount += amt;
      }

      const maxAmount = Math.max(...buckets.map((b) => b.amount), 1);
      const peak = Math.max(...buckets.map((b) => b.amount));

      return {
        weeks: buckets.map((w) => ({
          ...w,
          heightPct: peak > 0 ? Math.max((w.amount / maxAmount) * 100, 8) : 8,
        })),
        peak,
      };
    }

    if (timeframe === 'weekly') {
      // 7 Days of the Week: Mon -> Sun
      const dayLabelsEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const dayLabelsAm = ['ሰኞ', 'ማክ', 'ረቡዕ', 'ሐሙስ', 'አርብ', 'ቅዳሜ', 'እሁድ'];
      const buckets = Array.from({ length: 7 }, (_, i) => ({
        label: locale === 'am' ? dayLabelsAm[i]! : dayLabelsEn[i]!,
        amount: 0,
      }));

      for (const tx of expenses) {
        const d = new Date(tx.occurredAt);
        const dayIdx = (d.getDay() + 6) % 7; // Monday = 0, Sunday = 6
        const amt = parseFloat(tx.amountEtb) || 0;
        if (buckets[dayIdx]) {
          buckets[dayIdx].amount += amt;
        }
      }

      const maxAmount = Math.max(...buckets.map((b) => b.amount), 1);
      const peak = Math.max(...buckets.map((b) => b.amount));

      return {
        weeks: buckets.map((w) => ({
          ...w,
          heightPct: peak > 0 ? Math.max((w.amount / maxAmount) * 100, 8) : 8,
        })),
        peak,
      };
    }

    if (timeframe === 'all') {
      // Group by last 4 months
      const monthNamesEn = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const monthNamesAm = ['ጥር', 'የካ', 'መጋ', 'ሚያ', 'ግን', 'ሰኔ', 'ሐም', 'ነሐ', 'መስ', 'ጥቅ', 'ህዳ', 'ታኅ'];
      const now = new Date();
      const currentMonth = now.getMonth();

      const buckets = [3, 2, 1, 0].map((offset) => {
        const mIdx = (currentMonth - offset + 12) % 12;
        return {
          monthIdx: mIdx,
          label: locale === 'am' ? monthNamesAm[mIdx]! : monthNamesEn[mIdx]!,
          amount: 0,
        };
      });

      for (const tx of expenses) {
        const m = new Date(tx.occurredAt).getMonth();
        const found = buckets.find((b) => b.monthIdx === m);
        if (found) {
          found.amount += parseFloat(tx.amountEtb) || 0;
        }
      }

      const maxAmount = Math.max(...buckets.map((b) => b.amount), 1);
      const peak = Math.max(...buckets.map((b) => b.amount));

      return {
        weeks: buckets.map((w) => ({
          label: w.label,
          amount: w.amount,
          heightPct: peak > 0 ? Math.max((w.amount / maxAmount) * 100, 8) : 8,
        })),
        peak,
      };
    }

    // Default Monthly: 4 Calendar intervals (1-7, 8-14, 15-21, 22-End)
    const buckets = [
      { label: 'W1', amount: 0 },
      { label: 'W2', amount: 0 },
      { label: 'W3', amount: 0 },
      { label: 'W4', amount: 0 },
    ];

    for (const tx of expenses) {
      const day = new Date(tx.occurredAt).getDate();
      const amt = parseFloat(tx.amountEtb) || 0;
      if (day <= 7) buckets[0]!.amount += amt;
      else if (day <= 14) buckets[1]!.amount += amt;
      else if (day <= 21) buckets[2]!.amount += amt;
      else buckets[3]!.amount += amt;
    }

    const maxAmount = Math.max(...buckets.map((b) => b.amount), 1);
    const peak = Math.max(...buckets.map((b) => b.amount));

    return {
      weeks: buckets.map((w) => ({
        ...w,
        heightPct: peak > 0 ? Math.max((w.amount / maxAmount) * 100, 8) : 8,
      })),
      peak,
    };
  }, [filteredTransactions, timeframe, locale]);

  // 6. Bank Distribution
  const bankDistribution = useMemo(() => {
    const map = {
      telebirr: { name: 'Telebirr', logo: '/bank_logos/TeleBirr Logo.svg', amount: 0 },
      cbe: { name: 'CBE', logo: '/bank_logos/Commercial Bank of Ethiopia Logo.svg', amount: 0 },
      abyssinia: { name: 'Abyssinia', logo: '/bank_logos/Bank of Abyssinia Logo.svg', amount: 0 },
      cash: {
        name: locale === 'am' ? 'ጥሬ ገንዘብ' : 'Cash / Other',
        logo: '/bank_logos/TeleBirr Logo.svg',
        amount: 0,
      },
    };

    let totalExpense = 0;
    for (const tx of filteredTransactions) {
      if (tx.type === 'expense') {
        const amt = parseFloat(tx.amountEtb) || 0;
        totalExpense += amt;
        const note = (tx.note ?? '').toLowerCase();

        if (note.includes('telebirr')) {
          map.telebirr.amount += amt;
        } else if (note.includes('abyssinia') || note.includes('boa')) {
          map.abyssinia.amount += amt;
        } else if (note.includes('cbe') || note.includes('commercial')) {
          map.cbe.amount += amt;
        } else {
          map.cash.amount += amt;
        }
      }
    }

    if (totalExpense <= 0) return [];

    return Object.values(map)
      .filter((b) => b.amount > 0)
      .map((b) => ({
        ...b,
        percentage: (b.amount / totalExpense) * 100,
        amount: Math.round(b.amount),
      }));
  }, [filteredTransactions, locale]);

  // 7. Largest Outflows Top 5
  const largestOutflows = useMemo(() => {
    const expenseList = filteredTransactions.filter((t) => t.type === 'expense');
    return [...expenseList]
      .sort((a, b) => parseFloat(b.amountEtb) - parseFloat(a.amountEtb))
      .slice(0, 5);
  }, [filteredTransactions]);

  const timeframeLabels: Record<TimeframeOption, { en: string; am: string }> = {
    daily: { en: 'Daily', am: 'ዕለታዊ' },
    weekly: { en: 'Weekly', am: 'ሳምንታዊ' },
    monthly: { en: 'Monthly', am: 'ወርሃዊ' },
    all: { en: 'All Time', am: 'ሁልጊዜ' },
  };

  const handleTimeframeChange = (tf: TimeframeOption) => {
    setTimeframe(tf);
    triggerHaptic('selection');
    if (tf === 'daily') {
      onPeriodChange?.('today');
    } else if (tf === 'weekly') {
      onPeriodChange?.('week');
    } else if (tf === 'monthly') {
      onPeriodChange?.('month');
    } else if (tf === 'all') {
      onPeriodChange?.('all');
    }
  };

  const activeCategoryLabel = selectedCategory
    ? (categoryLabels[locale][selectedCategory] ??
      selectedCategory.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()))
    : null;

  return (
    <div className="flex flex-col gap-4 w-full pb-28 select-none animate-fade-in">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER BAR: Back Button, Title, Refresh
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between w-full pt-1 pb-1">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onBack();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all active:scale-95 cursor-pointer shadow-xs"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>

        <h1 className="text-base font-extrabold text-[var(--foreground)] tracking-tight">
          {locale === 'en' ? 'Financial Analytics' : 'የፋይናንስ ትንታኔ'}
        </h1>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setIsRefreshing(true);
            onRefresh?.();
            setTimeout(() => setIsRefreshing(false), 600);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all active:scale-95 cursor-pointer shadow-xs"
          aria-label="Refresh"
        >
          <RotateCw size={18} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TIMEFRAME SELECTOR (High-Visibility Emerald Active Pill)
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 p-1.5 rounded-2xl bg-[var(--secondary)]/80 border border-[var(--border)] gap-1 shadow-2xs">
        {(['daily', 'weekly', 'monthly', 'all'] as const).map((key) => {
          const active = timeframe === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleTimeframeChange(key)}
              className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                active
                  ? 'bg-[#10B981] text-white shadow-md font-black scale-100'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]/60'
              }`}
            >
              {locale === 'en' ? timeframeLabels[key].en : timeframeLabels[key].am}
            </button>
          );
        })}
      </div>

      {/* Category Filter Active Indicator Chip */}
      {selectedCategory ? (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 text-xs font-bold text-[#10B981] dark:text-[#34D399]">
          <div className="flex items-center gap-2">
            <Filter size={14} />
            <span>
              {locale === 'en' ? 'Filtering by:' : 'የተመረጠ ምድብ፡'}{' '}
              <strong>{activeCategoryLabel}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSelectedCategory(null);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-xs font-black cursor-pointer"
          >
            <X size={12} />
            <span>{locale === 'en' ? 'Clear' : 'አጥራ'}</span>
          </button>
        </div>
      ) : null}

      {/* ─────────────────────────────────────────────────────────────
          3. CARD 1: Total Transactions & Flow Summary Card
          ───────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-[var(--muted-foreground)]">
              {locale === 'en'
                ? `Total Transactions (${timeframeLabels[timeframe].en}${selectedCategory ? ` · ${activeCategoryLabel}` : ''})`
                : `ጠቅላላ ግብይት (${timeframeLabels[timeframe].am}${selectedCategory ? ` · ${activeCategoryLabel}` : ''})`}
            </span>
            <span className="text-3xl font-black tracking-tight text-[var(--foreground)] tabular-nums">
              ETB {formatETB(totalVolumeNum, locale)}
            </span>
          </div>

          <div
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${
              netSavingsNum >= 0
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
            }`}
          >
            <span>
              {netSavingsNum >= 0
                ? locale === 'en'
                  ? 'Net +ETB ' + formatETB(netSavingsNum, locale)
                  : '+ETB ' + formatETB(netSavingsNum, locale) + ' ትርፍ'
                : locale === 'en'
                  ? 'Deficit -ETB ' + formatETB(Math.abs(netSavingsNum), locale)
                  : '-ETB ' + formatETB(Math.abs(netSavingsNum), locale) + ' ጉድለት'}
            </span>
          </div>
        </div>

        <hr className="border-t border-[var(--border)]" />

        {/* 2 Metric Columns: Income & Expense */}
        <div className="grid grid-cols-2 gap-3">
          {/* Income Column */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ArrowDownRight size={18} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">
                {locale === 'en' ? 'Income' : 'ገቢ'}
              </span>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 truncate tabular-nums">
                +ETB {formatETB(totalIncomeNum, locale)}
              </span>
            </div>
          </div>

          {/* Expense Column */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <ArrowUpRight size={18} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">
                {locale === 'en' ? 'Expense' : 'ወጪ'}
              </span>
              <span className="text-xs font-black text-rose-600 dark:text-rose-400 truncate tabular-nums">
                -ETB {formatETB(totalExpenseNum, locale)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. CARD 2: Spending Activity (Bar Chart - Truly Dynamic)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-4">
        {/* Header with Peak */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={17} className="text-[#10B981]" />
            <h2 className="text-sm font-extrabold text-[var(--foreground)] tracking-tight">
              {locale === 'en'
                ? `Spending Activity (${timeframeLabels[timeframe].en})`
                : `የወጪ እንቅስቃሴ (${timeframeLabels[timeframe].am})`}
            </h2>
          </div>
          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 tabular-nums">
            {locale === 'en' ? 'Peak: ' : 'ከፍተኛ፡ '}
            ETB {formatETB(activityData.peak, locale)}
          </span>
        </div>

        {/* Bar Chart Visualization */}
        <div className="h-44 w-full flex items-end justify-between px-1 pt-6 pb-2 gap-2">
          {activityData.weeks.map((item, idx) => {
            const isHighlighted = item.amount === activityData.peak && item.amount > 0;
            const hasValue = item.amount > 0;

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center justify-end h-full gap-2 group cursor-pointer"
              >
                {/* Data Value Badge on Top */}
                <div className="h-5 flex items-center justify-center">
                  {hasValue ? (
                    <span className="text-[10px] font-bold text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors tabular-nums">
                      {formatCompactETB(item.amount)}
                    </span>
                  ) : null}
                </div>

                {/* Pill Bar */}
                <div className="w-full max-w-[48px] flex items-end justify-center h-full">
                  <div
                    style={{ height: `${item.heightPct}%` }}
                    className={`w-full transition-all duration-500 ${
                      isHighlighted
                        ? 'bg-[#10B981] rounded-2xl shadow-sm'
                        : hasValue
                          ? 'bg-[#10B981]/70 rounded-2xl'
                          : 'bg-slate-200 dark:bg-slate-700/60 rounded-full h-1.5 min-h-[6px]'
                    }`}
                  />
                </div>

                {/* Period / Interval Label */}
                <span
                  className={`text-[11px] font-bold transition-colors truncate max-w-full text-center ${
                    isHighlighted
                      ? 'text-[var(--foreground)] font-black'
                      : 'text-[var(--muted-foreground)]'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. CARD 3: Category Breakdown (Clickable Category Filters)
          ───────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart size={17} className="text-[#10B981]" />
            <h2 className="text-sm font-extrabold text-[var(--foreground)] tracking-tight">
              {locale === 'en' ? 'Category Breakdown' : 'የወጪ ምድቦች ዝርዝር'}
            </h2>
          </div>
          <span className="text-xs font-bold text-[var(--muted-foreground)]">
            {displayCategories.length} {locale === 'en' ? 'Categories' : 'ምድቦች'}
          </span>
        </div>

        {/* Category Rows (Click to Filter) */}
        {displayCategories.length > 0 ? (
          <div className="flex flex-col gap-3 pt-1">
            {displayCategories.map((cat, idx) => {
              const isSelected = selectedCategory === cat.category;
              const style = getCategoryStyle(cat.category);
              const Icon = style.icon;
              const labelName =
                categoryLabels[locale][cat.category] ??
                cat.category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

              return (
                <div
                  key={idx}
                  onClick={() => {
                    triggerHaptic('selection');
                    setSelectedCategory((prev) => (prev === cat.category ? null : cat.category));
                  }}
                  className={`flex flex-col gap-2 p-2.5 rounded-2xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#10B981]/15 border-[#10B981]'
                      : 'bg-transparent border-transparent hover:bg-[var(--secondary)]/50'
                  }`}
                >
                  {/* Row: Icon, Title, Percentage, Amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.bgColor} ${style.iconColor} font-black text-xs`}
                      >
                        {Icon ? (
                          <Icon size={16} />
                        ) : (
                          <span>{labelName.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-[var(--foreground)] truncate">
                        {labelName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-semibold text-[var(--muted-foreground)] tabular-nums">
                        {cat.percentage.toFixed(1)}%
                      </span>
                      <span className="text-xs font-extrabold text-[var(--foreground)] tabular-nums">
                        ETB {formatETB(cat.amountEtb, locale)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar underneath */}
                  <div className="w-full h-1.5 rounded-full bg-[var(--secondary)] overflow-hidden">
                    <div
                      style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                      className={`h-full rounded-full ${style.barColor} transition-all duration-500`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center rounded-2xl bg-[var(--secondary)]/40 border border-[var(--border)] flex flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
            <PieChart size={24} className="opacity-40" />
            <span className="text-xs font-bold">
              {locale === 'en'
                ? 'No category expenses recorded for this period'
                : 'ለዚህ ወቅት ምንም የወጪ ምድቦች አልተመዘገቡም'}
            </span>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          6. CARD 4: Bank Accounts Distribution
          ───────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Landmark size={17} className="text-[#10B981]" />
          <h2 className="text-sm font-extrabold text-[var(--foreground)] tracking-tight">
            {locale === 'en' ? 'Bank Accounts Distribution' : 'የባንክ አካውንቶች ክፍፍል'}
          </h2>
        </div>

        {bankDistribution.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {bankDistribution.map((bank, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between h-32 p-3.5 rounded-2xl bg-[var(--secondary)]/60 border border-[var(--border)]"
              >
                {/* Bank Logo */}
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-[var(--card)] p-1.5 shadow-2xs">
                  {bank.name.toLowerCase().includes('cash') || bank.name.includes('ጥሬ') ? (
                    <WalletCards size={20} className="text-[#10B981]" />
                  ) : (
                    <img src={bank.logo} alt={bank.name} className="h-full w-full object-contain" />
                  )}
                </div>

                {/* Bank Details */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-extrabold text-[var(--foreground)] truncate">
                    {bank.name}
                  </span>
                  <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                    {bank.percentage.toFixed(1)}%
                  </span>
                  <span className="text-xs font-black text-[var(--foreground)] tabular-nums">
                    ETB {formatETB(bank.amount, locale)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center rounded-2xl bg-[var(--secondary)]/40 border border-[var(--border)] flex flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
            <Landmark size={24} className="opacity-40" />
            <span className="text-xs font-bold">
              {locale === 'en'
                ? 'No bank account outflows recorded for this period'
                : 'ለዚህ ወቅት ምንም የባንክ ወጪዎች አልተመዘገቡም'}
            </span>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          7. CARD 5: Largest Outflows
          ───────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[var(--foreground)] tracking-tight">
            {locale === 'en' ? 'Largest Outflows' : 'ከፍተኛ ወጪዎች'}
          </h2>
          <span className="text-xs font-bold text-[var(--muted-foreground)]">
            {largestOutflows.length} {locale === 'en' ? 'Records' : 'ግብይቶች'}
          </span>
        </div>

        {largestOutflows.length > 0 ? (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {largestOutflows.map((tx, idx) => {
              const style = getCategoryStyle(tx.category);
              const Icon = style.icon;
              const noteText = tx.note || categoryLabels[locale][tx.category] || tx.category;
              const noteLower = (tx.note ?? '').toLowerCase();
              const providerName = noteLower.includes('telebirr')
                ? 'Telebirr'
                : noteLower.includes('abyssinia')
                  ? 'Abyssinia'
                  : noteLower.includes('cbe')
                    ? 'CBE'
                    : locale === 'am'
                      ? 'ጥሬ ገንዘብ'
                      : 'Cash / Other';

              const formattedDate = new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-US', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              }).format(new Date(tx.occurredAt));

              return (
                <div
                  key={tx.id || idx}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedTx(tx);
                  }}
                  className="flex items-center justify-between py-3 select-none first:pt-1 last:pb-0 cursor-pointer hover:opacity-80 active:scale-98 transition-all"
                >
                  {/* Left: Icon & Note */}
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${style.bgColor} ${style.iconColor} font-black text-xs`}
                    >
                      {Icon ? <Icon size={18} /> : <span>{noteText.charAt(0).toUpperCase()}</span>}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[var(--foreground)] truncate">
                        {noteText}
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                        {providerName} · {formattedDate}
                      </span>
                    </div>
                  </div>

                  {/* Right: Outflow Amount */}
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400 tabular-nums shrink-0">
                    -ETB {formatETB(tx.amountEtb, locale)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center rounded-2xl bg-[var(--secondary)]/40 border border-[var(--border)] flex flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
            <ReceiptText size={24} className="opacity-40" />
            <span className="text-xs font-bold">
              {locale === 'en'
                ? 'No outflows recorded for this period'
                : 'ለዚህ ወቅት ምንም ወጪዎች አልተመዘገቡም'}
            </span>
          </div>
        )}
      </div>

      {/* Transaction Edit/View Modal */}
      <TransactionDetailModal
        transaction={selectedTx}
        locale={locale}
        onClose={() => setSelectedTx(null)}
        onSuccess={onRefresh}
      />
    </div>
  );
}
