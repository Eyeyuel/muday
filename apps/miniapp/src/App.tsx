import { useEffect, useMemo, useState } from 'react';

import { getStoredAdminToken, verifyAdminSession } from './api/admin-api';
import type { AdminUserSession } from './api/admin-types';
import type { DashboardPeriod, Locale } from './api/dashboard-types';
import { Dashboard } from './components/Dashboard';
import { AddExpenseView } from './components/AddExpenseView';
import { AnalyticsView } from './components/AnalyticsView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import { BottomNavigationBar, type NavigationTab } from './components/BottomNavigationBar';
import { AddTransactionModal } from './components/AddTransactionModal';
import { VoiceCaptureModal } from './components/VoiceCaptureModal';
import { ReceiptCaptureModal } from './components/ReceiptCaptureModal';
import { BankAccountsModal } from './components/BankAccountsModal';
import { DateRangePickerModal } from './components/DateRangePickerModal';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { ErrorCard } from './components/ErrorCard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminLogin } from './components/admin/AdminLogin';
import { useDashboard } from './hooks/use-dashboard';
import {
  bootstrapTelegram,
  initialLocale,
  setTelegramColors,
  telegramWebApp,
} from './telegram/telegram-webapp';

export type ThemeMode = 'system' | 'light' | 'dark';

