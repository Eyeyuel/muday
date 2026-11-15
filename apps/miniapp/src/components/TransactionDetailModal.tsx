import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Building2,
  Calendar,
  Wallet,
  CheckCircle2,
  Loader2,
  UtensilsCrossed,
  Bus,
  ShoppingBag,
  Home,
  Zap,
  Phone,
  Heart,
  Smile,
  Shield,
  CreditCard,
  Briefcase,
  HelpCircle,
  TrendingUp,
  Gift,
  PlusCircle,
  Layers,
  Check,
  Mic,
  Receipt,
  MessageSquare,
  Smartphone,
  Copy,
  ZoomIn,
  Image as ImageIcon,
} from 'lucide-react';
import type { DashboardResponse, Locale } from '../api/dashboard-types';
import { updateDashboardTransaction, fetchTransactionReceiptBlobUrl } from '../api/dashboard-api';
import { platformLabels } from '../i18n/catalogs';
import { Drawer, DrawerContent, DrawerTitle } from './ui/drawer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { triggerHaptic } from '@/telegram/telegram-webapp';

export type TransactionItem = DashboardResponse['recentTransactions'][number];

const PLATFORMS = [
  { key: 'cash', labelEn: 'Cash', labelAm: 'ካሽ' },
  { key: 'telebirr', labelEn: 'Telebirr', labelAm: 'ቴሌብር' },
  { key: 'cbe', labelEn: 'CBE', labelAm: 'ንግድ ባንክ' },
  { key: 'cbe_birr', labelEn: 'CBE Birr', labelAm: 'ሲቢኢ ብር' },
  { key: 'boa', labelEn: 'BoA', labelAm: 'አቢሲኒያ' },
  { key: 'awash', labelEn: 'Awash', labelAm: 'አዋሽ' },
  { key: 'dashen', labelEn: 'Dashen', labelAm: 'ዳሸን' },
] as const;

interface CategoryOption {
  key: string;
  labelEn: string;
  labelAm: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const EXPENSE_CATEGORIES: CategoryOption[] = [
  {
    key: 'food_groceries',
    labelEn: 'Food & Groceries',
    labelAm: 'ምግብ እና ግሮሰሪ',
    icon: UtensilsCrossed,
  },
  { key: 'transport', labelEn: 'Transport', labelAm: 'የትራንስፖርት', icon: Bus },
  { key: 'shopping', labelEn: 'Shopping', labelAm: 'ግዢ', icon: ShoppingBag },
  { key: 'housing', labelEn: 'Housing & Rent', labelAm: 'ቤት እና ኪራይ', icon: Home },
  { key: 'utilities', labelEn: 'Utilities', labelAm: 'መብራት / ውሃ', icon: Zap },
  { key: 'telecom', labelEn: 'Telecom & Airtime', labelAm: 'ስልክ እና ኢንተርኔት', icon: Phone },
  { key: 'health', labelEn: 'Health & Medical', labelAm: 'ጤና', icon: Heart },
  { key: 'entertainment', labelEn: 'Entertainment', labelAm: 'መዝናኛ', icon: Smile },
  { key: 'family_personal', labelEn: 'Family & Personal', labelAm: 'ቤተሰብ እና የግል', icon: Shield },
  { key: 'debt_repayment', labelEn: 'Debt Repayment', labelAm: 'የእዳ ክፍያ', icon: CreditCard },
  { key: 'business_expense', labelEn: 'Business Expense', labelAm: 'የቢዝነስ ወጪ', icon: Briefcase },
  { key: 'other', labelEn: 'Other Expense', labelAm: 'ሌላ ወጪ', icon: HelpCircle },
];

const INCOME_CATEGORIES: CategoryOption[] = [
  { key: 'salary', labelEn: 'Salary & Wages', labelAm: 'ደመወዝ', icon: Briefcase },
  { key: 'business_income', labelEn: 'Business & Sales', labelAm: 'የቢዝነስ ገቢ', icon: TrendingUp },
  { key: 'freelance', labelEn: 'Freelance & Side Gig', labelAm: 'ተጨማሪ ስራ', icon: Layers },
  {
    key: 'investment_returns',
    labelEn: 'Investment & Dividends',
    labelAm: 'ኢንቨስትመንት',
    icon: TrendingUp,
  },
  { key: 'gift_remittance', labelEn: 'Gift & Remittance', labelAm: 'ስጦታ / እርዳታ', icon: Gift },
  { key: 'other_income', labelEn: 'Other Income', labelAm: 'ሌላ ገቢ', icon: PlusCircle },
];

interface TransactionDetailModalProps {
  transaction: TransactionItem | null;
  locale: Locale;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TransactionDetailModal({
  transaction,
  locale,
  onClose,
  onSuccess,
}: TransactionDetailModalProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [orderedExpenseList, setOrderedExpenseList] =
    useState<CategoryOption[]>(EXPENSE_CATEGORIES);
  const [orderedIncomeList, setOrderedIncomeList] = useState<CategoryOption[]>(INCOME_CATEGORIES);
  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToastText, setSuccessToastText] = useState<string | null>(null);
  const [receiptBlobUrl, setReceiptBlobUrl] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState(false);
  const [isReceiptZoomed, setIsReceiptZoomed] = useState(false);
  const [transcriptCopied, setTranscriptCopied] = useState(false);

