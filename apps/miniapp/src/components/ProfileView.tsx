import { useEffect, useState } from 'react';
import {
  RotateCw,
  Sun,
  Moon,
  Smartphone,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Pencil,
  Check,
  X,
  Clock,
} from 'lucide-react';
import type { DashboardResponse, Locale } from '../api/dashboard-types';
import { fetchSettings, updateSettings } from '../api/settings-api';
import { triggerHaptic } from '@/telegram/telegram-webapp';
import { UserAvatar } from './UserAvatar';

const MORNING_TIMES = [
  { value: '06:00', labelEn: '6:00 AM', labelAm: '12:00 (ጠዋት)' },
  { value: '07:00', labelEn: '7:00 AM', labelAm: '1:00 (ጠዋት)' },
  { value: '08:00', labelEn: '8:00 AM', labelAm: '2:00 (ጠዋት)' },
  { value: '09:00', labelEn: '9:00 AM', labelAm: '3:00 (ጠዋት)' },
  { value: '10:00', labelEn: '10:00 AM', labelAm: '4:00 (ጠዋት)' },
];

const EVENING_TIMES = [
  { value: '19:00', labelEn: '7:00 PM', labelAm: '1:00 (ማታ)' },
  { value: '20:00', labelEn: '8:00 PM', labelAm: '2:00 (ማታ)' },
  { value: '21:00', labelEn: '9:00 PM', labelAm: '3:00 (ማታ)' },
  { value: '22:00', labelEn: '10:00 PM', labelAm: '4:00 (ማታ)' },
  { value: '23:00', labelEn: '11:00 PM', labelAm: '5:00 (ማታ)' },
];

function formatTimeDisplay(timeStr: string, isMorning: boolean): string {
  const [hStr] = timeStr.split(':');
  const h = parseInt(hStr || '8', 10);
  if (isMorning) {
    return `${h}:00 AM`;
  }
  const pmHour = h > 12 ? h - 12 : h;
  return `${pmHour}:00 PM`;
}

