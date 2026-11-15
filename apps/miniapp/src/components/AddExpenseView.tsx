import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Mic,
  MicOff,
  Receipt,
  CheckCircle2,
  Utensils,
  Car,
  Zap,
  ShoppingBag,
  PlusCircle,
  Check,
  Loader2,
  AlertCircle,
  Upload,
  Camera,
  ImageIcon,
  RefreshCw,
} from 'lucide-react';
import type { Locale, MatchCandidateItem } from '../api/dashboard-types';
import {
  createDashboardTransaction,
  parseTransactionText,
  sendVoiceAudio,
  scanReceiptImage,
  fetchMatchCandidates,
  linkCandidateTransaction,
} from '../api/dashboard-api';
import { categoryLabels } from '../i18n/catalogs';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { WavRecorder } from '../utils/wav-recorder';
import { LiveCameraViewfinder } from './LiveCameraViewfinder';
import { SmartMatchDrawerModal } from './SmartMatchDrawerModal';

type EntryMode = 'text' | 'voice' | 'receipt';

interface QuickTemplateGroup {
  id: string;
  category: string;
  labelEn: string;
  labelAm: string;
  icon: typeof Utensils;
  bgColor: string;
  iconColor: string;
  templates: Array<{ en: string; am: string }>;
}

const TEMPLATE_GROUPS: QuickTemplateGroup[] = [
  {
    id: 'food',
    category: 'food_groceries',
    labelEn: 'Dining & Food',
    labelAm: 'ምግብና መጠጥ',
    icon: Utensils,
    bgColor: 'bg-amber-500/15',
    iconColor: 'text-amber-600 dark:text-amber-400',
    templates: [
      { en: '250 birr lunch with friends', am: '250 ብር ምሳ ከጓደኞች ጋር' },
      { en: '150 coffee and cake at cafe', am: '150 ቡና እና ኬክ በካፌ' },
      { en: '80 fast food burger snack', am: '80 ብር ፈጣን ምግብ' },
    ],
  },
  {
    id: 'transport',
    category: 'transport',
    labelEn: 'Transportation',
    labelAm: 'ትራንስፖርት',
    icon: Car,
    bgColor: 'bg-cyan-500/15',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    templates: [
      { en: '120 ride from bole to megenagna', am: '120 ብር ታክሲ ከቦሌ መገናኛ' },
      { en: '50 for taxi to work', am: '50 ብር ታክሲ ወደ ሥራ' },
      { en: '500 fuel gas station', am: '500 ብር ነዳጅ' },
    ],
  },
  {
    id: 'utilities',
    category: 'utilities',
    labelEn: 'Utilities & Bills',
    labelAm: 'የቤትና የፍጆታ ክፍያዎች',
    icon: Zap,
    bgColor: 'bg-orange-500/15',
    iconColor: 'text-orange-600 dark:text-orange-400',
    templates: [
      { en: '450 electricity and water bill', am: '450 ብር የውሃና መብራት ክፍያ' },
      { en: '300 mobile airtime and data card', am: '300 ብር የሞባይል ካርድ' },
    ],
  },
  {
    id: 'shopping',
    category: 'shopping_clothing',
    labelEn: 'Shopping & Groceries',
    labelAm: 'ግዢና የቤት ዕቃዎች',
    icon: ShoppingBag,
    bgColor: 'bg-purple-500/15',
    iconColor: 'text-purple-600 dark:text-purple-400',
    templates: [
      { en: '1500 supermarket grocery shopping', am: '1500 ብር ሱፐርማርኬት ግዢ' },
      { en: '800 clothes and shoes', am: '800 ብር ልብስና ጫማ' },
    ],
  },
];

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface IWindowSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: unknown) => void;
  onend: () => void;
}

const PLATFORMS = [
  { key: 'cash', labelEn: 'Cash', labelAm: 'ካሽ' },
  { key: 'telebirr', labelEn: 'Telebirr', labelAm: 'ቴሌብር' },
  { key: 'cbe', labelEn: 'CBE', labelAm: 'ንግድ ባንክ' },
  { key: 'cbe_birr', labelEn: 'CBE Birr', labelAm: 'ሲቢኢ ብር' },
  { key: 'boa', labelEn: 'BoA', labelAm: 'አቢሲኒያ' },
  { key: 'awash', labelEn: 'Awash', labelAm: 'አዋሽ' },
  { key: 'dashen', labelAm: 'ዳሸን', labelEn: 'Dashen' },
] as const;