  // Prepopulate state and order categories ONLY when a new transaction is selected/opened
  useEffect(() => {
    if (transaction) {
      const txType = transaction.type || 'expense';
      setType(txType);
      setSelectedPlatform(transaction.platform ?? null);

      const rawCat = (transaction.category ?? '').toLowerCase().trim();
      const isUncategorized = rawCat === 'uncategorized' || rawCat === 'pending' || rawCat === '';

      if (isUncategorized) {
        // Uncategorized transaction: nothing selected, default category order
        setSelectedCategory('');
        setOrderedExpenseList(EXPENSE_CATEGORIES);
        setOrderedIncomeList(INCOME_CATEGORIES);
      } else {
        // Categorized transaction: selected category comes first in the list on open
        setSelectedCategory(rawCat);

        const expMatch = EXPENSE_CATEGORIES.find(
          (c) =>
            c.key.toLowerCase() === rawCat || c.key.replace(/_/g, ' ').toLowerCase() === rawCat,
        );
        if (expMatch) {
          setOrderedExpenseList([
            expMatch,
            ...EXPENSE_CATEGORIES.filter((c) => c.key !== expMatch.key),
          ]);
        } else {
          setOrderedExpenseList(EXPENSE_CATEGORIES);
        }

        const incMatch = INCOME_CATEGORIES.find(
          (c) =>
            c.key.toLowerCase() === rawCat || c.key.replace(/_/g, ' ').toLowerCase() === rawCat,
        );
        if (incMatch) {
          setOrderedIncomeList([
            incMatch,
            ...INCOME_CATEGORIES.filter((c) => c.key !== incMatch.key),
          ]);
        } else {
          setOrderedIncomeList(INCOME_CATEGORIES);
        }
      }

      setAmount(transaction.amountEtb || '');
      setNote(transaction.note || '');
      setErrorMessage(null);
      setSuccessToastText(null);
      setTranscriptCopied(false);

      // Fetch receipt image if transaction has an image attached
      if ((transaction.receiptImagePath || transaction.source === 'receipt') && transaction.id) {
        setReceiptLoading(true);
        setReceiptError(false);
        let active = true;
        fetchTransactionReceiptBlobUrl(transaction.id)
          .then((url) => {
            if (active) setReceiptBlobUrl(url);
          })
          .catch(() => {
            if (active) setReceiptError(true);
          })
          .finally(() => {
            if (active) setReceiptLoading(false);
          });
        return () => {
          active = false;
        };
      } else {
        setReceiptBlobUrl(null);
        setReceiptLoading(false);
        setReceiptError(false);
      }
    }
  }, [transaction]);

