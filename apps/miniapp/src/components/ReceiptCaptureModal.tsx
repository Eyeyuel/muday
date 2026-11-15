import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  UploadCloud,
  Check,
  X,
  FileText,
  Loader2,
  Utensils,
  Car,
  Zap,
  ShoppingBag,
  HeartPulse,
  GraduationCap,
  Film,
  MoreHorizontal,
  RefreshCw,
  AlertCircle,
  ImageIcon,
  type LucideIcon,
} from 'lucide-react';
import type { Locale, MatchCandidateItem } from '../api/dashboard-types';
import {
  createDashboardTransaction,
  scanReceiptImage,
  fetchDashboardCategories,
  fetchMatchCandidates,
  linkCandidateTransaction,
} from '../api/dashboard-api';
import { categoryLabels } from '../i18n/catalogs';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { LiveCameraViewfinder } from './LiveCameraViewfinder';
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

const PLATFORMS = [
  { key: 'cash', labelEn: 'Cash', labelAm: 'ካሽ' },
  { key: 'telebirr', labelEn: 'Telebirr', labelAm: 'ቴሌብር' },
  { key: 'cbe', labelEn: 'CBE', labelAm: 'ንግድ ባንክ' },
  { key: 'cbe_birr', labelEn: 'CBE Birr', labelAm: 'ሲቢኢ ብር' },
  { key: 'boa', labelEn: 'BoA', labelAm: 'አቢሲኒያ' },
  { key: 'awash', labelEn: 'Awash', labelAm: 'አዋሽ' },
  { key: 'dashen', labelEn: 'Dashen', labelAm: 'ዳሸን' },
] as const;

