import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { formatETB } from '@/lib/utils';
import { triggerHaptic } from '@/telegram/telegram-webapp';

export function BalanceOverviewCard({
  totalAmount,
  netAmount,
  locale,
  initialPrivate = true,
}: {
  totalAmount?: string;
  netAmount?: string;
  locale: Locale;
  initialPrivate?: boolean;
}) {
  // Always starts masked (ETB ******) whenever the user opens the MiniApp
  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const amountToDisplay = totalAmount ?? netAmount ?? '0.00';

  const handleToggle = () => {
    triggerHaptic('selection');
    setIsPrivate((prev) => !prev);
  };

  return (
    <div className="flex flex-col gap-1.5 pt-1 pb-3 select-none">
      {/* Subtitle & Privacy Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--muted-foreground)] tracking-wide">
          {locale === 'en' ? 'Total Transactions' : 'ጠቅላላ ግብይት'}
        </span>
        <button
          type="button"
          onClick={handleToggle}
          className="p-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
          aria-label={isPrivate ? 'Show amount' : 'Hide amount'}
        >
          {isPrivate ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>

      {/* Main Total Transaction Figure */}
      <div className="flex items-baseline gap-2 max-w-full overflow-hidden">
        <span className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--foreground)] tabular-nums truncate max-w-full">
          ETB {isPrivate ? '******' : formatETB(amountToDisplay, locale)}
        </span>
      </div>
    </div>
  );
}