  // Handle switching between Expense and Income toggles
  const handleTypeChange = (newType: 'expense' | 'income') => {
    if (newType === type) return;
    triggerHaptic('light');
    setType(newType);

    if (selectedCategory) {
      const targetList = newType === 'expense' ? orderedExpenseList : orderedIncomeList;
      const existsInTarget = targetList.some(
        (c) =>
          c.key.toLowerCase() === selectedCategory.toLowerCase() ||
          c.key.replace(/_/g, ' ').toLowerCase() === selectedCategory.toLowerCase(),
      );

      if (!existsInTarget) {
        setSelectedCategory('');
      }
    }
  };

  // Active category list based on Expense vs Income (frozen order while modal is open)
  const activeList = type === 'expense' ? orderedExpenseList : orderedIncomeList;

  if (!transaction) return null;

  // Detect payment source / bank name
  const noteLower = (transaction.note ?? '').toLowerCase();
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(transaction.occurredAt));

  const handleCopyTranscript = (text: string) => {
    triggerHaptic('selection');
    void navigator.clipboard.writeText(text);
    setTranscriptCopied(true);
    setTimeout(() => setTranscriptCopied(false), 2000);
  };

  const getSourceInfo = () => {
    const src = transaction.source?.toLowerCase();
    const raw = (transaction.rawTranscript || '').toLowerCase();
    if (src === 'voice') {
      return {
        icon: Mic,
        label: locale === 'en' ? 'Voice Note Speech-to-Text' : 'የድምፅ መልእክት ጽሑፍ',
        badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25',
      };
    }
    if (src === 'receipt' || transaction.receiptImagePath) {
      return {
        icon: Receipt,
        label: locale === 'en' ? 'Receipt Scan (AI Vision)' : 'የደረሰኝ ስካን (AI ቪዥን)',
        badgeColor: 'text-blue-500 bg-blue-500/10 border-blue-500/25',
      };
    }
    if (
      raw.startsWith('sms:') ||
      raw.startsWith('bank_sms:') ||
      raw.includes('you have received') ||
      raw.includes('debited') ||
      raw.includes('transferred')
    ) {
      return {
        icon: Smartphone,
        label: locale === 'en' ? 'Bank SMS Payment Alert' : 'የባንክ SMS መልእክት',
        badgeColor: 'text-purple-500 bg-purple-500/10 border-purple-500/25',
      };
    }
    return {
      icon: MessageSquare,
      label: locale === 'en' ? 'Original Input Text' : 'የመጀመሪያው የተጻፈው ጽሑፍ',
      badgeColor: 'text-sky-500 bg-sky-500/10 border-sky-500/25',
    };
  };

  const sourceInfo = getSourceInfo();
  const SourceIcon = sourceInfo.icon;

  const handleSave = async () => {
    if (!transaction.id) {
      onClose();
      return;
    }
    const cleanAmount = parseFloat(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setErrorMessage(
        locale === 'en' ? 'Please enter a valid positive amount' : 'እባክዎ ትክክለኛ መጠን ያስገቡ',
      );
      triggerHaptic('warning');
      return;
    }

    if (
      !selectedCategory ||
      selectedCategory === 'uncategorized' ||
      selectedCategory === 'pending'
    ) {
      setErrorMessage(
        locale === 'en'
          ? 'Please select a category to organize this transaction.'
          : 'እባክዎ ለዚህ ግብይት ምድብ ይምረጡ።',
      );
      triggerHaptic('warning');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateDashboardTransaction(transaction.id, {
        amountEtb: cleanAmount.toFixed(2),
        category: selectedCategory,
        type,
        note: note.trim() || undefined,
        platform: selectedPlatform ?? undefined,
      });

      triggerHaptic('success');
      setSuccessToastText(
        locale === 'en' ? 'Transaction updated successfully!' : 'ግብይቱ በትክክል ተስተካክሏል!',
      );

      setTimeout(() => {
        setSuccessToastText(null);
        onSuccess?.();
        onClose();
      }, 700);
    } catch {
      setErrorMessage(
        locale === 'en'
          ? 'Failed to update transaction. Please try again.'
          : 'ግብይቱን ማስተካከል አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
      );
      triggerHaptic('error');
    } finally {
      setIsSaving(false);
    }
  };

