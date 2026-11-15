import { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Clock, RotateCcw, ArrowRight, ChevronLeft } from 'lucide-react';

import type { Locale } from '../api/dashboard-types';
import { t } from '../i18n/catalogs';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from './ui/drawer';
import { Button } from './ui/button';
import { Calendar, type DateRange } from './ui/calendar';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { cn } from '@/lib/utils';

interface DateRangePickerModalProps {
  isOpen: boolean;
  locale: Locale;
  initialStartDate?: string;
  initialEndDate?: string;
  onApply: (startDate: string, endDate: string) => void;
  onClose: () => void;
}

const formatDateISO = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (str?: string): Date | undefined => {
  if (!str) return undefined;
  const parts = str.split('-');
  if (parts.length !== 3) return undefined;
  const [yStr, mStr, dStr] = parts;
  if (!yStr || !mStr || !dStr) return undefined;
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10) - 1;
  const d = parseInt(dStr, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return undefined;
  return new Date(y, m, d);
};

export function DateRangePickerModal({
  isOpen,
  locale,
  initialStartDate,
  initialEndDate,
  onApply,
  onClose,
}: DateRangePickerModalProps) {
  const todayStr = formatDateISO(new Date());

  const [startDate, setStartDate] = useState(initialStartDate || todayStr);
  const [endDate, setEndDate] = useState(initialEndDate || todayStr);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialStartDate) setStartDate(initialStartDate);
    else if (!startDate) setStartDate(todayStr);
    if (initialEndDate) setEndDate(initialEndDate);
    else if (!endDate) setEndDate(todayStr);
    setActivePicker(null);
  }, [initialStartDate, initialEndDate, isOpen, todayStr]);

  const handleApply = () => {
    if (!startDate || !endDate) {
      setErrorMsg(
        locale === 'en' ? 'Please select both start and end dates.' : 'እባክዎ መነሻ እና መድረሻ ቀኖችን ይምረጡ።',
      );
      return;
    }
    const startObj = parseLocalDate(startDate);
    const endObj = parseLocalDate(endDate);
    if (startObj && endObj && startObj > endObj) {
      setErrorMsg(
        locale === 'en' ? 'Start date cannot be after end date.' : 'የመነሻ ቀን ከመድረሻ ቀን መብለጥ አይችልም።',
      );
      return;
    }
    setErrorMsg(null);
    onApply(startDate, endDate);
  };

  const handlePreset = (preset: '7d' | '30d' | 'month') => {
    const now = new Date();
    const end = formatDateISO(now);
    let start = end;

    if (preset === '7d') {
      start = formatDateISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
    } else if (preset === '30d') {
      start = formatDateISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));
    } else if (preset === 'month') {
      start = formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1));
    }

    setStartDate(start);
    setEndDate(end);
    setErrorMsg(null);
  };

  const handleDateSelected = (date: Date | DateRange | undefined) => {
    if (!date || !(date instanceof Date)) return;
    const isoString = formatDateISO(date);
    if (activePicker === 'start') {
      setStartDate(isoString);
      const startObj = parseLocalDate(isoString);
      const endObj = parseLocalDate(endDate);
      if (startObj && endObj && startObj > endObj) {
        setEndDate('');
      }
    } else if (activePicker === 'end') {
      setEndDate(isoString);
    }
    setErrorMsg(null);
    // Auto-close calendar immediately after selection
    setActivePicker(null);
  };

  const pickerSelectedDate =
    activePicker === 'start' ? parseLocalDate(startDate) : parseLocalDate(endDate);

  const minDateForEnd = activePicker === 'end' && startDate ? parseLocalDate(startDate) : undefined;

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setActivePicker(null);
          onClose();
        }
      }}
    >
      <DrawerContent className="p-5 max-h-[92vh] overflow-y-auto">
        {/* ─────────────────────────────────────────────────────────────
            VIEW A: CALENDAR POPUP (Active when picking Start or End date)
            ───────────────────────────────────────────────────────────── */}
        {activePicker !== null ? (
          <div className="flex flex-col gap-3 animate-fade-in">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between pb-1 border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActivePicker(null);
                }}
                className="flex items-center gap-1 text-xs font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1.5 rounded-xl hover:bg-[var(--secondary)] transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
                <span>{locale === 'en' ? 'Back' : 'ተመለስ'}</span>
              </button>

              <span className="text-sm font-black text-[var(--foreground)]">
                {activePicker === 'start'
                  ? locale === 'en'
                    ? 'Select Start Date'
                    : 'የመነሻ ቀን ይምረጡ'
                  : locale === 'en'
                    ? 'Select End Date'
                    : 'የመድረሻ ቀን ይምረጡ'}
              </span>

              <div className="w-12" />
            </div>

            {/* In-App Visual Calendar Component */}
            <div className="flex justify-center my-1 w-full">
              <Calendar
                mode="single"
                selected={pickerSelectedDate}
                onSelect={handleDateSelected}
                minDate={minDateForEnd}
                locale={locale}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 animate-fade-in">
            <DrawerHeader className="p-0 text-center flex flex-col items-center gap-1">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 mb-0.5">
                <CalendarIcon size={22} aria-hidden="true" />
              </div>
              <DrawerTitle
                id="modal-date-title"
                className="text-base font-bold text-[var(--foreground)]"
              >
                {t(locale, 'selectDateRange')}
              </DrawerTitle>
            </DrawerHeader>

            {/* Quick Presets */}
            <div className="flex items-center justify-center gap-1.5 my-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 h-7"
                onClick={() => handlePreset('7d')}
              >
                <Clock size={12} aria-hidden="true" />
                <span>{t(locale, 'presetLast7Days')}</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 h-7"
                onClick={() => handlePreset('30d')}
              >
                <Clock size={12} aria-hidden="true" />
                <span>{t(locale, 'presetLast30Days')}</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 h-7"
                onClick={() => handlePreset('month')}
              >
                <Clock size={12} aria-hidden="true" />
                <span>{t(locale, 'presetThisMonth')}</span>
              </Button>
            </div>

            {/* 2 Interactive Date Cards (Tap to open Calendar for that field) */}
            <div className="grid grid-cols-2 gap-3 my-2">
              {/* Card 1: Start Date */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActivePicker('start');
                }}
                className="flex flex-col p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-emerald-500/60 hover:bg-emerald-500/5 active:scale-[0.98] transition-all text-left cursor-pointer shadow-2xs group"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold text-[var(--muted-foreground)]">
                    {locale === 'en' ? 'Start Date' : 'የመነሻ ቀን'}
                  </span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] group-hover:bg-emerald-500/20 group-hover:text-emerald-500 transition-colors">
                    <CalendarIcon size={12} />
                  </div>
                </div>

                <span
                  className={cn(
                    'text-sm font-black mt-2 tabular-nums',
                    startDate ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]',
                  )}
                >
                  {startDate || (locale === 'en' ? 'Select Date' : 'ቀን ይምረጡ')}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                  {locale === 'en' ? 'Tap to choose ➔' : 'ለመምረጥ ይጫኑ ➔'}
                </span>
              </button>

              {/* Card 2: End Date */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActivePicker('end');
                }}
                className="flex flex-col p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-emerald-500/60 hover:bg-emerald-500/5 active:scale-[0.98] transition-all text-left cursor-pointer shadow-2xs group"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[11px] font-bold text-[var(--muted-foreground)]">
                    {locale === 'en' ? 'End Date' : 'የመድረሻ ቀን'}
                  </span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] group-hover:bg-emerald-500/20 group-hover:text-emerald-500 transition-colors">
                    <CalendarIcon size={12} />
                  </div>
                </div>

                <span
                  className={cn(
                    'text-sm font-black mt-2 tabular-nums',
                    endDate ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]',
                  )}
                >
                  {endDate || (locale === 'en' ? 'Select Date' : 'ቀን ይምረጡ')}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                  {locale === 'en' ? 'Tap to choose ➔' : 'ለመምረጥ ይጫኑ ➔'}
                </span>
              </button>
            </div>

            {/* Range Preview Summary */}
            <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-[var(--secondary)]/60 border border-[var(--border)] text-xs font-semibold text-[var(--foreground)]">
              <span>{startDate || '...'}</span>
              <ArrowRight size={13} className="text-emerald-500" />
              <span>{endDate || '...'}</span>
            </div>

            {errorMsg ? (
              <p className="text-xs font-semibold text-[var(--expense)] text-center my-0.5">
                {errorMsg}
              </p>
            ) : null}

            {/* Actions */}
            <DrawerFooter className="flex flex-row items-center gap-2 p-0 mt-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setStartDate(todayStr);
                  setEndDate(todayStr);
                  setErrorMsg(null);
                }}
              >
                <RotateCcw size={14} className="mr-1.5" aria-hidden="true" />
                {t(locale, 'clearDateRange')}
              </Button>
              <Button type="button" className="flex-1 rounded-xl" onClick={handleApply}>
                {t(locale, 'applyDateRange')}
              </Button>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
