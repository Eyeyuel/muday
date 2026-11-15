import { useState, useEffect } from 'react';
import {
  PlusCircle,
  X,
  Utensils,
  Car,
  Zap,
  ShoppingBag,
  Briefcase,
  HeartPulse,
  TrendingUp,
  Gift,
  Building,
  Wallet,
  GraduationCap,
  Film,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  Check,
  type LucideIcon,
} from 'lucide-react';
import type { Locale, MatchCandidateItem } from '../api/dashboard-types';
import {
  createDashboardTransaction,
  fetchDashboardCategories,
  fetchMatchCandidates,
  linkCandidateTransaction,
} from '../api/dashboard-api';
import { categoryLabels, t } from '../i18n/catalogs';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { SmartMatchSuggestionCard } from './SmartMatchSuggestionCard';

const ICON_MAP: Record<string, LucideIcon> = {
  food_groceries: Utensils,
  food: Utensils,
  transport: Car,
  utilities: Zap,
  shopping_clothing: ShoppingBag,
  shopping: ShoppingBag,
  clothing: ShoppingBag,
  health: HeartPulse,
  education: GraduationCap,
  entertainment: Film,
  salary: Briefcase,
  business: Building,
  investment: TrendingUp,
  gift: Gift,
  loan_received: Wallet,
  borrowed_money: Wallet,
  other_income: MoreHorizontal,
  other_expense: MoreHorizontal,
};

const DEFAULT_EXPENSE = [
  'food_groceries',
  'transport',
  'utilities',
  'shopping_clothing',
  'health',
  'education',
  'entertainment',
  'other_expense',
];

const DEFAULT_INCOME = [
  'salary',
  'business',
  'investment',
  'gift',
  'loan_received',
  'other_income',
];