  const isExpense = type === 'expense';

  return (
    <Drawer open={Boolean(transaction)} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="p-5 max-w-md mx-auto rounded-t-[2.5rem] bg-[var(--card)] text-[var(--foreground)] shadow-2xl border-t border-[var(--border)] max-h-[92vh] flex flex-col">
        {/* 1. Header Bar: Subtitle & Big Close Button */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[var(--border)]/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Building2 size={18} />
            </div>
            <div className="flex flex-col text-left">
              <DrawerTitle className="text-sm font-extrabold text-[var(--foreground)]">
                {locale === 'en' ? 'Transaction details' : 'የግብይት ዝርዝሮች'}
              </DrawerTitle>
              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                {locale === 'en' ? 'Edit, categorize or correct records' : 'ያስተካክሉ ወይም ምድብ ይምረጡ'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success Toast Feedback */}
        {successToastText && (
          <div className="my-2 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 animate-in fade-in zoom-in-95 duration-200">
            <CheckCircle2 size={16} />
            <span>{successToastText}</span>
          </div>
        )}

        {/* 2. Scrollable Body Form Fields */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-3.5 space-y-4">
          {/* Metadata Badges: Date & Payment Provider */}
          <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-[var(--secondary)]/40 border border-[var(--border)]/60">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
              <Calendar size={13} className="text-emerald-500 shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--foreground)] px-2.5 py-1 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-2xs">
              <Wallet size={12} className="text-emerald-500 shrink-0" />
              <span>
                {selectedPlatform
                  ? (platformLabels[locale][selectedPlatform.toLowerCase()] ?? selectedPlatform)
                  : providerName}
              </span>
            </div>
          </div>

          {/* 3. Expense vs Income Segmented Switcher */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--foreground)]">
              {locale === 'en' ? 'Type' : 'አይነት'}
            </label>
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--secondary)]/70 border border-[var(--border)]">
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  isExpense
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {locale === 'en' ? 'Expense' : 'ወጪ'}
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                  !isExpense
                    ? 'bg-[#10B981] text-white shadow-xs'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {locale === 'en' ? 'Income' : 'ገቢ'}
              </button>
            </div>
          </div>

