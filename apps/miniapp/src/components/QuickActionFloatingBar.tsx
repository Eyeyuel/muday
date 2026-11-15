import { Mic, Plus, Receipt } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { triggerHaptic } from '@/telegram/telegram-webapp';

export function QuickActionFloatingBar({
  locale,
  onOpenScanReceipt,
  onOpenVoiceNote,
  onOpenQuickAdd,
}: {
  locale: Locale;
  onOpenScanReceipt?: () => void;
  onOpenVoiceNote?: () => void;
  onOpenQuickAdd?: () => void;
}) {
  return (
    <div className="w-full select-none max-w-sm">
      <div className="flex items-center justify-between h-12 px-2 rounded-full bg-white/95 dark:bg-[#181a20]/95 text-[var(--foreground)] dark:text-white shadow-[0_8px_24px_-4px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.4)] border border-slate-200/80 dark:border-white/10 backdrop-blur-md">
        {/* 1. Instant Receipt Scan Trigger */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            onOpenScanReceipt?.();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer text-xs font-bold"
        >
          <Receipt size={14} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span className="truncate">{locale === 'en' ? 'Receipt' : 'ደረሰኝ'}</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-white/15" />

        {/* 2. Instant Voice Note Trigger */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            onOpenVoiceNote?.();
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer text-xs font-bold"
        >
          <Mic size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate">{locale === 'en' ? 'Voice' : 'ድምፅ'}</span>
        </button>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-white/15" />

        {/* 3. Instant Quick Log Trigger */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('heavy');
            onOpenQuickAdd?.();
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white transition-all active:scale-95 cursor-pointer text-xs font-black shadow-xs"
        >
          <Plus size={15} className="shrink-0" />
          <span className="truncate">{locale === 'en' ? 'Quick Log' : 'መዝግብ'}</span>
        </button>
      </div>
    </div>
  );
}