export function ProfileView({
  user,
  locale,
  themeMode = 'system',
  onThemeModeChange,
  onLanguageChange,
  onRefresh,
}: {
  user?: DashboardResponse['user'];
  locale: Locale;
  themeMode?: 'system' | 'light' | 'dark';
  onThemeModeChange?: (mode: 'system' | 'light' | 'dark') => void;
  onLanguageChange?: (locale: Locale) => void;
  onRefresh?: () => void;
}) {
  // Notification Toggle & Time States
  const [morningReminder, setMorningReminder] = useState(false);
  const [morningTime, setMorningTime] = useState('08:00');
  const [eveningStatus, setEveningStatus] = useState(true);
  const [eveningTime, setEveningTime] = useState('21:00');
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [monthlyReport, setMonthlyReport] = useState(true);

  // Time Picker Modal State
  const [timePickerTarget, setTimePickerTarget] = useState<'morning' | 'evening' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load live settings on mount
  useEffect(() => {
    void fetchSettings().then((settings) => {
      setMorningReminder(settings.morningReminderEnabled);
      if (settings.morningReminderTime) setMorningTime(settings.morningReminderTime);
      setEveningStatus(settings.nightStatusEnabled);
      if (settings.nightStatusTime) setEveningTime(settings.nightStatusTime);
      setWeeklyDigest(settings.weeklySummaryEnabled);
      setMonthlyReport(settings.monthlySummaryEnabled);
    });
  }, []);

  const handleToggleMorning = (enabled: boolean) => {
    triggerHaptic('selection');
    setMorningReminder(enabled);
    void updateSettings({ morningReminderEnabled: enabled });
  };

  const handleToggleEvening = (enabled: boolean) => {
    triggerHaptic('selection');
    setEveningStatus(enabled);
    void updateSettings({ nightStatusEnabled: enabled });
  };

  const handleToggleWeekly = (enabled: boolean) => {
    triggerHaptic('selection');
    setWeeklyDigest(enabled);
    void updateSettings({ weeklySummaryEnabled: enabled });
  };

  const handleToggleMonthly = (enabled: boolean) => {
    triggerHaptic('selection');
    setMonthlyReport(enabled);
    void updateSettings({ monthlySummaryEnabled: enabled });
  };

  const handleSelectTime = (val: string) => {
    triggerHaptic('selection');
    if (timePickerTarget === 'morning') {
      setMorningTime(val);
      setMorningReminder(true);
      void updateSettings({ morningReminderTime: val, morningReminderEnabled: true });
    } else if (timePickerTarget === 'evening') {
      setEveningTime(val);
      setEveningStatus(true);
      void updateSettings({ nightStatusTime: val, nightStatusEnabled: true });
    }
    setTimePickerTarget(null);
  };

  const tgUser =
    typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user : undefined;

  const displayName = tgUser?.first_name
    ? `${tgUser.first_name}${tgUser.last_name ? ` ${tgUser.last_name}` : ''}`
    : user?.firstName
      ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
      : 'Muday User';

  const username = tgUser?.username
    ? `@${tgUser.username}`
    : user?.username
      ? `@${user.username}`
      : '';

  return (
    <div className="flex flex-col w-full pb-32 select-none animate-fade-in px-4 pt-1 gap-5 relative">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER BAR: Title, Subtitle, Refresh Button
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between w-full pt-1">
        <div className="flex flex-col">
          <h1 className="text-xl font-black text-[var(--foreground)] tracking-tight">
            {locale === 'en' ? 'Account & Profile' : 'መለያና መገለጫ'}
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            {locale === 'en'
              ? 'Manage your verified identity & preferences'
              : 'የተረጋገጠ መለያዎንና ምርጫዎችዎን ያስተዳድሩ'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setIsRefreshing(true);
            onRefresh?.();
            void fetchSettings()
              .then((settings) => {
                setMorningReminder(settings.morningReminderEnabled);
                if (settings.morningReminderTime) setMorningTime(settings.morningReminderTime);
                setEveningStatus(settings.nightStatusEnabled);
                if (settings.nightStatusTime) setEveningTime(settings.nightStatusTime);
              })
              .finally(() => {
                setTimeout(() => setIsRefreshing(false), 600);
              });
          }}
          className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--secondary)] transition-all active:scale-95 cursor-pointer shadow-2xs"
          aria-label="Refresh"
        >
          <RotateCw size={16} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. USER IDENTITY CARD
          ───────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          {/* Avatar with Telegram Badge */}
          <UserAvatar size="xl" showBadge name={displayName} />

          {/* User Details */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black text-[var(--foreground)] truncate">
                {displayName}
              </span>
              <CheckCircle2
                size={16}
                className="text-emerald-500 shrink-0 fill-emerald-500 text-white"
              />
            </div>

            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {username}
            </span>

            <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
              {tgUser?.id ? `ID: ${tgUser.id} · ` : ''}
              {locale === 'en' ? 'Verified Telegram Account' : 'የተረጋገጠ የቴሌግራም መለያ'}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TELEGRAM REMINDERS & SUMMARIES
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-black text-[var(--foreground)] px-1">
          {locale === 'en' ? 'Telegram Reminders & Summaries' : 'የቴሌግራም ማሳሰቢያዎችና ማጠቃለያዎች'}
        </h2>

        <div className="p-4 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col divide-y divide-[var(--border)]">
          {/* 1. Morning Reminder */}
          <div className="flex items-center justify-between py-3 first:pt-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Sun size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-[var(--foreground)]">
                  {locale === 'en' ? 'Morning Reminder' : 'የማለዳ ማሳሰቢያ'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTimePickerTarget('morning');
                  }}
                  className="text-[11px] text-[var(--muted-foreground)] hover:text-emerald-500 flex items-center gap-1.5 mt-0.5 transition-colors cursor-pointer text-left"
                >
                  <span>
                    {locale === 'en'
                      ? `Sent at ${formatTimeDisplay(morningTime, true)}`
                      : `በ${formatTimeDisplay(morningTime, true)} ይላካል`}
                  </span>
                  <Pencil size={11} className="text-emerald-500 opacity-80" />
                </button>
              </div>
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => handleToggleMorning(!morningReminder)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                morningReminder ? 'bg-[#10B981]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  morningReminder ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 2. Evening Financial Status */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                <Moon size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-[var(--foreground)]">
                  {locale === 'en' ? 'Evening Financial Status' : 'የምሽት የፋይናንስ ሁኔታ'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTimePickerTarget('evening');
                  }}
                  className="text-[11px] text-[var(--muted-foreground)] hover:text-emerald-500 flex items-center gap-1.5 mt-0.5 transition-colors cursor-pointer text-left"
                >
                  <span>
                    {locale === 'en'
                      ? `Sent at ${formatTimeDisplay(eveningTime, false)}`
                      : `በ${formatTimeDisplay(eveningTime, false)} ይላካል`}
                  </span>
                  <Pencil size={11} className="text-emerald-500 opacity-80" />
                </button>
              </div>
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => handleToggleEvening(!eveningStatus)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                eveningStatus ? 'bg-[#10B981]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  eveningStatus ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Weekly Spending Digest */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <BarChart3 size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-[var(--foreground)]">
                  {locale === 'en' ? 'Weekly Spending Digest' : 'ሳምንታዊ የወጪ ማጠቃለያ'}
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  {locale === 'en' ? 'Sent every Sunday evening' : 'እሁድ ምሽት ይላካል'}
                </span>
              </div>
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => handleToggleWeekly(!weeklyDigest)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                weeklyDigest ? 'bg-[#10B981]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  weeklyDigest ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 4. Monthly Financial Report */}
          <div className="flex items-center justify-between py-3 last:pb-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <TrendingUp size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-extrabold text-[var(--foreground)]">
                  {locale === 'en' ? 'Monthly Financial Report' : 'ወርሃዊ የፋይናንስ ሪፖርት'}
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                  {locale === 'en' ? 'Comprehensive monthly analytics' : 'ዝርዝር ወርሃዊ ትንታኔ'}
                </span>
              </div>
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => handleToggleMonthly(!monthlyReport)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                monthlyReport ? 'bg-[#10B981]' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  monthlyReport ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. APPEARANCE (3-Way Theme Selector)
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-black text-[var(--foreground)] px-1">
          {locale === 'en' ? 'Appearance' : 'ገጽታ'}
        </h2>

        <div className="p-4 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-2">
          {/* 1. System Default */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onThemeModeChange?.('system');
            }}
            className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer border ${
              themeMode === 'system'
                ? 'border-[#10B981]/40 bg-emerald-500/5'
                : 'border-transparent hover:bg-[var(--secondary)]/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <Smartphone size={17} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-[var(--foreground)]">
                  {locale === 'en' ? 'System Default' : 'የስልክዎ ገጽታ (ራስ-ሰር)'}
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {locale === 'en'
                    ? 'Matches your device’s day or night mode'
                    : 'የስልክዎን የቀን ወይም የሌሊት ሁነታ ይከተላል'}
                </span>
              </div>
            </div>

            {themeMode === 'system' && (
              <Check size={16} className="text-[#10B981] font-bold shrink-0" />
            )}
          </button>

          {/* 2. Light Mode */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onThemeModeChange?.('light');
            }}
            className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer border ${
              themeMode === 'light'
                ? 'border-[#10B981]/40 bg-emerald-500/5'
                : 'border-transparent hover:bg-[var(--secondary)]/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Sun size={17} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-[var(--foreground)]">
                  {locale === 'en' ? 'Light Mode' : 'የብርሃን ሁነታ'}
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {locale === 'en' ? 'Clean light appearance' : 'የብርሃን ገጽታ'}
                </span>
              </div>
            </div>

            {themeMode === 'light' && (
              <Check size={16} className="text-[#10B981] font-bold shrink-0" />
            )}
          </button>

          {/* 3. Dark Mode */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onThemeModeChange?.('dark');
            }}
            className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer border ${
              themeMode === 'dark'
                ? 'border-[#10B981]/40 bg-emerald-500/5'
                : 'border-transparent hover:bg-[var(--secondary)]/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                <Moon size={17} />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-[var(--foreground)]">
                  {locale === 'en' ? 'Dark Mode' : 'የጨለማ ሁነታ'}
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {locale === 'en' ? 'High-contrast dark appearance' : 'የጨለማ ገጽታ'}
                </span>
              </div>
            </div>

            {themeMode === 'dark' && (
              <Check size={16} className="text-[#10B981] font-bold shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. LANGUAGE PREFERENCE
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-black text-[var(--foreground)] px-1">
          {locale === 'en' ? 'Language' : 'ቋንቋ'}
        </h2>

        <div className="p-4 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col gap-2">
          {/* English */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onLanguageChange?.('en');
            }}
            className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer border ${
              locale === 'en'
                ? 'border-[#10B981]/40 bg-emerald-500/5'
                : 'border-transparent hover:bg-[var(--secondary)]/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  locale === 'en'
                    ? 'border-[#10B981] bg-[#10B981] text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {locale === 'en' && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--foreground)]">English</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">English</span>
              </div>
            </div>

            {locale === 'en' && <Check size={16} className="text-[#10B981] font-bold" />}
          </button>

          {/* Amharic */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onLanguageChange?.('am');
            }}
            className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer border ${
              locale === 'am'
                ? 'border-[#10B981]/40 bg-emerald-500/5'
                : 'border-transparent hover:bg-[var(--secondary)]/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  locale === 'am'
                    ? 'border-[#10B981] bg-[#10B981] text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {locale === 'am' && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--foreground)]">Amharic</span>
                <span className="text-[11px] text-[var(--muted-foreground)]">አማርኛ</span>
              </div>
            </div>

            {locale === 'am' && <Check size={16} className="text-[#10B981] font-bold" />}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TIME PICKER MODAL
          ───────────────────────────────────────────────────────────── */}
      {timePickerTarget ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              triggerHaptic('light');
              setTimePickerTarget(null);
            }
          }}
        >
          <div
            className="w-full max-w-sm bg-[var(--card)] border border-[var(--border)] rounded-3xl p-5 flex flex-col gap-4 shadow-2xl animate-scale-in cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-emerald-500" />
                <h3 className="text-sm font-black text-[var(--foreground)]">
                  {timePickerTarget === 'morning'
                    ? locale === 'en'
                      ? 'Choose Morning Reminder Time'
                      : 'የማለዳ ማሳሰቢያ ሰዓት ይምረጡ'
                    : locale === 'en'
                      ? 'Choose Evening Status Time'
                      : 'የምሽት ማጠቃለያ ሰዓት ይምረጡ'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setTimePickerTarget(null);
                }}
                className="p-1 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {(timePickerTarget === 'morning' ? MORNING_TIMES : EVENING_TIMES).map((timeOpt) => {
                const currentSelected = timePickerTarget === 'morning' ? morningTime : eveningTime;
                const isSelected =
                  currentSelected.startsWith(timeOpt.value) || currentSelected === timeOpt.value;

                return (
                  <button
                    key={timeOpt.value}
                    type="button"
                    onClick={() => handleSelectTime(timeOpt.value)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold'
                        : 'border-[var(--border)] bg-[var(--secondary)]/40 text-[var(--foreground)] font-semibold hover:bg-[var(--secondary)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs">
                        {locale === 'en' ? timeOpt.labelEn : timeOpt.labelAm}
                      </span>
                    </div>

                    {isSelected && <Check size={16} className="text-emerald-500 font-black" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