export function AddExpenseView({
  locale,
  initialMode = 'text',
  onSuccess,
}: {
  locale: Locale;
  initialMode?: EntryMode;
  onSuccess?: () => void;
}) {
  const [entryMode, setEntryMode] = useState<EntryMode>(initialMode);

  useEffect(() => {
    setEntryMode(initialMode);
  }, [initialMode]);
  const [inputText, setInputText] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successToastText, setSuccessToastText] = useState('');

  // 🎙️ Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceParsed, setVoiceParsed] = useState<{
    amount: string;
    category: string;
    rawCategory: string;
    type: 'income' | 'expense';
    note: string;
    platform?: string;
  } | null>(null);
  const wavRecorderRef = useRef<WavRecorder | null>(null);
  const recognitionRef = useRef<IWindowSpeechRecognition | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  // 🧾 Receipt State
  const [isReceiptScanning, setIsReceiptScanning] = useState(false);
  const [receiptParsed, setReceiptParsed] = useState<{
    amount: string;
    category: string;
    rawCategory: string;
    merchant: string;
    platform?: string;
    receiptTempId?: string;
  } | null>(null);
  const [receiptSelectedFile, setReceiptSelectedFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const receiptGalleryInputRef = useRef<HTMLInputElement | null>(null);

  // 🔗 Smart Match Candidate Modal Drawer State
  const [isMatchDrawerOpen, setIsMatchDrawerOpen] = useState(false);
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidateItem[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>(undefined);
  const [isLinking, setIsLinking] = useState(false);
  const [pendingParsedData, setPendingParsedData] = useState<{
    amount: string;
    category: string;
    note: string;
    type: 'expense' | 'income';
    source: 'text' | 'voice' | 'receipt';
    platform?: string;
    receiptTempId?: string;
  } | null>(null);

  // Recording Timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isRecording) {
      timer = setInterval(() => setVoiceSeconds((s) => s + 1), 1000);
    } else {
      setVoiceSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const triggerSuccessFeedback = (msg?: string) => {
    triggerHaptic('success');
    setSuccessToastText(
      msg || (locale === 'en' ? 'Transaction saved successfully!' : 'ግብይቱ በትክክል ተመዝግቧል!'),
    );
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
      onSuccess?.();
    }, 1200);
  };

  const handleLinkCandidate = async (
    candidate: MatchCandidateItem,
    category: string,
    note?: string,
    type?: 'expense' | 'income',
  ) => {
    setIsLinking(true);
    setErrorMessage(null);
    try {
      await linkCandidateTransaction({
        targetId: candidate.id,
        targetType: candidate.targetType,
        category: category || 'food_groceries',
        note,
        type: type || 'expense',
      });
      setIsMatchDrawerOpen(false);
      setMatchCandidates([]);
      setPendingParsedData(null);
      setInputText('');
      setVoiceParsed(null);
      setReceiptParsed(null);
      triggerSuccessFeedback(
        locale === 'en'
          ? `Linked to ${candidate.bankSource} payment successfully!`
          : `ከ${candidate.bankSource} ክፍያ ጋር በትክክል ተገናኝቷል!`,
      );
    } catch {
      setErrorMessage(
        locale === 'en' ? 'Failed to link with bank transaction.' : 'ከባንክ ግብይት ጋር ማገናኘት አልተቻለም።',
      );
      triggerHaptic('error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleSaveSeparatePending = async () => {
    if (!pendingParsedData) return;
    setIsSubmitting(true);
    setIsMatchDrawerOpen(false);
    try {
      await createDashboardTransaction({
        type: pendingParsedData.type,
        amountEtb: pendingParsedData.amount,
        category: pendingParsedData.category || 'food_groceries',
        note: pendingParsedData.note,
        platform: selectedPlatform || pendingParsedData.platform || undefined,
        source: pendingParsedData.source,
      });
      setMatchCandidates([]);
      setPendingParsedData(null);
      setInputText('');
      setSelectedPlatform(null);
      setVoiceParsed(null);
      setReceiptParsed(null);
      triggerSuccessFeedback();
    } catch {
      setErrorMessage(locale === 'en' ? 'Failed to save transaction.' : 'ግብይቱን መመዝገብ አልተቻለም።');
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1. TEXT MODE SUBMIT
  // ─────────────────────────────────────────────────────────────
  const handleSaveExpenseText = async () => {
    if (!inputText.trim() || isSubmitting) return;

    triggerHaptic('medium');
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // Step A: Parse note with AI / Natural Language parser
      const parsed = await parseTransactionText(inputText.trim());

      const amount =
        parsed.success && parsed.amount && parseFloat(parsed.amount) > 0 ? parsed.amount : null;

      if (!amount) {
        setErrorMessage(
          locale === 'en'
            ? 'Could not detect an amount in note. Please specify an amount (e.g. "250 birr lunch").'
            : 'በማስታወሻው ውስጥ መጠን አልተገኘም። እባክዎ መጠን ያካትቱ (ለምሳሌ "250 ብር ምሳ")።',
        );
        triggerHaptic('warning');
        setIsSubmitting(false);
        return;
      }

      // Step B: Check for matching uncategorized bank transactions
      const candidates = await fetchMatchCandidates(amount, parsed.type || 'expense');
      if (candidates.length > 0) {
        setMatchCandidates(candidates);
        setSelectedCandidateId(candidates[0]?.id);
        setPendingParsedData({
          amount,
          category: parsed.category || 'food_groceries',
          note: parsed.note || inputText.trim(),
          type: parsed.type || 'expense',
          platform: selectedPlatform || parsed.platform || undefined,
          source: 'text',
        });
        setIsMatchDrawerOpen(true);
        setIsSubmitting(false);
        return;
      }

      // Step C: Save to backend database directly if no candidates
      await createDashboardTransaction({
        type: parsed.type || 'expense',
        amountEtb: amount,
        category: parsed.category || 'food_groceries',
        note: parsed.note || inputText.trim(),
        platform: selectedPlatform || parsed.platform || undefined,
        source: 'text',
      });

      setInputText('');
      setSelectedPlatform(null);
      triggerSuccessFeedback();
    } catch {
      setErrorMessage(
        locale === 'en'
          ? 'Failed to save transaction. Please check your connection and retry.'
          : 'ግብይቱን መመዝገብ አልተቻለም። እባክዎ ግንኙነትዎን ፈትሸው እንደገና ይሞክሩ።',
      );
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTemplate = (templateText: string) => {
    triggerHaptic('selection');
    setInputText(templateText);
    setErrorMessage(null);
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  // ─────────────────────────────────────────────────────────────
  // 2. VOICE MODE HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleStartVoice = async () => {
    triggerHaptic('heavy');
    setIsRecording(true);
    setVoiceTranscript('');
    setVoiceParsed(null);
    setErrorMessage(null);

    // Start 16kHz PCM WAV Audio Recording
    try {
      const recorder = new WavRecorder();
      wavRecorderRef.current = recorder;
      await recorder.start();
    } catch (err) {
      console.warn('WavRecorder failed to start:', err);
    }

    // Real-time Web Speech recognition (if supported)
    const SpeechRecognitionConstructor =
      (window as unknown as { SpeechRecognition?: new () => IWindowSpeechRecognition })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => IWindowSpeechRecognition })
        .webkitSpeechRecognition;

    if (SpeechRecognitionConstructor) {
      try {
        const recognition = new SpeechRecognitionConstructor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = locale === 'am' ? 'am-ET' : 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i]?.[0]?.transcript || '';
          }
          if (current.trim()) {
            setVoiceTranscript(current.trim());
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        // ignore
      }
    }
  };

  const handleStopVoice = async () => {
    triggerHaptic('medium');
    setIsRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    let recordedBlob: Blob | null = null;
    if (wavRecorderRef.current) {
      try {
        recordedBlob = await wavRecorderRef.current.stop();
      } catch (err) {
        console.warn('WavRecorder stop error:', err);
      }
      wavRecorderRef.current = null;
    }

    setIsVoiceProcessing(true);
    setErrorMessage(null);

    try {
      const res = await sendVoiceAudio(
        recordedBlob || undefined,
        voiceTranscript.trim() || undefined,
      );
      if (res.success && (res.amount || res.transcript)) {
        if (res.transcript) setVoiceTranscript(res.transcript);
        setVoiceParsed({
          amount: res.amount || '0.00',
          category: categoryLabels[locale][res.category] ?? res.category.replace(/_/g, ' '),
          rawCategory: res.category,
          type: res.type || 'expense',
          note: res.note || res.transcript,
        });
        if (res.amount && parseFloat(res.amount) > 0) {
          void fetchMatchCandidates(res.amount, res.type || 'expense').then((cands) => {
            if (cands.length > 0) {
              setMatchCandidates(cands);
              setSelectedCandidateId(cands[0]?.id);
              setPendingParsedData({
                amount: res.amount,
                category: res.category || 'food_groceries',
                note: res.note || res.transcript,
                type: res.type || 'expense',
                source: 'voice',
              });
            }
          });
        }
        triggerHaptic('success');
      } else if (voiceTranscript.trim()) {
        const textRes = await parseTransactionText(voiceTranscript.trim());
        if (textRes.success && textRes.amount) {
          setVoiceParsed({
            amount: textRes.amount,
            category:
              categoryLabels[locale][textRes.category] ?? textRes.category.replace(/_/g, ' '),
            rawCategory: textRes.category,
            type: textRes.type,
            note: textRes.note || voiceTranscript,
          });
          if (parseFloat(textRes.amount) > 0) {
            void fetchMatchCandidates(textRes.amount, textRes.type || 'expense').then((cands) => {
              if (cands.length > 0) {
                setMatchCandidates(cands);
                setSelectedCandidateId(cands[0]?.id);
                setPendingParsedData({
                  amount: textRes.amount,
                  category: textRes.category || 'food_groceries',
                  note: textRes.note || voiceTranscript,
                  type: textRes.type || 'expense',
                  source: 'voice',
                });
              }
            });
          }
          triggerHaptic('success');
        }
      } else {
        setErrorMessage(
          locale === 'en'
            ? 'No speech detected in audio. Please try speaking clearly.'
            : 'ምንም ድምፅ አልተሰማም። እባክዎ እንደገና ይናገሩ።',
        );
        triggerHaptic('warning');
      }
    } catch {
      setErrorMessage(
        locale === 'en'
          ? 'Error processing voice note. Please try again.'
          : 'የድምፅ ማስታወሻውን በማስላት ወቅት ስህተት ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።',
      );
      triggerHaptic('error');
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsVoiceProcessing(true);
    setErrorMessage(null);
    try {
      const res = await sendVoiceAudio(file, undefined);
      if (res.success && (res.amount || res.transcript)) {
        setVoiceTranscript(res.transcript || file.name);
        setVoiceParsed({
          amount: res.amount || '0.00',
          category: categoryLabels[locale][res.category] ?? res.category.replace(/_/g, ' '),
          rawCategory: res.category,
          type: res.type || 'expense',
          note: res.note || res.transcript,
        });
        triggerHaptic('success');
      } else {
        setErrorMessage(
          locale === 'en'
            ? 'Could not parse audio file. Please try again.'
            : 'የድምፅ ፋይሉን መለየት አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
        );
      }
    } catch {
      setErrorMessage(locale === 'en' ? 'Failed to process audio file.' : 'የድምፅ ፋይሉን ማስኬድ አልተቻለም።');
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  const handleConfirmVoiceSave = async () => {
    if (!voiceParsed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const candidates = await fetchMatchCandidates(voiceParsed.amount, voiceParsed.type);
      if (candidates.length > 0) {
        setMatchCandidates(candidates);
        setSelectedCandidateId(candidates[0]?.id);
        setPendingParsedData({
          amount: voiceParsed.amount,
          category: voiceParsed.rawCategory || 'food_groceries',
          note: voiceParsed.note || voiceTranscript,
          type: voiceParsed.type,
          platform: selectedPlatform || voiceParsed.platform || undefined,
          source: 'voice',
        });
        setIsMatchDrawerOpen(true);
        setIsSubmitting(false);
        return;
      }

      await createDashboardTransaction({
        type: voiceParsed.type,
        amountEtb: voiceParsed.amount,
        category: voiceParsed.rawCategory || 'food_groceries',
        note: voiceParsed.note || voiceTranscript,
        platform: selectedPlatform || voiceParsed.platform || undefined,
        source: 'voice',
      });
      setVoiceParsed(null);
      setVoiceTranscript('');
      setSelectedPlatform(null);
      triggerSuccessFeedback();
    } catch {
      setErrorMessage(
        locale === 'en' ? 'Failed to save voice transaction.' : 'የድምፅ ግብይቱን መመዝገብ አልተቻለም።',
      );
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 3. RECEIPT MODE HANDLERS
  // ─────────────────────────────────────────────────────────────
  const handleProcessReceiptFile = async (file: File) => {
    triggerHaptic('medium');
    setReceiptSelectedFile(file);
    try {
      setReceiptPreviewUrl(URL.createObjectURL(file));
    } catch {
      setReceiptPreviewUrl(null);
    }
    setIsReceiptScanning(true);
    setReceiptParsed(null);
    setErrorMessage(null);

    try {
      const res = await scanReceiptImage(file);
      if (res.success && res.amount && parseFloat(res.amount) > 0) {
        setReceiptParsed({
          amount: res.amount,
          merchant: res.merchant || (locale === 'en' ? 'Receipt Merchant' : 'የደረሰኝ ነጋዴ'),
          category: categoryLabels[locale][res.category] ?? res.category.replace(/_/g, ' '),
          rawCategory: res.category || 'food_groceries',
          platform: res.platform,
          receiptTempId: res.receiptTempId,
        });
        triggerHaptic('success');
      } else {
        setErrorMessage(
          locale === 'en'
            ? 'Could not detect receipt total confidently. Please retry with a clearer photo or enter details below.'
            : 'የደረሰኙን መጠን በግልጽ ማንበብ አልተቻለም። እባክዎ ግልጽ ፎቶ አንስተው እንደገና ይሞክሩ ወይም ከታች ያስገቡ።',
        );
        setReceiptParsed({
          amount: '0.00',
          merchant: file.name.replace(/\.[^/.]+$/, ''),
          category: categoryLabels[locale]['food_groceries'] || 'Food & groceries',
          rawCategory: 'food_groceries',
          receiptTempId: res.receiptTempId,
        });
        triggerHaptic('warning');
      }
    } catch {
      setErrorMessage(
        locale === 'en'
          ? 'Error scanning receipt. Please enter details below or retry.'
          : 'ደረሰኙን በማንበብ ወቅት ስህተት ተፈጥሯል። እባክዎ ከታች ያስገቡ ወይም እንደገና ይሞክሩ።',
      );
      setReceiptParsed({
        amount: '0.00',
        merchant: file.name.replace(/\.[^/.]+$/, ''),
        category: categoryLabels[locale]['food_groceries'] || 'Food & groceries',
        rawCategory: 'food_groceries',
      });
      triggerHaptic('error');
    } finally {
      setIsReceiptScanning(false);
    }
  };

  const handleResetReceipt = () => {
    if (receiptPreviewUrl) {
      try {
        URL.revokeObjectURL(receiptPreviewUrl);
      } catch {
        // ignore
      }
    }
    setReceiptSelectedFile(null);
    setReceiptPreviewUrl(null);
    setReceiptParsed(null);
    setErrorMessage(null);
    if (receiptGalleryInputRef.current) receiptGalleryInputRef.current.value = '';
  };

  const handleConfirmReceiptSave = async () => {
    if (!receiptParsed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const candidates = await fetchMatchCandidates(receiptParsed.amount, 'expense');
      if (candidates.length > 0) {
        setMatchCandidates(candidates);
        setSelectedCandidateId(candidates[0]?.id);
        setPendingParsedData({
          amount: receiptParsed.amount,
          category: receiptParsed.rawCategory || 'food_groceries',
          note: receiptParsed.merchant,
          type: 'expense',
          platform: selectedPlatform || receiptParsed.platform || undefined,
          source: 'receipt',
          receiptTempId: receiptParsed.receiptTempId,
        });
        setIsMatchDrawerOpen(true);
        setIsSubmitting(false);
        return;
      }

      await createDashboardTransaction({
        type: 'expense',
        amountEtb: receiptParsed.amount,
        category: receiptParsed.rawCategory || 'food_groceries',
        note: receiptParsed.merchant,
        platform: selectedPlatform || receiptParsed.platform || undefined,
        source: 'receipt',
        receiptTempId: receiptParsed.receiptTempId,
      });
      handleResetReceipt();
      setSelectedPlatform(null);
      triggerSuccessFeedback();
    } catch {
      setErrorMessage(
        locale === 'en' ? 'Failed to save receipt transaction.' : 'የደረሰኝ ግብይቱን መመዝገብ አልተቻለም።',
      );
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col w-full pb-32 select-none animate-fade-in">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP SECTION: Header Card
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[var(--card)] rounded-b-[2.5rem] px-5 pt-3 pb-6 flex flex-col gap-3 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)]">
        {/* Brand Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="Muday" className="h-8 w-8 object-contain" />
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-[var(--foreground)]">
                MUDAY
              </span>
              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                {locale === 'en' ? 'Personal Expense Tracker' : 'የግል ወጪ መዝገብ'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold shadow-2xs">
            <PlusCircle size={13} />
            <span>{locale === 'en' ? 'New Entry' : 'አዲስ ምዝገባ'}</span>
          </div>
        </div>

        {/* Title & Description */}
        <div className="flex flex-col gap-1 pt-1">
          <h1 className="text-xl font-black text-[var(--foreground)] tracking-tight">
            {locale === 'en' ? 'Record Expense' : 'ወጪ መዝግብ'}
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
            {locale === 'en'
              ? 'Enter expense details via text note, voice recording, or receipt photo.'
              : 'የወጪ ዝርዝርዎን በጽሑፍ፣ በድምፅ ወይም በደረሰኝ ፎቶ በቀላሉ ይመዝግቡ።'}
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. ENTRY MODE SELECTOR: Text, Voice, Receipt
          ───────────────────────────────────────────────────────────── */}
      <div className="py-4 px-4 w-full flex justify-center">
        <div className="grid grid-cols-3 p-1.5 rounded-full bg-[var(--secondary)]/90 border border-[var(--border)] gap-1 w-full max-w-sm shadow-xs">
          {/* Text Mode */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setEntryMode('text');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              entryMode === 'text'
                ? 'bg-[#10B981] text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <FileText size={14} />
            <span>{locale === 'en' ? 'Text' : 'ጽሑፍ'}</span>
          </button>

          {/* Voice Mode */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setEntryMode('voice');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              entryMode === 'voice'
                ? 'bg-[#10B981] text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <Mic size={14} />
            <span>{locale === 'en' ? 'Voice' : 'ድምፅ'}</span>
          </button>

          {/* Receipt Mode */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setEntryMode('receipt');
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              entryMode === 'receipt'
                ? 'bg-[#10B981] text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            <Receipt size={14} />
            <span>{locale === 'en' ? 'Receipt' : 'ደረሰኝ'}</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. EXPENSE DETAILS CARD
          ───────────────────────────────────────────────────────────── */}
      <div className="px-4 flex flex-col gap-4 w-full">
        {/* Error Banner */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold animate-fade-in">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-4">
          {/* Card Header */}
          <div className="flex items-center gap-2">
            {entryMode === 'text' ? (
              <FileText size={16} className="text-[#10B981]" />
            ) : entryMode === 'voice' ? (
              <Mic size={16} className="text-[#10B981]" />
            ) : (
              <Receipt size={16} className="text-[#10B981]" />
            )}
            <h2 className="text-sm font-extrabold text-[var(--foreground)] tracking-tight">
              {entryMode === 'text'
                ? locale === 'en'
                  ? 'Natural Text Note'
                  : 'የጽሑፍ ማስታወሻ'
                : entryMode === 'voice'
                  ? locale === 'en'
                    ? 'Voice Note Recording'
                    : 'የድምፅ ቅጂ'
                  : locale === 'en'
                    ? 'Receipt Scanner'
                    : 'የደረሰኝ ስካነር'}
            </h2>
          </div>

          {/* ─────────────────────────────────────────────────────────
              MODE 1: TEXT ENTRY
              ───────────────────────────────────────────────────────── */}
          {entryMode === 'text' && (
            <div className="flex flex-col gap-3">
              <textarea
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                rows={3}
                placeholder={
                  locale === 'en'
                    ? 'e.g. "250 birr lunch with friends", "50 for taxi to work", "1200 groceries"'
                    : 'ምሳሌ፡ "250 ብር ምሳ ከጓደኞች ጋር"፣ "50 ብር ታክሲ"፣ "1200 ብር የቤት ቀለብ"'
                }
                className="w-full p-3.5 rounded-2xl bg-[var(--secondary)]/60 border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/70 focus:outline-none focus:ring-1 focus:ring-[#10B981] resize-none transition-all"
              />

              {/* Payment Channel / Platform Chips */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--muted-foreground)]">
                    {locale === 'en'
                      ? 'Payment Channel / Platform (Optional)'
                      : 'የክፍያ መንገድ / ፕላትፎርም (አማራጭ)'}
                  </span>
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
                    const isSelected = selectedPlatform?.toLowerCase() === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                          triggerHaptic('selection');
                          setSelectedPlatform(isSelected ? null : p.key);
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs'
                            : 'bg-[var(--secondary)]/70 text-[var(--foreground)] border border-[var(--border)] hover:border-emerald-500'
                        }`}
                      >
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                        <span>{locale === 'en' ? p.labelEn : p.labelAm}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleSaveExpenseText();
                }}
                disabled={!inputText.trim() || isSubmitting}
                className="w-full h-12 rounded-2xl bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>
                      {locale === 'en' ? 'Processing & Saving...' : 'በማስላትና በመመዝገብ ላይ...'}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>{locale === 'en' ? 'Save Expense' : 'ወጪ መዝግብ'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              MODE 2: VOICE ENTRY
              ───────────────────────────────────────────────────────── */}
          {entryMode === 'voice' && (
            <div className="flex flex-col items-center justify-center py-4 gap-4 text-center">
              <div className="relative flex items-center justify-center">
                {isRecording && (
                  <>
                    <div className="absolute h-28 w-28 rounded-full bg-emerald-500/20 animate-ping" />
                    <div className="absolute h-24 w-24 rounded-full bg-emerald-500/30 animate-pulse" />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void (isRecording ? handleStopVoice() : handleStartVoice());
                  }}
                  disabled={isVoiceProcessing}
                  className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full transition-all cursor-pointer shadow-lg active:scale-95 ${
                    isRecording
                      ? 'bg-rose-500 text-white shadow-rose-500/30 animate-pulse'
                      : 'bg-[#10B981] text-white hover:bg-emerald-600 shadow-emerald-500/30'
                  }`}
                >
                  {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-[var(--foreground)]">
                  {isRecording ? (
                    <span className="text-rose-500 tabular-nums">
                      ● {locale === 'en' ? 'Recording audio...' : 'ድምፅ በመቅረጽ ላይ...'} (
                      {formatTime(voiceSeconds)})
                    </span>
                  ) : isVoiceProcessing ? (
                    <span className="flex items-center justify-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                      <Loader2 size={14} className="animate-spin text-emerald-500" />
                      {locale === 'en' ? 'AI transcribing & parsing...' : 'በAI ድምፅዎን በማስላት ላይ...'}
                    </span>
                  ) : voiceParsed ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓ {locale === 'en' ? 'Voice expense parsed' : 'የድምፅ ወጪ ተለይቷል'}
                    </span>
                  ) : (
                    <span>{locale === 'en' ? 'Tap mic to speak' : 'ለመናገር ማይኩን ይጫኑ'}</span>
                  )}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {locale === 'en'
                    ? 'Say amount and item (e.g. "250 birr for lunch")'
                    : 'መጠንና የተጠቀሙበትን ይናገሩ (ለምሳሌ "250 ብር ለምሳ")'}
                </span>
              </div>

              {/* Upload Voice File Option */}
              <div className="flex items-center justify-center pt-1">
                <input
                  ref={audioFileInputRef}
                  type="file"
                  accept="audio/*,.wav,.mp3,.ogg,.m4a,.webm"
                  onChange={(e) => {
                    void handleAudioFileUpload(e);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-1.5 px-3 rounded-full border border-[var(--border)] bg-[var(--secondary)]/40 cursor-pointer"
                >
                  <Upload size={13} />
                  <span>{locale === 'en' ? 'Or upload voice recording' : 'ወይም የድምፅ ፋይል ይምረጡ'}</span>
                </button>
              </div>

              {/* Voice Parsed Card Result */}
              {voiceParsed && (
                <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-2 text-left animate-fade-in mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {locale === 'en' ? 'Detected Amount' : 'የተገኘው መጠን'}
                    </span>
                    <span className="text-base font-black text-[var(--foreground)] tabular-nums">
                      ETB {voiceParsed.amount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {locale === 'en' ? 'Category' : 'ምድብ'}
                    </span>
                    <span className="text-xs font-bold text-[var(--foreground)]">
                      {voiceParsed.category}
                    </span>
                  </div>

                  {voiceParsed.note && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {locale === 'en' ? 'Note' : 'ማስታወሻ'}
                      </span>
                      <span className="text-xs font-bold text-[var(--foreground)] truncate max-w-[200px]">
                        {voiceParsed.note}
                      </span>
                    </div>
                  )}

                  {/* Voice Platform Selection Chips */}
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-[11px] font-bold text-[var(--muted-foreground)]">
                      {locale === 'en' ? 'Payment Channel / Platform' : 'የክፍያ መንገድ / ፕላትፎርም'}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      {PLATFORMS.map((p) => {
                        const currentVal = selectedPlatform || voiceParsed.platform;
                        const isSelected = currentVal?.toLowerCase() === p.key;
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => {
                              triggerHaptic('selection');
                              setSelectedPlatform(isSelected ? null : p.key);
                            }}
                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs'
                                : 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:border-emerald-500'
                            }`}
                          >
                            {isSelected && <Check size={11} className="stroke-[3]" />}
                            <span>{locale === 'en' ? p.labelEn : p.labelAm}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void handleConfirmVoiceSave();
                    }}
                    disabled={isSubmitting}
                    className="w-full h-11 rounded-xl bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>{locale === 'en' ? 'Saving...' : 'በመመዝገብ ላይ...'}</span>
                      </>
                    ) : (
                      <>
                        <Check size={15} />
                        <span>{locale === 'en' ? 'Confirm & Save Expense' : 'አረጋግጥና መዝግብ'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              MODE 3: RECEIPT ENTRY
              ───────────────────────────────────────────────────────── */}
          {entryMode === 'receipt' && (
            <div className="flex flex-col gap-3 py-1">
              <input
                ref={receiptGalleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg,image/heic"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleProcessReceiptFile(f);
                }}
                className="hidden"
              />

              {!receiptSelectedFile ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex gap-2.5 w-full">
                    {/* Option 1: Live Interactive Camera */}
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

                    {/* Option 2: Gallery / File Picker */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        receiptGalleryInputRef.current?.click();
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
                    <span>
                      {locale === 'en' ? 'JPG, PNG receipts up to 10MB' : 'የደረሰኝ ፎቶ እስከ 10MB'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 animate-fade-in">
                  {/* Scanned / Uploading File Banner with Image Preview */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--secondary)]/80 border border-[var(--border)]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {receiptPreviewUrl ? (
                        <img
                          src={receiptPreviewUrl}
                          alt="Receipt thumbnail"
                          className="w-10 h-10 object-cover rounded-xl border border-[var(--border)] shrink-0"
                        />
                      ) : (
                        <FileText size={16} className="text-cyan-500 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-[var(--foreground)] truncate max-w-[180px]">
                        {receiptSelectedFile.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetReceipt}
                      disabled={isSubmitting}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      <RefreshCw size={12} />
                      <span>{locale === 'en' ? 'Retake' : 'እንደገና'}</span>
                    </button>
                  </div>

                  {/* AI Scanning State */}
                  {isReceiptScanning ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                      <Loader2 size={24} className="animate-spin text-emerald-500" />
                      <span className="text-xs font-bold text-[var(--muted-foreground)]">
                        {locale === 'en'
                          ? 'AI extracting items & total amount...'
                          : 'በAI ደረሰኙን በማንበብ ላይ...'}
                      </span>
                    </div>
                  ) : receiptParsed ? (
                    <div className="w-full p-4 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm flex flex-col gap-3.5 text-left animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={14} />
                          <span>
                            {locale === 'en'
                              ? 'Extracted Details (Editable)'
                              : 'የተገኘ መረጃ (የሚስተካከል)'}
                          </span>
                        </div>
                      </div>

                      {/* 1. Editable Amount Input */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-[var(--muted-foreground)]">
                          {locale === 'en' ? 'Total Amount (ETB)' : 'ጠቅላላ መጠን (ብር)'}
                        </label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3.5 font-black text-sm text-[var(--muted-foreground)]">
                            ETB
                          </span>
                          <input
                            type="number"
                            step="any"
                            value={receiptParsed.amount}
                            onChange={(e) =>
                              setReceiptParsed({ ...receiptParsed, amount: e.target.value })
                            }
                            className="w-full pl-13 pr-4 text-xl font-black h-12 rounded-2xl bg-[var(--secondary)]/60 border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                          />
                        </div>
                      </div>

                      {/* 2. Editable Merchant / Description */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-[var(--muted-foreground)]">
                          {locale === 'en' ? 'Merchant / Description' : 'ነጋዴ / ዝርዝር'}
                        </label>
                        <input
                          type="text"
                          value={receiptParsed.merchant}
                          onChange={(e) =>
                            setReceiptParsed({ ...receiptParsed, merchant: e.target.value })
                          }
                          placeholder={locale === 'en' ? 'Merchant name' : 'የነጋዴው ስም'}
                          className="w-full px-3.5 h-10 text-xs font-medium rounded-xl bg-[var(--secondary)]/60 border border-[var(--border)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                        />
                      </div>

                      {/* 3. Category Selector Chips */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-[var(--muted-foreground)]">
                          {locale === 'en' ? 'Category' : 'ምድብ'}
                        </label>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                          {[
                            'food_groceries',
                            'transport',
                            'utilities',
                            'shopping_clothing',
                            'health',
                            'education',
                            'entertainment',
                            'other_expense',
                          ].map((catId) => {
                            const isSelected = receiptParsed.rawCategory === catId;
                            const label = categoryLabels[locale][catId] ?? catId.replace(/_/g, ' ');

                            return (
                              <button
                                key={catId}
                                type="button"
                                onClick={() => {
                                  triggerHaptic('selection');
                                  setReceiptParsed({
                                    ...receiptParsed,
                                    rawCategory: catId,
                                    category: label,
                                  });
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 shadow-xs'
                                    : 'bg-[var(--secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
                              >
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4. Platform Selection Chips */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-[var(--muted-foreground)]">
                          {locale === 'en' ? 'Payment Channel / Platform' : 'የክፍያ መንገድ / ፕላትፎርም'}
                        </label>
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                          {PLATFORMS.map((p) => {
                            const currentVal = selectedPlatform || receiptParsed.platform;
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

                      <button
                        type="button"
                        onClick={() => {
                          void handleConfirmReceiptSave();
                        }}
                        disabled={isSubmitting}
                        className="w-full h-12 rounded-2xl bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>{locale === 'en' ? 'Saving Expense...' : 'በመመዝገብ ላይ...'}</span>
                          </>
                        ) : (
                          <>
                            <Check size={16} />
                            <span>
                              {locale === 'en' ? 'Confirm & Save Receipt' : 'አረጋግጥና ደረሰኙን መዝግብ'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            4. QUICK TEMPLATES SECTION
            ───────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 pt-2">
          <Zap size={16} className="text-amber-500" />
          <h2 className="text-sm font-extrabold text-[var(--foreground)] tracking-tight">
            {locale === 'en' ? 'Quick Templates' : 'ፈጣን አብነቶች'}
          </h2>
        </div>

        {TEMPLATE_GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <div
              key={group.id}
              className="p-4 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-3"
            >
              {/* Group Header */}
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-xl ${group.bgColor} ${group.iconColor}`}
                >
                  <Icon size={14} />
                </div>
                <span className="text-xs font-bold text-[var(--foreground)]">
                  {locale === 'en' ? group.labelEn : group.labelAm}
                </span>
              </div>

              {/* Template Buttons */}
              <div className="flex flex-col gap-2">
                {group.templates.map((tpl, tIdx) => {
                  const text = locale === 'en' ? tpl.en : tpl.am;
                  return (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => {
                        setEntryMode('text');
                        handleSelectTemplate(text);
                      }}
                      className="flex items-center justify-between p-3 rounded-2xl bg-[var(--secondary)]/70 hover:bg-[var(--secondary)] border border-[var(--border)] transition-all active:scale-98 cursor-pointer text-left"
                    >
                      <span className="text-xs font-semibold text-[var(--foreground)] truncate pr-2">
                        {text}
                      </span>
                      <span className="text-xs font-bold text-[var(--muted-foreground)] shrink-0">
                        →
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Success Notification Toast */}
      {showSuccessToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#10B981] text-white shadow-xl font-bold text-xs animate-fade-in">
          <Check size={16} />
          <span>{successToastText}</span>
        </div>
      )}

      {/* Live Interactive Camera Viewfinder */}
      <LiveCameraViewfinder
        isOpen={isLiveCameraOpen}
        onClose={() => setIsLiveCameraOpen(false)}
        onCapture={(file) => {
          setIsLiveCameraOpen(false);
          void handleProcessReceiptFile(file);
        }}
        locale={locale}
      />

      {/* Smart Match Deduplication Bottom Sheet Modal Drawer */}
      <SmartMatchDrawerModal
        isOpen={isMatchDrawerOpen}
        onClose={() => {
          setIsMatchDrawerOpen(false);
        }}
        candidates={matchCandidates}
        selectedCandidateId={selectedCandidateId}
        onSelectCandidate={(c) => setSelectedCandidateId(c.id)}
        onLinkAndSave={(c) => {
          const activeCategory =
            pendingParsedData?.category ||
            voiceParsed?.rawCategory ||
            receiptParsed?.rawCategory ||
            'food_groceries';
          const activeNote =
            pendingParsedData?.note || voiceParsed?.note || receiptParsed?.merchant || inputText;
          const activeType = pendingParsedData?.type || voiceParsed?.type || 'expense';

          void handleLinkCandidate(c, activeCategory, activeNote, activeType);
        }}
        onSaveSeparate={() => {
          void handleSaveSeparatePending();
        }}
        isLinking={isLinking}
        locale={locale}
      />
    </div>
  );
}
