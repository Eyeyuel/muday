import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Check, X, Loader2, Edit2, AlertCircle, Upload } from 'lucide-react';
import type { Locale, MatchCandidateItem } from '../api/dashboard-types';
import {
  createDashboardTransaction,
  parseTransactionText,
  sendVoiceAudio,
  fetchMatchCandidates,
  linkCandidateTransaction,
} from '../api/dashboard-api';
import { categoryLabels } from '../i18n/catalogs';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { WavRecorder } from '../utils/wav-recorder';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { SmartMatchSuggestionCard } from './SmartMatchSuggestionCard';

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

export function VoiceCaptureModal({
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
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isEditingText, setIsEditingText] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [parsedData, setParsedData] = useState<{
    amount: string;
    category: string;
    rawCategory: string;
    type: 'income' | 'expense';
    note: string;
  } | null>(null);

  // 🔗 Smart Match Candidate State
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidateItem[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>(undefined);
  const [isLinking, setIsLinking] = useState(false);

  const recognitionRef = useRef<IWindowSpeechRecognition | null>(null);
  const wavRecorderRef = useRef<WavRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isRecording) {
      timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      setSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const handleStartRecording = async () => {
    triggerHaptic('heavy');
    setIsRecording(true);
    setTranscript('');
    setParsedData(null);
    setIsEditingText(false);
    setErrorMessage(null);

    // 1. Start universal recording (MediaRecorder / AudioContext)
    try {
      const recorder = new WavRecorder();
      wavRecorderRef.current = recorder;
      await recorder.start();
    } catch (err) {
      console.warn('WavRecorder failed to start:', err);
      setErrorMessage(
        locale === 'en'
          ? 'Microphone access denied or not supported. Please allow microphone permissions or use file upload / text below.'
          : 'የማይክሮፎን ፈቃድ አልተገኘም። እባክዎ የማይክሮፎን ፈቃድ ይስጡ ወይም የድምፅ ፋይል ይምረጡ/ከታች ይፃፉ።',
      );
      setIsRecording(false);
      return;
    }

    // 2. Real-time Web Speech recognition (if available)
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
            setTranscript(current.trim());
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch {
        // ignore
      }
    }
  };

  const handleStopRecording = async () => {
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

    setIsProcessing(true);

    try {
      const res = await sendVoiceAudio(recordedBlob || undefined, transcript.trim() || undefined);
      if (res.success && (res.amount || res.transcript)) {
        if (res.transcript) setTranscript(res.transcript);
        applyParsedDataAndCheckMatch({
          amount: res.amount || '0.00',
          category: categoryLabels[locale][res.category] ?? res.category.replace(/_/g, ' '),
          rawCategory: res.category,
          type: res.type || 'expense',
          note: res.note || res.transcript,
        });
        triggerHaptic('success');
      } else if (transcript.trim()) {
        const textRes = await parseTransactionText(transcript.trim());
        if (textRes.success && textRes.amount) {
          applyParsedDataAndCheckMatch({
            amount: textRes.amount,
            category:
              categoryLabels[locale][textRes.category] ?? textRes.category.replace(/_/g, ' '),
            rawCategory: textRes.category,
            type: textRes.type,
            note: textRes.note || transcript,
          });
          triggerHaptic('success');
        }
      } else {
        setErrorMessage(
          locale === 'en'
            ? 'No speech detected in audio. Please try again or type below.'
            : 'ምንም ድምፅ አልተሰማም። እባክዎ እንደገና ይናገሩ ወይም ከታች ይፃፉ።',
        );
        setIsEditingText(true);
        triggerHaptic('warning');
      }
    } catch {
      if (transcript.trim()) {
        const textRes = await parseTransactionText(transcript.trim());
        if (textRes.success && textRes.amount) {
          applyParsedDataAndCheckMatch({
            amount: textRes.amount,
            category:
              categoryLabels[locale][textRes.category] ?? textRes.category.replace(/_/g, ' '),
            rawCategory: textRes.category,
            type: textRes.type,
            note: textRes.note || transcript,
          });
        }
      } else {
        setErrorMessage(
          locale === 'en'
            ? 'Could not recognize speech. Please speak into the mic or type below.'
            : 'ድምፁን መለየት አልተቻለም። እባክዎ እንደገና ይናገሩ ወይም ከታች ይፃፉ።',
        );
        setIsEditingText(true);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await sendVoiceAudio(file, undefined);
      if (res.success && (res.transcript || res.amount)) {
        setTranscript(res.transcript || file.name);
        applyParsedDataAndCheckMatch({
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
            ? 'Could not parse audio file. Please try again or type below.'
            : 'የድምፅ ፋይሉን መለየት አልተቻለም። እባክዎ እንደገና ይሞክሩ ወይም ከታች ይፃፉ።',
        );
        setIsEditingText(true);
      }
    } catch {
      setErrorMessage(locale === 'en' ? 'Failed to process audio file.' : 'የድምፅ ፋይሉን ማስኬድ አልተቻለም።');
      setIsEditingText(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyParsedDataAndCheckMatch = (data: {
    amount: string;
    category: string;
    rawCategory: string;
    type: 'income' | 'expense';
    note: string;
  }) => {
    setParsedData(data);
    const amtNum = parseFloat(data.amount);
    if (amtNum > 0) {
      void fetchMatchCandidates(data.amount, data.type).then((cands) => {
        setMatchCandidates(cands);
        if (cands[0]) setSelectedCandidateId(cands[0].id);
      });
    }
  };

  const handleLinkCandidate = async (candidate: MatchCandidateItem) => {
    if (!parsedData || isLinking) return;
    try {
      setIsLinking(true);
      await linkCandidateTransaction({
        targetId: candidate.id,
        targetType: candidate.targetType,
        category: parsedData.rawCategory || 'food_groceries',
        note: parsedData.note || transcript,
        type: parsedData.type,
      });
      triggerHaptic('success');
      onSuccess?.();
      handleReset();
      onClose();
    } catch {
      setErrorMessage(
        locale === 'en' ? 'Failed to link with bank transaction.' : 'ከባንክ ግብይት ጋር ማገናኘት አልተቻለም።',
      );
      triggerHaptic('error');
    } finally {
      setIsLinking(false);
    }
  };

  const handleManualTextSubmit = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await parseTransactionText(text.trim());
      if (res.success && res.amount) {
        applyParsedDataAndCheckMatch({
          amount: res.amount,
          category: categoryLabels[locale][res.category] ?? res.category.replace(/_/g, ' '),
          rawCategory: res.category,
          type: res.type,
          note: res.note || text,
        });
        setIsEditingText(false);
        triggerHaptic('success');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (isSaving || !parsedData) return;
    try {
      setIsSaving(true);
      await createDashboardTransaction({
        type: parsedData.type,
        amountEtb: parsedData.amount,
        category: parsedData.rawCategory || 'food_groceries',
        note: parsedData.note || transcript,
        source: 'voice',
      });
      triggerHaptic('success');
      onSuccess?.();
      handleReset();
      onClose();
    } catch {
      triggerHaptic('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }
    if (wavRecorderRef.current) {
      wavRecorderRef.current.stop().catch(() => undefined);
      wavRecorderRef.current = null;
    }
    setIsRecording(false);
    setIsProcessing(false);
    setTranscript('');
    setParsedData(null);
    setMatchCandidates([]);
    setSelectedCandidateId(undefined);
    setIsLinking(false);
    setIsEditingText(false);
    setErrorMessage(null);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleReset();
          onClose();
        }
      }}
    >
      <DrawerContent className="p-6 max-w-md mx-auto">
        <DrawerHeader className="p-0 pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Mic size={16} />
            </div>
            <DrawerTitle className="text-base font-black text-[var(--foreground)]">
              {locale === 'en' ? 'Voice Expense Note' : 'የድምፅ ወጪ ምዝገባ'}
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

        <p className="text-xs text-[var(--muted-foreground)] mb-4 text-center">
          {locale === 'en'
            ? 'Speak your expense naturally (e.g. "250 birr for lunch" or "50 birr taxi")'
            : 'የወጪ ዝርዝርዎን በድምፅ ይናገሩ (ለምሳሌ "250 ብር ለምሳ" ወይም "50 ብር ታክሲ")'}
        </p>

        {/* Center Mic Button & Animated Waves */}
        <div className="flex flex-col items-center justify-center my-2 gap-3">
          <div className="relative flex items-center justify-center">
            {isRecording ? (
              <>
                <div className="absolute h-28 w-28 rounded-full bg-emerald-500/20 animate-ping" />
                <div className="absolute h-24 w-24 rounded-full bg-emerald-500/30 animate-pulse" />
              </>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void (isRecording ? handleStopRecording() : handleStartRecording());
              }}
              className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 cursor-pointer ${
                isRecording
                  ? 'bg-rose-500 text-white shadow-rose-500/30'
                  : 'bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-600'
              }`}
            >
              {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
          </div>

          {/* Status / Timer */}
          <div className="flex flex-col items-center gap-1">
            {isRecording ? (
              <span className="text-sm font-black text-rose-500 tabular-nums animate-pulse">
                ● {locale === 'en' ? 'Recording audio...' : 'ድምፅ በመቅረጽ ላይ...'} (
                {formatTime(seconds)})
              </span>
            ) : isProcessing ? (
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted-foreground)]">
                <Loader2 size={14} className="animate-spin text-emerald-500" />
                <span>
                  {locale === 'en'
                    ? 'AI transcribing and parsing audio...'
                    : 'በAI ድምፅዎን በመተርጎምና በማስላት ላይ...'}
                </span>
              </div>
            ) : parsedData ? (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ✓ {locale === 'en' ? 'Voice expense parsed' : 'የድምፅ ወጪ ተለይቷል'}
              </span>
            ) : (
              <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                {locale === 'en' ? 'Tap mic to speak' : 'ለመናገር ማይክሮፎኑን ይጫኑ'}
              </span>
            )}
          </div>
        </div>

        {/* Upload audio file button */}
        <div className="flex items-center justify-center my-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.m4a,.webm"
            onChange={(e) => {
              void handleFileUpload(e);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-1 px-3 rounded-full border border-[var(--border)] bg-[var(--secondary)]/40 cursor-pointer"
          >
            <Upload size={13} />
            <span>{locale === 'en' ? 'Or upload voice recording' : 'ወይም የድምፅ ፋይል ይምረጡ'}</span>
          </button>
        </div>

        {/* Error message banner */}
        {errorMessage ? (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 my-2 text-amber-600 dark:text-amber-400 text-xs font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {/* Quick Voice phrase buttons for rapid testing */}
        {!parsedData && !isRecording && !isProcessing ? (
          <div className="flex flex-wrap gap-1.5 justify-center my-2">
            {[
              locale === 'en' ? '250 birr for lunch' : '250 ብር ለምሳ',
              locale === 'en' ? '50 birr taxi' : '50 ብር ታክሲ',
              locale === 'en' ? '1200 birr groceries' : '1200 ብር ለቀለብ',
            ].map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => {
                  void handleManualTextSubmit(phrase);
                }}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[var(--secondary)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer active:scale-95"
              >
                "{phrase}"
              </button>
            ))}
          </div>
        ) : null}

        {/* Recognized Transcript or Editing Area */}
        {transcript || isEditingText ? (
          <div className="p-3.5 rounded-2xl bg-[var(--secondary)]/70 border border-[var(--border)] my-2 flex flex-col gap-1 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                {locale === 'en' ? 'Voice Note' : 'የተነገረው ጽሑፍ'}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingText(!isEditingText)}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer"
              >
                <Edit2 size={12} />
                <span>
                  {isEditingText
                    ? locale === 'en'
                      ? 'Cancel'
                      : 'ይቅር'
                    : locale === 'en'
                      ? 'Edit'
                      : 'አስተካክል'}
                </span>
              </button>
            </div>

            {isEditingText ? (
              <div className="flex items-center gap-1.5 mt-1">
                <Input
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={locale === 'en' ? 'e.g. 250 birr for groceries' : 'ለምሳሌ 250 ብር ለቀለብ'}
                  className="text-xs font-medium h-9 rounded-xl"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => {
                    void handleManualTextSubmit(transcript);
                  }}
                  className="h-9 px-3 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl cursor-pointer"
                >
                  {locale === 'en' ? 'Parse' : 'አስላ'}
                </Button>
              </div>
            ) : (
              <p className="text-sm font-bold text-[var(--foreground)] m-0">"{transcript}"</p>
            )}
          </div>
        ) : null}

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

        {/* AI Parsed Card Summary */}
        {parsedData ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-2 my-1 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">
                {locale === 'en' ? 'Detected Amount' : 'የተገኘው መጠን'}
              </span>
              <span className="text-base font-black text-[var(--foreground)] tabular-nums">
                ETB {parsedData.amount}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">
                {locale === 'en' ? 'Category' : 'ምድብ'}
              </span>
              <span className="text-xs font-bold text-[var(--foreground)]">
                {parsedData.category}
              </span>
            </div>

            {parsedData.note ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--muted-foreground)]">
                  {locale === 'en' ? 'Note' : 'ማስታወሻ'}
                </span>
                <span className="text-xs font-bold text-[var(--foreground)] truncate max-w-[180px]">
                  {parsedData.note}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Action Button */}
        <div className="mt-4 w-full">
          {parsedData ? (
            <Button
              onClick={() => {
                void handleConfirm();
              }}
              disabled={isSaving}
              className="w-full h-11 text-sm font-bold bg-[#10B981] hover:bg-emerald-600 text-white shadow-md rounded-xl cursor-pointer"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin mr-1.5" />
              ) : (
                <Check size={16} className="mr-1.5" />
              )}
              {locale === 'en' ? 'Confirm & Log Expense' : 'አረጋግጥና መዝግብ'}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="w-full h-11 text-xs font-bold rounded-xl cursor-pointer"
            >
              {locale === 'en' ? 'Cancel' : 'ይቅር'}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
