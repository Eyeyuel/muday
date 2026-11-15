import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/telegram/telegram-webapp';

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface CalendarProps {
  className?: string;
  mode?: 'single' | 'range';
  selected?: Date | DateRange;
  onSelect?: (date: Date | DateRange | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  locale?: 'en' | 'am';
}

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAMES_AM = [
  'ጥር',
  'የካቲት',
  'መጋቢት',
  'ሚያዝያ',
  'ግንቦት',
  'ሰኔ',
  'ሐምሌ',
  'ነሐሴ',
  'መስከረም',
  'ጥቅምት',
  'ኅዳር',
  'ታኅሣሥ',
];

const WEEKDAY_NAMES_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const WEEKDAY_NAMES_AM = ['ሰኞ', 'ማክ', 'ረቡ', 'ሐሙ', 'ዓር', 'ቅዳ', 'እሑ'];

function isSameDay(d1?: Date, d2?: Date): boolean {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isDateInRange(target: Date, from?: Date, to?: Date): boolean {
  if (!from || !to) return false;
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toMs = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return t > f && t < toMs;
}

export function Calendar({
  className,
  mode = 'single',
  selected,
  onSelect,
  minDate,
  maxDate,
  locale = 'en',
}: CalendarProps) {
  // Initialize view month based on selected date or current date
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => {
    if (mode === 'range' && (selected as DateRange)?.from) {
      return new Date((selected as DateRange).from!);
    }
    if (mode === 'single' && selected instanceof Date) {
      return new Date(selected);
    }
    return new Date();
  });

  // Sync current month if selected changes
  React.useEffect(() => {
    if (mode === 'single' && selected instanceof Date) {
      setCurrentMonth(new Date(selected));
    }
  }, [selected, mode]);

  const range = mode === 'range' ? (selected as DateRange | undefined) : undefined;
  const single = mode === 'single' ? (selected as Date | undefined) : undefined;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const handlePrevMonth = () => {
    triggerHaptic('light');
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    triggerHaptic('light');
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleDayClick = (dayDate: Date) => {
    triggerHaptic('selection');
    if (mode === 'single') {
      onSelect?.(dayDate);
      return;
    }

    if (mode === 'range') {
      if (!range?.from || (range.from && range.to)) {
        // Start a new range selection
        onSelect?.({ from: dayDate, to: undefined });
      } else if (range.from && !range.to) {
        if (dayDate < range.from) {
          // If clicked date is before start, make it the new start
          onSelect?.({ from: dayDate, to: undefined });
        } else {
          // Complete range
          onSelect?.({ from: range.from, to: dayDate });
        }
      }
    }
  };

  // Compute month calendar days
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // 0 for Mon, 6 for Sun
  const prevMonthDays = new Date(year, month, 0).getDate();

  const today = new Date();

  const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: new Date(year, month, d),
      isCurrentMonth: true,
    });
  }

  // Trailing next month padding days (up to 42 cells for complete 6 rows)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= (remaining >= 7 ? remaining % 7 : remaining); d++) {
    cells.push({
      date: new Date(year, month + 1, d),
      isCurrentMonth: false,
    });
  }

  const weekdayNames = locale === 'am' ? WEEKDAY_NAMES_AM : WEEKDAY_NAMES_EN;
  const monthNames = locale === 'am' ? MONTH_NAMES_AM : MONTH_NAMES_EN;

  return (
    <div
      className={cn(
        'w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-[var(--foreground)] shadow-sm select-none',
        className,
      )}
    >
      {/* Month & Year Navigation Header */}
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--secondary)]/80 text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors active:scale-95 cursor-pointer"
          aria-label="Previous Month"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="text-sm font-bold tracking-tight text-[var(--foreground)]">
          {monthNames[month]} {year}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--secondary)]/80 text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors active:scale-95 cursor-pointer"
          aria-label="Next Month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day of Week Headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {weekdayNames.map((name, i) => (
          <div key={i} className="text-[11px] font-bold text-[var(--muted-foreground)] py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Day Cells Grid */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map(({ date, isCurrentMonth }, index) => {
          const isSelectedSingle = mode === 'single' && isSameDay(date, single);
          const isRangeStart = mode === 'range' && isSameDay(date, range?.from);
          const isRangeEnd = mode === 'range' && isSameDay(date, range?.to);
          const isBetween = mode === 'range' && isDateInRange(date, range?.from, range?.to);
          const isTodayDate = isSameDay(date, today);

          const targetMs = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          const minMs = minDate
            ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime()
            : undefined;
          const maxMs = maxDate
            ? new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()).getTime()
            : undefined;

          const isDisabled =
            Boolean(minMs && targetMs < minMs) || Boolean(maxMs && targetMs > maxMs);

          return (
            <div
              key={index}
              className={cn(
                'relative flex items-center justify-center h-9',
                isBetween && 'bg-emerald-500/15 dark:bg-emerald-500/20',
                isRangeStart && range?.to && 'rounded-l-xl bg-emerald-500/15',
                isRangeEnd && range?.from && 'rounded-r-xl bg-emerald-500/15',
              )}
            >
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => handleDayClick(date)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center text-xs font-semibold rounded-xl transition-all cursor-pointer',
                  !isCurrentMonth && 'text-[var(--muted-foreground)] opacity-35',
                  isCurrentMonth && 'text-[var(--foreground)] hover:bg-[var(--secondary)]',
                  isTodayDate &&
                    !isRangeStart &&
                    !isRangeEnd &&
                    !isSelectedSingle &&
                    'border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold',
                  (isRangeStart || isRangeEnd || isSelectedSingle) &&
                    'bg-[#10B981] text-white font-black shadow-xs hover:bg-[#059669] scale-105 z-10',
                  isDisabled && 'pointer-events-none opacity-20',
                )}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
