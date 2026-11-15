import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Briefcase,
  Car,
  CheckCircle2,
  Church,
  Film,
  Folder,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Loader2,
  Phone,
  ReceiptText,
  RotateCcw,
  Shirt,
  ShoppingBag,
  Users,
  Utensils,
  WalletCards,
  Zap,
} from 'lucide-react';
import type { DashboardResponse, Locale } from '../api/dashboard-types';
import { categoryLabels, platformLabels, t } from '../i18n/catalogs';
import { formatETB } from '@/lib/utils';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { TransactionDetailModal } from './TransactionDetailModal';

export function getPlatformBadgeClasses(platform: string): string {
  switch (platform.toLowerCase()) {
    case 'telebirr':
      return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30';
    case 'cbe':
      return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30';
    case 'cbe_birr':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
    case 'boa':
    case 'abyssinia':
      return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30';
    case 'awash':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30';
    case 'dashen':
      return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30';
    case 'cash':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
    default:
      return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30';
  }
}

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'all';
type AccountFilter = string;

export interface BankConfig {
  id: string;
  name: string;
  nameAm: string;
  logo: string;
  keywords: string[];
}

export const KNOWN_BANKS: BankConfig[] = [
  {
    id: 'telebirr',
    name: 'Telebirr',
    nameAm: 'ቴሌብር',
    logo: '/bank_logos/TeleBirr Logo.svg',
    keywords: ['telebirr', 'tele birr', 'ethio telecom'],
  },
  {
    id: 'cbe',
    name: 'CBE',
    nameAm: 'ንግድ ባንክ',
    logo: '/bank_logos/Commercial Bank of Ethiopia Logo.svg',
    keywords: ['cbe', 'commercial bank of ethiopia', 'commercial bank', 'cbebirr'],
  },
  {
    id: 'abyssinia',
    name: 'Abyssinia',
    nameAm: 'አቢሲኒያ',
    logo: '/bank_logos/Bank of Abyssinia Logo.svg',
    keywords: ['abyssinia', 'boa', 'bank of abyssinia'],
  },
  {
    id: 'awash',
    name: 'Awash',
    nameAm: 'አዋሽ',
    logo: '/bank_logos/Awash International Bank ( No text ) Logo.svg',
    keywords: ['awash', 'awash bank', 'awash international'],
  },
  {
    id: 'dashen',
    name: 'Dashen',
    nameAm: 'ዳሽን',
    logo: '/bank_logos/Dashen Bank Logo.svg',
    keywords: ['dashen', 'dashen bank', 'amole'],
  },
  {
    id: 'coop',
    name: 'Coop',
    nameAm: 'ኦሮሚያ ህብረት ስራ',
    logo: '/bank_logos/Cooperative Bank of Oromia Logo.svg',
    keywords: ['cooperative bank', 'coop bank', 'oromia', 'coopay'],
  },
  {
    id: 'wegagen',
    name: 'Wegagen',
    nameAm: 'ወጋገን',
    logo: '/bank_logos/Wegagen Bank Logo.svg',
    keywords: ['wegagen', 'wegagen bank'],
  },
  {
    id: 'hibret',
    name: 'Hibret',
    nameAm: 'ህብረት',
    logo: '/bank_logos/Hibret Bank ( No text ) Logo.svg',
    keywords: ['hibret', 'hibret bank', 'united bank'],
  },
  {
    id: 'zemen',
    name: 'Zemen',
    nameAm: 'ዘመን',
    logo: '/bank_logos/Zemen Bank Logo.svg',
    keywords: ['zemen', 'zemen bank'],
  },
];

export function detectBank(note: string | null | undefined): BankConfig | null {
  if (!note) return null;
  const lower = note.toLowerCase();
  for (const bank of KNOWN_BANKS) {
    if (bank.keywords.some((kw) => lower.includes(kw))) {
      return bank;
    }
  }
  return null;
}