export function AddTransactionModal({
  isOpen,
  onClose,
  locale,
  initialText,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
  initialText?: string;
  onSuccess?: () => void;
}) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food_groceries');
  const [note, setNote] = useState(initialText ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [expenseCategories, setExpenseCategories] = useState<string[]>(DEFAULT_EXPENSE);
  const [incomeCategories, setIncomeCategories] = useState<string[]>(DEFAULT_INCOME);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // 🔗 Smart Match Candidate State
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidateItem[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>(undefined);
  const [isLinking, setIsLinking] = useState(false);

  // Fetch categories live from the backend
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingCategories(true);

    void fetchDashboardCategories()
      .then((res) => {
        if (!isMounted) return;

        // Separate user categories by type
        const userExpense = res.userCategories
          .filter((c) => c.type === 'expense')
          .map((c) => c.label);
        const userIncome = res.userCategories
          .filter((c) => c.type === 'income')
          .map((c) => c.label);

        // Deduplicate with defaults
        const mergedExpense = Array.from(
          new Set([...userExpense, ...(res.defaultExpenseCategories || DEFAULT_EXPENSE)]),
        );
        const mergedIncome = Array.from(
          new Set([...userIncome, ...(res.defaultIncomeCategories || DEFAULT_INCOME)]),
        );

        setExpenseCategories(mergedExpense);
        setIncomeCategories(mergedIncome);
      })
      .catch(() => {
        // Fallback to default lists
      })
      .finally(() => {
        if (isMounted) setIsLoadingCategories(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Debounced check for matching pending bank drafts
  useEffect(() => {
    const amtNum = parseFloat(amount.trim());
    if (isNaN(amtNum) || amtNum <= 0) {
      setMatchCandidates([]);
      setSelectedCandidateId(undefined);
      return;
    }

    const timer = setTimeout(() => {
      void fetchMatchCandidates(String(amtNum), type).then((cands) => {
        setMatchCandidates(cands);
        if (cands[0]) setSelectedCandidateId(cands[0].id);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [amount, type]);

  const activeCategoryList = type === 'expense' ? expenseCategories : incomeCategories;

  const handleTypeChange = (newType: 'expense' | 'income') => {
    triggerHaptic('selection');
    setType(newType);
    setErrorMsg(null);
    const list = newType === 'expense' ? expenseCategories : incomeCategories;
    setCategory(list[0] || (newType === 'expense' ? 'food_groceries' : 'salary'));
  };

  const handleLinkCandidate = async (candidate: MatchCandidateItem) => {
    if (isLinking) return;

    try {
      setIsLinking(true);
      setErrorMsg(null);
      await linkCandidateTransaction({
        targetId: candidate.id,
        targetType: candidate.targetType,
        category,
        note: note.trim() || undefined,
        type,
      });

      triggerHaptic('success');
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setAmount('');
        setNote('');
        setMatchCandidates([]);
        onSuccess?.();
        onClose();
      }, 500);
    } catch {
      setErrorMsg(
        locale === 'en'
          ? 'Failed to link transaction. Please try again.'
          : 'ግብይቱን ማገናኘት አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
      );
      triggerHaptic('error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount.trim());
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg(
        locale === 'en'
          ? 'Please enter a valid amount greater than 0'
          : 'እባክዎ ከ 0 የሚበልጥ ትክክለኛ መጠን ያስገቡ',
      );
      triggerHaptic('warning');
      return;
    }

    if (isSaving) return;

    try {
      setIsSaving(true);
      setErrorMsg(null);
      await createDashboardTransaction({
        type,
        amountEtb: String(numAmount),
        category,
        note: note.trim() || undefined,
        source: 'text',
      });

      triggerHaptic('success');
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        setAmount('');
        setNote('');
        onSuccess?.();
        onClose();
      }, 700);
    } catch {
      setErrorMsg(
        locale === 'en'
          ? 'Failed to save transaction. Please check your connection and retry.'
          : 'ግብይቱን መመዝገብ አልተቻለም። እባክዎ ግንኙነትዎን ፈትሸው እንደገና ይሞክሩ።',
      );
      triggerHaptic('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPreset = (val: number) => {
    triggerHaptic('selection');
    setErrorMsg(null);
    const current = parseFloat(amount) || 0;
    setAmount(String(current + val));
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DrawerContent className="p-5 max-w-md mx-auto">
        <DrawerHeader className="p-0 pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <PlusCircle size={16} />
            </div>
            <DrawerTitle className="text-base font-black text-[var(--foreground)]">
              {locale === 'en' ? 'Quick Record' : 'ፈጣን ምዝገባ'}
            </DrawerTitle>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 active:scale-90 transition-all cursor-pointer border border-rose-500/30 shadow-xs"
            aria-label="Close"
          >
            <X size={18} className="stroke-[2.5]" />
          </button>
        </DrawerHeader>

        {/* Expense vs Income switch */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--secondary)] gap-1 mb-4">
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              type === 'expense'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-[var(--muted-foreground)]'
            }`}
          >
            {t(locale, 'filterExpense')}
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              type === 'income'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-[var(--muted-foreground)]'
            }`}
          >
            {t(locale, 'filterIncome')}
          </button>
        </div>

        {/* Amount input with Quick presets */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-xs font-bold text-[var(--muted-foreground)]">
            {locale === 'en' ? 'Amount (ETB)' : 'መጠን (ብር)'}
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 font-black text-sm text-[var(--muted-foreground)]">
              ETB
            </span>
            <Input
              type="number"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              className="pl-13 text-xl font-black h-12 rounded-2xl"
              autoFocus
            />
          </div>

          {/* Preset amount chips */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {[50, 100, 250, 500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleAddPreset(preset)}
                className="flex-1 py-1 px-1.5 rounded-lg bg-[var(--secondary)] text-[11px] font-bold text-[var(--foreground)] hover:bg-[var(--secondary)]/80 transition-all cursor-pointer"
              >
                +{preset}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Category selector chips */}
        <div className="flex flex-col gap-1.5 mb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[var(--muted-foreground)]">
              {locale === 'en' ? 'Category' : 'ምድብ'}
            </label>
            {isLoadingCategories && (
              <span className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                {locale === 'en' ? 'Syncing...' : 'በማመሳሰል ላይ...'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {activeCategoryList.map((catId) => {
              const Icon = ICON_MAP[catId] || MoreHorizontal;
              const isSelected = category === catId;
              const label = categoryLabels[locale][catId] ?? catId.replace(/_/g, ' ');

              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setCategory(catId);
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#10B981] text-white shadow-xs'
                      : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Note input */}
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="text-xs font-bold text-[var(--muted-foreground)]">
            {t(locale, 'noteLabel')}
          </label>
          <Input
            placeholder={
              locale === 'en'
                ? 'Optional note (e.g. Lunch with friends)'
                : 'ማስታወሻ (ለምሳሌ ምሳ ከጓደኞች ጋር)'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-xs font-medium h-10 rounded-xl"
          />
        </div>

        {/* Smart Match Suggestion Card */}
        {matchCandidates.length > 0 && (
          <div className="mb-4 animate-fade-in">
            <SmartMatchSuggestionCard
              candidates={matchCandidates}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidate={(c) => setSelectedCandidateId(c.id)}
              onLinkAndSave={(c) => {
                void handleLinkCandidate(c);
              }}
              onSaveSeparate={() => {
                setMatchCandidates([]);
              }}
              isLinking={isLinking}
            />
          </div>
        )}

        {/* Error message banner */}
        {errorMsg ? (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 mb-3 text-rose-600 dark:text-rose-400 text-xs font-semibold animate-fade-in">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        {/* Submit button */}
        <Button
          onClick={() => {
            void handleSave();
          }}
          disabled={!amount.trim() || isSaving || isSuccess}
          className={`w-full h-12 text-sm font-bold shadow-md rounded-2xl cursor-pointer transition-all ${
            isSuccess ? 'bg-emerald-600 text-white' : 'bg-[#10B981] hover:bg-emerald-600 text-white'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin mr-1" />
              <span>{locale === 'en' ? 'Saving...' : 'በመመዝገብ ላይ...'}</span>
            </>
          ) : isSuccess ? (
            <>
              <Check size={16} className="mr-1" />
              <span>{locale === 'en' ? 'Saved Successfully!' : 'በትክክል ተመዝግቧል!'}</span>
            </>
          ) : (
            <>
              <PlusCircle size={16} className="mr-1" />
              <span>{locale === 'en' ? 'Save Entry' : 'መዝግብ'}</span>
            </>
          )}
        </Button>
      </DrawerContent>
    </Drawer>
  );
}
