import { Calendar } from 'lucide-react';
import type { DashboardPeriod, Locale } from '../api/dashboard-types';
import { t } from '../i18n/catalogs';
import { triggerHaptic } from '@/telegram/telegram-webapp';

export function PeriodSegmentedControl({
  period,
  locale,
  onChange,
}: {
  period: DashboardPeriod;
  locale: Locale;
  onChange: (period: DashboardPeriod) => void;
}) {
  return (
    <div
      className="w-full"
      role="region"
      aria-label={locale === 'en' ? 'Dashboard period' : 'የዳሽቦርድ ጊዜ'}
    >
      <div className="grid grid-cols-3 min-h-12 bg-[var(--secondary)] p-1.5 rounded-2xl border border-[var(--border)] gap-1">
        {(['week', 'month', 'custom'] as const).map((value) => {
          const active = period === value;
          const labelKey = value === 'custom' ? 'customPeriod' : value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              className={`flex items-center justify-center gap-1.5 font-bold text-[11px] sm:text-xs transition-all rounded-xl py-2 px-2 cursor-pointer select-none text-center ${
                active
                  ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs ring-1 ring-[var(--border)]'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
              onClick={() => {
                triggerHaptic('selection');
                onChange(value);
              }}
            >
              <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
              <span className="truncate">{t(locale, labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