export function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [adminSession, setAdminSession] = useState<AdminUserSession | null>(null);
  const [adminAuthChecked, setAdminAuthChecked] = useState(false);

  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isBanksModalOpen, setIsBanksModalOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [customStartDate, setCustomStartDate] = useState<string | undefined>();
  const [customEndDate, setCustomEndDate] = useState<string | undefined>();
  const [locale, setLocale] = useState<Locale>(() => initialLocale());

  const filters = useMemo(
    () =>
      period === 'custom' ? { startDate: customStartDate, endDate: customEndDate } : undefined,
    [period, customStartDate, customEndDate],
  );

  const isAdminRoute = pathname.startsWith('/admin');
  const state = useDashboard(period, filters, !isAdminRoute);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!isAdminRoute) {
      bootstrapTelegram();
    } else {
      void verifyAdminSession().then((session) => {
        setAdminSession(session);
        setAdminAuthChecked(true);
      });
    }
  }, [isAdminRoute]);

  const handleLanguageChange = (newLocale: Locale) => {
    setLocale(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('muday_locale', newLocale);
    }
  };

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const saved =
      localStorage.getItem('mezgeb_admin_theme') || localStorage.getItem('muday_theme_mode');
    if (saved === 'system' || saved === 'light' || saved === 'dark') return saved;
    return 'system';
  });

  const [tgColorScheme, setTgColorScheme] = useState<'light' | 'dark'>(() => {
    const tg = telegramWebApp();
    if (tg?.colorScheme === 'dark' || tg?.colorScheme === 'light') {
      return tg.colorScheme;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const tg = telegramWebApp();
    if (tg?.onEvent) {
      const handleThemeChange = () => {
        setTgColorScheme(tg.colorScheme === 'dark' ? 'dark' : 'light');
      };

      tg.onEvent('themeChanged', handleThemeChange);
      return () => {
        tg.offEvent?.('themeChanged', handleThemeChange);
      };
    }

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = (e: MediaQueryListEvent) => {
        setTgColorScheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener?.('change', handleMediaChange);
      return () => {
        mediaQuery.removeEventListener?.('change', handleMediaChange);
      };
    }
  }, []);

  const activeTheme = useMemo(() => {
    if (themeMode === 'system') return tgColorScheme;
    return themeMode;
  }, [themeMode, tgColorScheme]);

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    if (activeTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setTelegramColors(activeTheme);
    try {
      localStorage.setItem('mezgeb_admin_theme', activeTheme);
      localStorage.setItem('muday_theme_mode', activeTheme);
    } catch {
      // Ignore storage errors
    }
  }, [activeTheme]);

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('muday_theme_mode', mode);
      localStorage.setItem('mezgeb_admin_theme', mode);
    }
  };

  if (isAdminRoute) {
    if (!adminAuthChecked && getStoredAdminToken()) {
      return (
        <div className="w-full min-h-screen bg-[var(--background)] p-6" role="status">
          <DashboardSkeleton locale="en" />
        </div>
      );
    }

    if (!adminSession) {
      return (
        <AdminLogin
          onSuccess={() => {
            void verifyAdminSession().then((session) => {
              setAdminSession(session);
              setAdminAuthChecked(true);
              window.history.pushState({}, '', '/admin');
              setPathname('/admin');
            });
          }}
        />
      );
    }

    return (
      <AdminDashboard
        locale="en"
        userSession={adminSession}
        onLogout={() => {
          setAdminSession(null);
          setAdminAuthChecked(true);
          window.history.pushState({}, '', '/admin/login');
          setPathname('/admin/login');
        }}
      />
    );
  }

  const handlePeriodChange = (newPeriod: DashboardPeriod, start?: string, end?: string) => {
    setPeriod(newPeriod);
    if (newPeriod === 'custom') {
      setCustomStartDate(start);
      setCustomEndDate(end);
    } else {
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
    }
  };

  const errorKey = state.error ? (`${state.error.kind}Error` as const) : undefined;

  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [addInitialMode, setAddInitialMode] = useState<'text' | 'voice' | 'receipt'>('text');

  const handleTabChange = (tab: NavigationTab) => {
    setShowAnalytics(false);
    if (tab === 'receipts') {
      setHistoryFilter('all');
    }
    if (tab === 'add') {
      setAddInitialMode('text');
    }
    setCurrentTab(tab);
  };

  return (
    <main
      className="w-full max-w-md min-h-screen mx-auto flex flex-col bg-[var(--background)] relative"
      lang={locale}
      aria-busy={state.loading}
    >
      {/* Header for non-home views */}
      {!showAnalytics && currentTab === 'home' ? null : null}

      {/* 2. Loading Skeleton */}
      {state.loading && !state.data ? (
        <div className="px-4 pt-2">
          <DashboardSkeleton locale={locale} />
        </div>
      ) : null}

      {/* 3. Error Card */}
      {state.error && errorKey ? (
        <div className="px-4 pt-2">
          <ErrorCard locale={locale} errorKey={errorKey} onRetry={state.retry} />
        </div>
      ) : null}

      {/* 4. Active Main Content / View */}
      {state.data && !state.error ? (
        showAnalytics ? (
          <div className="px-4 pt-2">
            <AnalyticsView
              data={state.data}
              locale={locale}
              currentPeriod={period}
              onBack={() => setShowAnalytics(false)}
              onRefresh={state.retry}
              onPeriodChange={handlePeriodChange}
            />
          </div>
        ) : currentTab === 'add' ? (
          <AddExpenseView
            locale={locale}
            initialMode={addInitialMode}
            onSuccess={() => {
              state.retry();
              setCurrentTab('home');
            }}
          />
        ) : currentTab === 'receipts' ? (
          <HistoryView
            data={state.data}
            locale={locale}
            initialFilter={historyFilter}
            currentPeriod={period}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onPeriodChange={handlePeriodChange}
            hasMore={state.data?.hasMore}
            loadingMore={state.loadingMore}
            onLoadMore={() => void state.loadMore()}
            onRefresh={state.retry}
          />
        ) : currentTab === 'profile' ? (
          <ProfileView
            user={state.data.user}
            locale={locale}
            themeMode={themeMode}
            onThemeModeChange={handleThemeModeChange}
            onLanguageChange={handleLanguageChange}
            onRefresh={state.retry}
          />
        ) : (
          /* Home Dashboard */
          <Dashboard
            data={state.data}
            locale={locale}
            currentPeriod={period}
            loadingMore={state.loadingMore}
            loadMoreError={state.loadMoreError}
            onLoadMore={() => void state.loadMore()}
            onOpenScanReceipt={() => {
              setAddInitialMode('receipt');
              setCurrentTab('add');
            }}
            onOpenVoiceNote={() => {
              setAddInitialMode('voice');
              setCurrentTab('add');
            }}
            onOpenQuickAdd={() => {
              setAddInitialMode('text');
              setCurrentTab('add');
            }}
            onReviewPending={() => {
              setHistoryFilter('uncategorized');
              setCurrentTab('receipts');
            }}
            onOpenIncomeHistory={() => {
              setHistoryFilter('income');
              setCurrentTab('receipts');
            }}
            onOpenExpenseHistory={() => {
              setHistoryFilter('expense');
              setCurrentTab('receipts');
            }}
            onLanguageChange={handleLanguageChange}
            onOpenAnalytics={() => setShowAnalytics(true)}
            onPeriodChange={handlePeriodChange}
            onRefresh={state.retry}
          />
        )
      ) : null}

      {/* 5. Floating Bottom Navigation Dock */}
      <BottomNavigationBar currentTab={currentTab} onSelectTab={handleTabChange} locale={locale} />

      {/* 6. Instant Direct-Capture Modals */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        locale={locale}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => void state.retry()}
      />

      <VoiceCaptureModal
        isOpen={isVoiceModalOpen}
        locale={locale}
        onClose={() => setIsVoiceModalOpen(false)}
        onSuccess={() => void state.retry()}
      />

      <ReceiptCaptureModal
        isOpen={isReceiptModalOpen}
        locale={locale}
        onClose={() => setIsReceiptModalOpen(false)}
        onSuccess={() => void state.retry()}
      />

      <BankAccountsModal
        isOpen={isBanksModalOpen}
        locale={locale}
        onClose={() => setIsBanksModalOpen(false)}
      />

      <DateRangePickerModal
        isOpen={isDatePickerOpen}
        locale={locale}
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
        onApply={(start, end) => {
          setCustomStartDate(start);
          setCustomEndDate(end);
          setIsDatePickerOpen(false);
        }}
        onClose={() => setIsDatePickerOpen(false)}
      />
    </main>
  );
}