export function ReceiptCaptureModal({
  isOpen,
  onClose,
  locale,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
  onSuccess?: () => void;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [scannedData, setScannedData] = useState<{
    amount: string;
    merchant: string;
    category: string;
    rawCategory: string;
    platform?: string;
    receiptTempId?: string;
  } | null>(null);

  // 🔗 Smart Match Candidate State
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidateItem[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>(undefined);
  const [isLinking, setIsLinking] = useState(false);

  const [categories, setCategories] = useState<string[]>(DEFAULT_EXPENSE);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    void fetchDashboardCategories()
      .then((res) => {
        if (!isMounted) return;
        const userExpense = res.userCategories
          .filter((c) => c.type === 'expense')
          .map((c) => c.label);
        const merged = Array.from(
          new Set([...userExpense, ...(res.defaultExpenseCategories || DEFAULT_EXPENSE)]),
        );
        setCategories(merged);
      })
      .catch(() => {
        // Fallback to default categories
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleProcessFile = async (file: File) => {
    triggerHaptic('medium');
    setSelectedFile(file);

    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch {
      setPreviewUrl(null);
    }

    setIsScanning(true);
    setScannedData(null);
    setMatchCandidates([]);
    setSelectedCandidateId(undefined);
    setScanError(null);
    setValidationError(null);

    try {
      const res = await scanReceiptImage(file);
      if (res.success && res.amount && parseFloat(res.amount) > 0) {
        setScannedData({
          amount: res.amount,
          merchant: res.merchant || (locale === 'en' ? 'Receipt expense' : 'የደረሰኝ ወጪ'),
          category: categoryLabels[locale][res.category] ?? res.category.replace(/_/g, ' '),
          rawCategory: res.category || 'food_groceries',
          platform: res.platform,
          receiptTempId: res.receiptTempId,
        });
        if (res.platform) setSelectedPlatform(res.platform);
        void fetchMatchCandidates(res.amount, 'expense').then((cands) => {
          if (cands.length > 0) {
            setMatchCandidates(cands);
            setSelectedCandidateId(cands[0]?.id);
          }
        });
        triggerHaptic('success');
      } else {
        setScanError(
          locale === 'en'
            ? 'Could not read receipt total confidently. Please retry with a clearer photo or enter details below.'
            : 'የደረሰኙን መጠን በግልጽ ማንበብ አልተቻለም። እባክዎ ግልጽ ፎቶ አንስተው እንደገና ይሞክሩ ወይም ከታች ያስገቡ።',
        );
        // Provide editable fallback so user isn't blocked
        setScannedData({
          amount: '0.00',
          merchant: locale === 'en' ? 'Receipt expense' : 'የደረሰኝ ወጪ',
          category: categoryLabels[locale]['food_groceries'] || 'Food & groceries',
          rawCategory: 'food_groceries',
          receiptTempId: res.receiptTempId,
        });
        triggerHaptic('warning');
      }
    } catch {
      setScanError(
        locale === 'en'
          ? 'Error scanning receipt. Please enter details below or retry.'
          : 'ደረሰኙን በማንበብ ወቅት ስህተት ተፈጥሯል። እባክዎ ከታች ያስገቡ ወይም እንደገና ይሞክሩ።',
      );
      setScannedData({
        amount: '0.00',
        merchant: locale === 'en' ? 'Receipt expense' : 'የደረሰኝ ወጪ',
        category: categoryLabels[locale]['food_groceries'] || 'Food & groceries',
        rawCategory: 'food_groceries',
      });
      triggerHaptic('error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirm = async () => {
    if (!scannedData || isSaving) return;

    const numAmount = parseFloat(scannedData.amount.trim());
    if (isNaN(numAmount) || numAmount <= 0) {
      setValidationError(
        locale === 'en'
          ? 'Please enter a valid amount greater than 0'
          : 'እባክዎ ከ 0 የሚበልጥ ትክክለኛ መጠን ያስገቡ',
      );
      triggerHaptic('warning');
      return;
    }

    try {
      setIsSaving(true);
      setValidationError(null);
      await createDashboardTransaction({
        type: 'expense',
        amountEtb: String(numAmount),
        category: scannedData.rawCategory || 'food_groceries',
        note: scannedData.merchant.trim() || undefined,
        platform: selectedPlatform || scannedData.platform || undefined,
        source: 'receipt',
        receiptTempId: scannedData.receiptTempId,
      });

      triggerHaptic('success');
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        onSuccess?.();
        handleReset();
        onClose();
      }, 700);
    } catch {
      setValidationError(
        locale === 'en'
          ? 'Failed to save receipt transaction. Check connection and retry.'
          : 'የደረሰኝ ግብይቱን መመዝገብ አልተቻለም። ግንኙነትዎን ፈትሸው እንደገና ይሞክሩ።',
      );
      triggerHaptic('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkCandidate = async (candidate: MatchCandidateItem) => {
    if (!scannedData || isLinking) return;
    try {
      setIsLinking(true);
      await linkCandidateTransaction({
        targetId: candidate.id,
        targetType: candidate.targetType,
        category: scannedData.rawCategory || 'food_groceries',
        note: scannedData.merchant.trim() || undefined,
        type: 'expense',
      });
      triggerHaptic('success');
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSuccess?.();
        handleReset();
        onClose();
      }, 700);
    } catch {
      setValidationError(
        locale === 'en' ? 'Failed to link with bank transaction.' : 'ከባንክ ግብይት ጋር ማገናኘት አልተቻለም።',
      );
      triggerHaptic('error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleReset = () => {
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        // ignore
      }
    }
    setSelectedFile(null);
    setSelectedPlatform(null);
    setPreviewUrl(null);
    setScannedData(null);
    setMatchCandidates([]);
    setSelectedCandidateId(undefined);
    setIsLinking(false);
    setScanError(null);
    setValidationError(null);
    setIsScanning(false);
    setIsSuccess(false);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  return (
    <>
      <Drawer
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !isSaving) {
            handleReset();
            onClose();
          }
        }}
      >
        <DrawerContent className="p-6 max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DrawerHeader className="p-0 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                <Camera size={16} />
              </div>
              <DrawerTitle className="text-base font-black text-[var(--foreground)]">
                {locale === 'en' ? 'Scan & Review Receipt' : 'ደረሰኝ ስካንና ማረጋገጫ'}
              </DrawerTitle>
            </div>
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              disabled={isSaving}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 active:scale-90 transition-all cursor-pointer border border-rose-500/30 shadow-xs"
              aria-label="Close"
            >
              <X size={18} className="stroke-[2.5]" />
            </button>
          </DrawerHeader>

          <p className="text-xs text-[var(--muted-foreground)] mb-3 text-center">
            {locale === 'en'
              ? 'AI extracts amount and merchant. You can edit any field before saving.'
              : 'AI መጠንና ነጋዴን ይለያል። ከማስቀመጥዎ በፊት ማንኛውንም መረጃ ማስተካከል ይችላሉ።'}
          </p>

          {/* Hidden Camera & Gallery Inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleProcessFile(f);
            }}
            className="hidden"
          />

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg,image/heic"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleProcessFile(f);
            }}
            className="hidden"
          />

          {/* Upload / Scanner Dropzone */}
          {!selectedFile ? (
            <div className="flex flex-col gap-2.5 my-2">
              <div className="flex gap-2.5 w-full">
                {/* Option 1: Native Camera */}
                {/* Option 1: Live Interactive Camera Viewfinder */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setIsLiveCameraOpen(true);
                  }}
                  className="flex-1 flex flex-col items-center justify-center p-6 rounded-3xl border border-[var(--border)] bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-98 transition-all cursor-pointer select-none gap-2 text-center shadow-2xs"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                    <Camera size={24} />
                  </div>
                  <span className="text-xs font-black text-[var(--foreground)]">
                    {locale === 'en' ? 'Take Photo' : 'ፎቶ አንሳ'}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {locale === 'en' ? 'Live Camera' : 'የቀጥታ ካሜራ'}
                  </span>
                </button>

                {/* Option 2: Gallery / Files */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    galleryInputRef.current?.click();
                  }}
                  className="flex-1 flex flex-col items-center justify-center p-6 rounded-3xl border border-[var(--border)] bg-[var(--secondary)]/60 hover:bg-[var(--secondary)] active:scale-98 transition-all cursor-pointer select-none gap-2 text-center shadow-2xs"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] shadow-xs">
                    <ImageIcon size={24} />
                  </div>
                  <span className="text-xs font-black text-[var(--foreground)]">
                    {locale === 'en' ? 'Choose Image' : 'ምስል ምረጥ'}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">
                    {locale === 'en' ? 'Gallery or Files' : 'ከጋለሪ ወይም ፋይል'}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--muted-foreground)] opacity-80 pt-1">
                <UploadCloud size={13} />
                <span>JPG, PNG, WebP receipts up to 10MB</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 my-1 animate-fade-in">
              {/* Scanned / Uploading File Banner with Image Preview */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--secondary)]/80 border border-[var(--border)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Receipt thumbnail"
                      className="w-10 h-10 object-cover rounded-xl border border-[var(--border)] shrink-0"
                    />
                  ) : (
                    <FileText size={16} className="text-cyan-500 shrink-0" />
                  )}
                  <span className="text-xs font-bold text-[var(--foreground)] truncate max-w-[180px]">
                    {selectedFile.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSaving}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>{locale === 'en' ? 'Retake' : 'እንደገና'}</span>
                </button>
              </div>

              {/* AI Extraction Loading State */}
              {isScanning ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <Loader2 size={24} className="animate-spin text-emerald-500" />
                  <span className="text-xs font-bold text-[var(--muted-foreground)]">
                    {locale === 'en'
                      ? 'AI extracting items & total amount...'
                      : 'በAI ደረሰኙን በማንበብ ላይ...'}
                  </span>
                </div>
              ) : scannedData ? (
                <>
                  {/* Smart Match Suggestion Card */}
                  {matchCandidates.length > 0 && (
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
                  )}

                  <div className="p-4 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm flex flex-col gap-3.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <FileText size={14} />
                        <span>
                          {locale === 'en' ? 'Extracted Details (Editable)' : 'የተገኘ መረጃ (የሚስተካከል)'}
                        </span>
                      </div>
                    </div>

                    {/* 1. Editable Amount Input */}
                    <div className="flex flex-col gap-1.5">
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
                          value={scannedData.amount}
                          onChange={(e) => {
                            setScannedData({ ...scannedData, amount: e.target.value });
                            if (validationError) setValidationError(null);
                          }}
                          className="pl-13 text-xl font-black h-12 rounded-2xl"
                        />
                      </div>
                    </div>

                    {/* 2. Editable Merchant / Note */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[var(--muted-foreground)]">
                        {locale === 'en' ? 'Merchant & Description' : 'ነጋዴ እና ዝርዝር'}
                      </label>
                      <Input
                        value={scannedData.merchant}
                        onChange={(e) =>
                          setScannedData({ ...scannedData, merchant: e.target.value })
                        }
                        placeholder={
                          locale === 'en'
                            ? 'e.g. Shoa Supermarket - Groceries'
                            : 'ምሳሌ፡ ሸዋ ሱፐርማርኬት - ግሮሰሪ'
                        }
                        className="h-10 text-xs font-medium rounded-xl"
                      />
                    </div>

                    {/* 3. Category Selector Chips */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[var(--muted-foreground)]">
                        {locale === 'en' ? 'Category' : 'ምድብ'}
                      </label>
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {categories.map((catId) => {
                          const Icon = ICON_MAP[catId] || MoreHorizontal;
                          const isSelected = scannedData.rawCategory === catId;
                          const label = categoryLabels[locale][catId] ?? catId.replace(/_/g, ' ');

                          return (
                            <button
                              key={catId}
                              type="button"
                              onClick={() => {
                                triggerHaptic('selection');
                                setScannedData({
                                  ...scannedData,
                                  rawCategory: catId,
                                  category: label,
                                });
                              }}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs'
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

                    {/* 4. Platform Selection Chips */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-[var(--muted-foreground)]">
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
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {PLATFORMS.map((p) => {
                          const currentVal = selectedPlatform || scannedData.platform;
                          const isSelected = currentVal?.toLowerCase() === p.key;
                          return (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => {
                                triggerHaptic('selection');
                                setSelectedPlatform(isSelected ? null : p.key);
                              }}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs'
                                  : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                              }`}
                            >
                              {isSelected && <Check size={12} className="stroke-[3]" />}
                              <span>{locale === 'en' ? p.labelEn : p.labelAm}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Validation / Scan Warning Banner */}
                    {(validationError || scanError) && (
                      <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>{validationError || scanError}</span>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Action Button */}
          <div className="mt-3 w-full">
            {scannedData && !isScanning ? (
              <Button
                onClick={() => {
                  void handleConfirm();
                }}
                disabled={isSaving || isSuccess}
                className={`w-full h-12 text-sm font-bold shadow-md rounded-2xl cursor-pointer transition-all ${
                  isSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#10B981] hover:bg-emerald-600 text-white'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-1.5" />
                    <span>{locale === 'en' ? 'Saving Expense...' : 'በመመዝገብ ላይ...'}</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <Check size={16} className="mr-1.5" />
                    <span>{locale === 'en' ? 'Saved Successfully!' : 'በትክክል ተመዝግቧል!'}</span>
                  </>
                ) : (
                  <>
                    <Check size={16} className="mr-1.5" />
                    <span>{locale === 'en' ? 'Save & Log Expense' : 'አረጋግጥና ወጪ መዝግብ'}</span>
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                disabled={isScanning}
                className="w-full h-11 text-xs font-bold rounded-xl cursor-pointer"
              >
                {locale === 'en' ? 'Cancel' : 'ይቅር'}
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Live Interactive Camera Viewfinder */}
      <LiveCameraViewfinder
        isOpen={isLiveCameraOpen}
        onClose={() => setIsLiveCameraOpen(false)}
        onCapture={(file) => {
          setIsLiveCameraOpen(false);
          void handleProcessFile(file);
        }}
        locale={locale}
      />
    </>
  );
}