          {/* 4. Amount Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[var(--foreground)]">
              {locale === 'en' ? 'Amount (ETB)' : 'መጠን (ብር)'}
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-13 rounded-2xl bg-[var(--secondary)]/60 border-[var(--border)] text-base font-black text-[var(--foreground)] pl-4 pr-16 focus-visible:ring-2 focus-visible:ring-[#10B981]"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-[var(--muted-foreground)]">
                ETB
              </span>
            </div>
          </div>

          {/* 5. Category Selection */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--foreground)]">
                {isExpense
                  ? locale === 'en'
                    ? `What was this ${providerName} expense for?`
                    : `ይህ የ${providerName} ወጪ ለምን ነበር?`
                  : locale === 'en'
                    ? `What was the source of this ${providerName} income?`
                    : `ይህ የ${providerName} ገቢ ከምን የተገኘ ነበር?`}
              </label>
              {!selectedCategory && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  {locale === 'en' ? 'Select Category' : 'ምድብ ይምረጡ'}
                </span>
              )}
            </div>

            {/* Horizontal Scrollable Category Pills */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
              {activeList.map((cat) => {
                const isSelected =
                  Boolean(selectedCategory) &&
                  (selectedCategory.toLowerCase() === cat.key.toLowerCase() ||
                    selectedCategory.toLowerCase() === cat.key.replace(/_/g, ' ').toLowerCase());
                const Icon = cat.icon;

                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedCategory(cat.key);
                      setErrorMessage(null);
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-black shrink-0 transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-[#10B981]/20 text-[#10B981] dark:text-[#34D399] border-2 border-[#10B981] shadow-xs'
                        : 'bg-[var(--secondary)]/60 text-[var(--foreground)] border border-[var(--border)] hover:border-[#10B981]'
                    }`}
                  >
                    {isSelected ? (
                      <Check size={14} className="text-[#10B981] dark:text-[#34D399] stroke-[3]" />
                    ) : (
                      <Icon size={14} className="text-[var(--muted-foreground)]" />
                    )}
                    <span>{locale === 'en' ? cat.labelEn : cat.labelAm}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Payment Channel / Platform Selection */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--foreground)]">
                {locale === 'en' ? 'Payment Channel / Platform' : 'የክፍያ መንገድ / ፕላትፎርም'}
              </label>
              {selectedPlatform && (
                <button
                  type="button"
                  onClick={() => setSelectedPlatform(null)}
                  className="text-[10px] text-[var(--muted-foreground)] hover:text-rose-500 font-semibold cursor-pointer"
                >
                  {locale === 'en' ? 'Clear' : 'አጥፋ'}
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
              {PLATFORMS.map((p) => {
                const isSelected = selectedPlatform?.toLowerCase() === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setSelectedPlatform(isSelected ? null : p.key);
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs'
                        : 'bg-[var(--secondary)]/60 text-[var(--foreground)] border border-[var(--border)] hover:border-emerald-500'
                    }`}
                  >
                    {isSelected && <Check size={13} className="stroke-[3]" />}
                    <span>{locale === 'en' ? p.labelEn : p.labelAm}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. Note / Memo Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--foreground)]">
                {locale === 'en' ? 'Note / Description' : 'ማስታወሻ / ዝርዝር'}
              </label>
              <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">
                {locale === 'en' ? 'Optional' : 'አማራጭ'}
              </span>
            </div>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                locale === 'en' ? 'Optional note, e.g. coffee at Tomoca' : 'ማስታወሻ ለምሳሌ ቡና ቶሞካ'
              }
              className="h-13 rounded-2xl bg-[var(--secondary)]/60 border-[var(--border)] text-sm font-medium text-[var(--foreground)] px-4 focus-visible:ring-2 focus-visible:ring-[#10B981]"
            />
          </div>

          {/* 8. Raw Input / Voice Audio Transcript / Bank SMS Text */}
          {transaction.rawTranscript && (
            <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-[var(--secondary)]/40 border border-[var(--border)]/70 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--foreground)]">
                  <div className={`p-1 rounded-lg border ${sourceInfo.badgeColor}`}>
                    <SourceIcon size={13} />
                  </div>
                  <span>{sourceInfo.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyTranscript(transaction.rawTranscript || '')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--muted-foreground)] hover:text-emerald-500 transition-colors cursor-pointer"
                >
                  {transcriptCopied ? (
                    <Check size={13} className="text-emerald-500" />
                  ) : (
                    <Copy size={13} />
                  )}
                  <span>
                    {transcriptCopied
                      ? locale === 'en'
                        ? 'Copied'
                        : 'ተቀድቷል'
                      : locale === 'en'
                        ? 'Copy'
                        : 'ቅዳ'}
                  </span>
                </button>
              </div>
              <div className="mt-1 p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-medium text-[var(--foreground)] leading-relaxed whitespace-pre-wrap select-text">
                "{transaction.rawTranscript}"
              </div>
            </div>
          )}

          {/* 9. Scanned Receipt Image Card (if available) */}
          {(transaction.source === 'receipt' ||
            transaction.receiptImagePath ||
            receiptBlobUrl ||
            receiptLoading) && (
            <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-[var(--secondary)]/40 border border-[var(--border)]/70 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--foreground)]">
                  <div className="p-1 rounded-lg border text-blue-500 bg-blue-500/10 border-blue-500/25">
                    <Receipt size={13} />
                  </div>
                  <span>{locale === 'en' ? 'Scanned Receipt Photo' : 'የተቃኘው ደረሰኝ ፎቶ'}</span>
                </div>
                {receiptBlobUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setIsReceiptZoomed(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <ZoomIn size={13} />
                    <span>{locale === 'en' ? 'Zoom Photo' : 'አጉልተህ እይ'}</span>
                  </button>
                )}
              </div>

              {receiptLoading ? (
                <div className="h-36 rounded-xl bg-[var(--card)] border border-[var(--border)] flex flex-col items-center justify-center gap-2 text-[var(--muted-foreground)] text-xs font-medium animate-pulse">
                  <Loader2 size={20} className="animate-spin text-blue-500" />
                  <span>
                    {locale === 'en'
                      ? 'Loading receipt image...'
                      : 'የደረሰኝ ፎቶ እየመጣ ነው...'}
                  </span>
                </div>
              ) : receiptError || !receiptBlobUrl ? (
                <div className="p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] flex items-center gap-2">
                  <ImageIcon size={16} className="text-amber-500 shrink-0" />
                  <span>
                    {locale === 'en'
                      ? 'Receipt photo is archived or unavailable.'
                      : 'የደረሰኙ ፎቶ አልተገኘም።'}
                  </span>
                </div>
              ) : (
                <div
                  onClick={() => {
                    triggerHaptic('light');
                    setIsReceiptZoomed(true);
                  }}
                  className="relative group rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--card)] max-h-48 flex items-center justify-center cursor-pointer shadow-2xs"
                >
                  <img
                    src={receiptBlobUrl}
                    alt="Transaction Receipt"
                    className="w-full max-h-48 object-contain rounded-xl transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                    <ZoomIn size={16} />
                    <span>{locale === 'en' ? 'Tap to view full receipt' : 'ሙሉውን ለማየት ይጫኑ'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message Feedback */}
          {errorMessage ? (
            <div className="text-xs font-bold text-rose-500 bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20">
              {errorMessage}
            </div>
          ) : null}
        </div>

        {/* 10. Primary Green Save Button */}
        <div className="pt-2 border-t border-[var(--border)]/70 mt-auto">
          <Button
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaving}
            className="w-full h-13 text-sm font-black rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-98 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin mr-2" />
            ) : (
              <CheckCircle2 size={16} className="mr-2" />
            )}
            <span>
              {isExpense
                ? locale === 'en'
                  ? 'Save expense'
                  : 'ወጪውን አስቀምጥ'
                : locale === 'en'
                  ? 'Save income'
                  : 'ገቢውን አስቀምጥ'}
            </span>
          </Button>
        </div>

        {/* Full-Screen Receipt Lightbox Modal */}
        {isReceiptZoomed &&
          receiptBlobUrl &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
              onClick={() => setIsReceiptZoomed(false)}
            >
              <button
                type="button"
                onClick={() => setIsReceiptZoomed(false)}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                aria-label="Close zoomed receipt"
              >
                <X size={22} />
              </button>
              <div
                className="max-w-xl max-h-[85vh] overflow-auto flex items-center justify-center p-2"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={receiptBlobUrl}
                  alt="Full Scanned Receipt"
                  className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
                />
              </div>
              <span className="mt-3 text-xs font-medium text-white/70">
                {locale === 'en'
                  ? 'Tap anywhere or close to return'
                  : 'ለመመለስ በማንኛውም ቦታ ይጫኑ'}
              </span>
            </div>,
            document.body,
          )}
      </DrawerContent>
    </Drawer>
  );
}