function isWithinTimeframe(occurredAt: string, timeframe: Timeframe): boolean {
  if (timeframe === 'all') return true;
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();

  if (timeframe === 'daily') {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  if (timeframe === 'weekly') {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    return date >= sevenDaysAgo;
  }

  if (timeframe === 'monthly') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  return true;
}

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
  borrowed_money: HandCoins,
  debt_repayment: WalletCards,
  refund: RotateCcw,
  reimbursement: ReceiptText,
};

export function TransactionFeedSection({
  transactions,
  locale,
  currentPeriod = 'month',
  totalCount,
  uncategorizedCount,
  bankCounts,
  hasMore,
  loadingMore,
  loadMoreError,
  onLoadMore,
  onPeriodChange,
  onRefresh,
}: {
  transactions: DashboardResponse['recentTransactions'];
  locale: Locale;
  currentPeriod?: 'today' | 'week' | 'month' | 'all' | 'custom';
  totalCount?: number;
  uncategorizedCount?: number;
  bankCounts?: Record<string, number>;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMoreError?: boolean;
  onLoadMore?: () => void;
  onPeriodChange?: (period: 'today' | 'week' | 'month' | 'all' | 'custom') => void;
  onRefresh?: () => void;
}) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>(() => {
    if (currentPeriod === 'today') return 'daily';
    if (currentPeriod === 'week') return 'weekly';
    if (currentPeriod === 'all') return 'all';
    return 'monthly';
  });
  const [selectedAccount, setSelectedAccount] = useState<AccountFilter>('all');
  const [selectedTx, setSelectedTx] = useState<
    DashboardResponse['recentTransactions'][number] | null
  >(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (currentPeriod === 'today') setSelectedTimeframe('daily');
    else if (currentPeriod === 'week') setSelectedTimeframe('weekly');
    else if (currentPeriod === 'month') setSelectedTimeframe('monthly');
    else if (currentPeriod === 'all') setSelectedTimeframe('all');
  }, [currentPeriod]);

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

  // 1. Transactions filtered by Timeframe (Daily / Weekly / Monthly / All)
  // When onPeriodChange is provided, transactions from server are already period-scoped.
  const timeScopedTransactions = useMemo(() => {
    if (onPeriodChange) {
      return transactions;
    }
    return transactions.filter((tx) => isWithinTimeframe(tx.occurredAt, selectedTimeframe));
  }, [transactions, selectedTimeframe, onPeriodChange]);

  // 2. Real dynamic counts inside active timeframe (local fallback)
  const counts = useMemo(() => {
    let pending = 0;
    const localBankCounts: Record<string, number> = {};

    for (const tx of timeScopedTransactions) {
      const cat = (tx.category ?? '').toLowerCase().trim();
      const isPending = cat === 'uncategorized' || cat === 'pending' || cat === '';
      if (isPending) pending++;

      const pKey = tx.platform ? tx.platform.toLowerCase() : null;
      const normalizedKey = pKey === 'boa' ? 'abyssinia' : pKey === 'cbe_birr' ? 'cbe' : pKey;
      const detected = normalizedKey
        ? KNOWN_BANKS.find((b) => b.id === normalizedKey) || detectBank(tx.note)
        : detectBank(tx.note);
      if (detected) {
        localBankCounts[detected.id] = (localBankCounts[detected.id] || 0) + 1;
      }
    }

    return {
      all: timeScopedTransactions.length,
      pending,
      bankCounts: localBankCounts,
    };
  }, [timeScopedTransactions]);

  // Active bank counts: use server-provided counts across full period when available
  const activeBankCounts = useMemo(() => {
    if (bankCounts && typeof bankCounts === 'object') {
      return bankCounts;
    }
    return counts.bankCounts;
  }, [bankCounts, counts.bankCounts]);

  // Server or local counts fallback
  const totalDisplayCount = typeof totalCount === 'number' ? totalCount : counts.all;
  const pendingDisplayCount =
    typeof uncategorizedCount === 'number' ? uncategorizedCount : counts.pending;

  // 3. Fully filtered transactions (Timeframe + Account/Pending Status)
  const filteredTransactions = useMemo(() => {
    return timeScopedTransactions.filter((tx) => {
      if (selectedAccount === 'all') return true;

      if (selectedAccount === 'pending') {
        const cat = (tx.category ?? '').toLowerCase().trim();
        return cat === 'uncategorized' || cat === 'pending' || cat === '';
      }

      const pKey = tx.platform ? tx.platform.toLowerCase() : null;
      const normalizedKey = pKey === 'boa' ? 'abyssinia' : pKey === 'cbe_birr' ? 'cbe' : pKey;
      const detected = normalizedKey
        ? KNOWN_BANKS.find((b) => b.id === normalizedKey) || detectBank(tx.note)
        : detectBank(tx.note);
      return detected?.id === selectedAccount;
    });
  }, [timeScopedTransactions, selectedAccount]);

  // Banks to display as filter chips:
  const visibleBanks = useMemo(() => {
    const hasAnyBankTx = Object.values(activeBankCounts).some((c) => (c ?? 0) > 0);
    return KNOWN_BANKS.filter((b) => {
      if ((activeBankCounts[b.id] ?? 0) > 0) return true;
      if (selectedAccount === b.id) return true;
      if (!hasAnyBankTx && ['telebirr', 'cbe', 'abyssinia'].includes(b.id)) return true;
      return false;
    });
  }, [activeBankCounts, selectedAccount]);

  const handleTimeframeChange = (tabId: Timeframe) => {
    triggerHaptic('selection');
    setSelectedTimeframe(tabId);
    if (onPeriodChange) {
      if (tabId === 'daily') onPeriodChange('today');
      else if (tabId === 'weekly') onPeriodChange('week');
      else if (tabId === 'monthly') onPeriodChange('month');
      else if (tabId === 'all') onPeriodChange('all');
    }
  };

  return (
    <section className="flex flex-col gap-3.5 w-full pb-20 select-none">
      {/* Section Header */}
      <h2 className="text-base font-bold text-[var(--foreground)] tracking-tight">
        {locale === 'en' ? 'Transactions' : 'ግብይቶች'}
      </h2>

      {/* Tier 1: Timeframe Segmented Control (Daily / Weekly / Monthly / All) */}
      <div className="grid grid-cols-4 p-1.5 rounded-full bg-[var(--secondary)]/80 border border-[var(--border)] gap-1">
        {(
          [
            { id: 'daily', labelEn: 'Daily', labelAm: 'ዕለታዊ' },
            { id: 'weekly', labelEn: 'Weekly', labelAm: 'ሳምንታዊ' },
            { id: 'monthly', labelEn: 'Monthly', labelAm: 'ወርሃዊ' },
            { id: 'all', labelEn: 'All', labelAm: 'ሁሉም' },
          ] as const
        ).map((tab) => {
          const active = selectedTimeframe === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTimeframeChange(tab.id)}
              className={`py-2 px-1 rounded-full text-xs transition-all cursor-pointer text-center ${
                active
                  ? 'bg-emerald-600 dark:bg-emerald-500 text-white font-black shadow-md'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-semibold'
              }`}
            >
              {locale === 'en' ? tab.labelEn : tab.labelAm}
            </button>
          );
        })}
      </div>

      {/* Tier 2: Account & Pending Filter Chips with Real SVG Bank Logos */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {/* All */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setSelectedAccount('all');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
            selectedAccount === 'all'
              ? 'bg-emerald-600 dark:bg-emerald-500 text-white font-black shadow-sm ring-2 ring-emerald-500/30'
              : 'bg-white dark:bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] font-semibold hover:border-emerald-500/50'
          }`}
        >
          <span>{locale === 'en' ? 'All' : 'ሁሉም'}</span>
          <span className="text-[11px] opacity-80 tabular-nums font-bold">
            ({totalDisplayCount})
          </span>
        </button>

        {/* Pending / Uncategorized */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setSelectedAccount('pending');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
            selectedAccount === 'pending'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-500/40'
              : pendingDisplayCount > 0
                ? 'bg-white dark:bg-[var(--card)] text-amber-600 dark:text-amber-400 border border-amber-500/40 hover:border-amber-500 font-semibold'
                : 'bg-white dark:bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] font-semibold'
          }`}
        >
          <span>{locale === 'en' ? 'Pending' : 'በመጠባበቅ ላይ'}</span>
          <span className="text-[11px] opacity-90 tabular-nums font-black">
            ({pendingDisplayCount})
          </span>
        </button>

        {/* Dynamic Bank Chips */}
        {visibleBanks.map((bank) => {
          const count = activeBankCounts[bank.id] ?? 0;
          const isSelected = selectedAccount === bank.id;
          return (
            <button
              key={bank.id}
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setSelectedAccount(bank.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-emerald-600 dark:bg-emerald-500 text-white font-black shadow-sm ring-2 ring-emerald-500/30'
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
      </div>

      {/* Transaction Cards List */}
      {filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center text-xs text-[var(--muted-foreground)]">
          <p className="m-0 font-medium">{t(locale, 'empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredTransactions.map((item, idx) => {
            const label = categoryLabels[locale][item.category] ?? item.category;
            const IconComponent = categoryIconMap[item.category.toLowerCase()] ?? Folder;
            const isIncome = item.type === 'income';
            const isUncat =
              !item.category ||
              item.category.toLowerCase() === 'uncategorized' ||
              item.category.toLowerCase() === 'pending';
            const displayTitle = isUncat ? (locale === 'en' ? 'Uncategorized' : 'ያልተመደበ') : label;

            const platformKey = item.platform?.toLowerCase();
            const platformLabel = platformKey
              ? (platformLabels[locale][platformKey] ?? item.platform)
              : null;
            const platformBadgeClass = platformKey ? getPlatformBadgeClasses(platformKey) : '';

            const bank = detectBank(item.note);
            const bankPrefix =
              !platformLabel && bank ? (locale === 'am' ? bank.nameAm : bank.name) + ' · ' : '';

            const formattedDate = new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-US', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).format(new Date(item.occurredAt));

            return (
              <div
                key={item.id || `${item.occurredAt}-${idx}`}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedTx(item);
                }}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-2xs hover:border-[var(--primary)] transition-all active:scale-98 cursor-pointer select-none"
              >
                {/* Left: Provider Icon & Details */}
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--secondary)] border border-[var(--border)] shadow-2xs">
                    <ProviderLogo
                      platform={item.platform}
                      note={item.note}
                      fallback={IconComponent}
                    />
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-[var(--foreground)] truncate">
                        {displayTitle}
                      </span>
                      {platformLabel && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-tight shrink-0 ${platformBadgeClass}`}
                        >
                          {platformLabel}
                        </span>
                      )}
                      {isUncat && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-black tracking-tight shrink-0">
                          {locale === 'en' ? 'PENDING' : 'ያልተመደበ'}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                      {bankPrefix}
                      {formattedDate}
                    </span>
                  </div>
                </div>

                {/* Right: Amount with Direction Arrow */}
                <div className="flex items-center gap-1 shrink-0 pl-2">
                  <span
                    className={`text-sm font-black tabular-nums ${
                      isIncome ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {isIncome ? '+ETB ' : '-ETB '}
                    {formatETB(item.amountEtb, locale)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Infinite Scroll / End of List */}
          {loadMoreError ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-rose-500">
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
            >
              <Loader2 size={15} className="animate-spin text-[#10B981]" />
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

      {/* Transaction Detail Bottom Sheet Drawer */}
      <TransactionDetailModal
        transaction={selectedTx}
        locale={locale}
        onClose={() => setSelectedTx(null)}
        onSuccess={onRefresh}
      />
    </section>
  );
}

function ProviderLogo({
  platform,
  note,
  fallback: FallbackIcon,
}: {
  platform?: string | null;
  note: string | null | undefined;
  fallback: ComponentType<{ size?: number; className?: string }>;
}) {
  const platformKey = platform
    ? platform.toLowerCase() === 'boa'
      ? 'abyssinia'
      : platform.toLowerCase()
    : null;
  const bank = platformKey ? KNOWN_BANKS.find((b) => b.id === platformKey) : detectBank(note);
  if (bank) {
    return <img src={bank.logo} alt={bank.name} className="h-6 w-6 object-contain" />;
  }

  return <FallbackIcon size={18} className="text-[var(--primary)]" />;
}
