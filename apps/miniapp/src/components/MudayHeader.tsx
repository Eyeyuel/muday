import { Globe, BarChart2 } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function MudayHeader({
  locale,
  onLanguageChange,
  onOpenAnalytics,
}: {
  locale: Locale;
  onLanguageChange: (lang: Locale) => void;
  onOpenAnalytics?: () => void;
}) {
  return (
    <header className="flex items-center justify-between w-full pt-2 pb-3 select-none">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-2.5">
        <img src="/favicon.png" alt="Muday" className="h-9 w-9 object-contain" />
        <span className="text-xl font-extrabold tracking-tight text-[var(--foreground)]">
          Muday
        </span>
      </div>

      {/* Top Right Action Pills */}
      <div className="flex items-center gap-2">
        {/* Language Switcher Dropdown */}
        <div className="shrink-0">
          <Select
            value={locale}
            onValueChange={(val) => {
              triggerHaptic('selection');
              onLanguageChange(val as Locale);
            }}
          >
            <SelectTrigger className="h-9 px-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] gap-1.5 shadow-2xs">
              <Globe size={14} className="text-amber-500 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end" className="min-w-[7rem]">
              <SelectItem value="en">EN (English)</SelectItem>
              <SelectItem value="am">AM (አማርኛ)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Analytics Toggle Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            onOpenAnalytics?.();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all active:scale-95 shadow-2xs cursor-pointer"
          aria-label="Analytics"
        >
          <BarChart2 size={16} />
        </button>
      </div>
    </header>
  );
}
