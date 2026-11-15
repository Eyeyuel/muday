import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Bot, RefreshCw } from 'lucide-react';
import { fetchAdminAnalytics, setStoredAdminToken } from '../../api/admin-api';
import type { AdminAnalyticsReport, AdminUserSession } from '../../api/admin-types';
import type { Locale } from '../../api/dashboard-types';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { AdminHeader } from './AdminHeader';
import { AdminAiChatView } from './AdminAiChatView';
import { AdminAiInsightBanner } from './AdminAiInsightBanner';
import { AdminSidebar, type AdminNavTab } from './AdminSidebar';
import { ExtractionPerformanceCard } from './ExtractionPerformanceCard';
import { FinancialVolumeCard } from './FinancialVolumeCard';
import { KPIOverviewGrid } from './KPIOverviewGrid';
import { QuickStatGrid } from './QuickStatGrid';
import { RetentionCohortCard } from './RetentionCohortCard';
import { SystemHealthCard } from './SystemHealthCard';
import { UserDetailsPage } from './UserDetailsPage';
import { UserDirectoryCard } from './UserDirectoryCard';
import { VoiceErrorDebuggerCard } from './VoiceErrorDebuggerCard';
import { VoiceHealthCard } from './VoiceHealthCard';

// FinCore Dashboard Executive Suite
import { ExecutiveRevenueWaveCard } from './ExecutiveRevenueWaveCard';
import { PaymentChannelsCard } from './PaymentChannelsCard';
import { ModalityBreakdownBarCard } from './ModalityBreakdownBarCard';
import { ExpenseVsIncomeCard } from './ExpenseVsIncomeCard';
import { TopExpenseDriversCard } from './TopExpenseDriversCard';
import { OperationalMetricsRow } from './OperationalMetricsRow';
import { RecentTransactionsTableCard } from './RecentTransactionsTableCard';
import { ActivityTimelineCard } from './ActivityTimelineCard';
import { HourlySpendingCard } from './HourlySpendingCard';
import { EventKindBreakdownCard } from './EventKindBreakdownCard';
import { AvgTicketByRailCard } from './AvgTicketByRailCard';
import { HighValueTransactionsCard } from './HighValueTransactionsCard';
import { CategoryVarianceTableCard } from './CategoryVarianceTableCard';
import { TransactionsPage } from './transactions/TransactionsPage';

function parseAdminRoute(pathname: string): { tab: AdminNavTab; userId: string | null } {
  if (pathname.startsWith('/admin/users/')) {
    const rawId = pathname.slice('/admin/users/'.length);
    if (rawId.trim()) {
      return { tab: 'users', userId: decodeURIComponent(rawId.trim()) };
    }
  }
  if (pathname === '/admin/users' || pathname === '/admin/users/') {
    return { tab: 'users', userId: null };
  }
  if (pathname === '/admin/financials' || pathname === '/admin/financials/') {
    return { tab: 'financials', userId: null };
  }
  if (pathname === '/admin/transactions' || pathname === '/admin/transactions/') {
    return { tab: 'transactions', userId: null };
  }
  if (pathname === '/admin/voice' || pathname === '/admin/voice/') {
    return { tab: 'voice', userId: null };
  }
  if (pathname === '/admin/system' || pathname === '/admin/system/') {
    return { tab: 'system', userId: null };
  }
  if (pathname === '/admin/ai' || pathname === '/admin/ai/') {
    return { tab: 'ai_assistant', userId: null };
  }
  return { tab: 'overview', userId: null };
}

export function AdminDashboard({
  locale,
  userSession,
  onLogout,
}: {
  locale: Locale;
  userSession?: AdminUserSession;
  onLogout: () => void;
}) {
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<AdminAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialRoute = parseAdminRoute(window.location.pathname);
  const [activeTab, setActiveTab] = useState<AdminNavTab>(initialRoute.tab);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialRoute.userId);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mezgeb_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const syncFromLocation = () => {
      const parsed = parseAdminRoute(window.location.pathname);
      setActiveTab(parsed.tab);
      setSelectedUserId(parsed.userId);
    };

    syncFromLocation();

    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  const handleSelectTab = (tab: AdminNavTab) => {
    setActiveTab(tab);
    setSelectedUserId(null);
    const targetPath =
      tab === 'overview' ? '/admin' : `/admin/${tab === 'ai_assistant' ? 'ai' : tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('users');
    const targetPath = `/admin/users/${encodeURIComponent(userId)}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const handleBackToDirectory = () => {
    setSelectedUserId(null);
    const targetPath = '/admin/users';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved =
        localStorage.getItem('mezgeb_admin_theme') || localStorage.getItem('muday_theme_mode');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Ignore storage errors
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('mezgeb_admin_theme', theme);
      localStorage.setItem('muday_theme_mode', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('mezgeb_admin_sidebar_collapsed', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const loadAnalytics = useCallback(
    async (forceRefresh = false) => {
      const startTime = Date.now();
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const data = await fetchAdminAnalytics(asOfDate, forceRefresh);
        if (forceRefresh) {
          const elapsed = Date.now() - startTime;
          if (elapsed < 600) {
            await new Promise((resolve) => setTimeout(resolve, 600 - elapsed));
          }
        }
        setReport(data);
        if (forceRefresh) {
          triggerToast('📊 Analytics report successfully updated with live data');
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'Unauthenticated') {
          onLogout();
          return;
        }
        const errMsg =
          err instanceof Error ? err.message : 'Failed to fetch analytics report. Please retry.';
        setError(errMsg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [asOfDate, onLogout],
  );

  useEffect(() => {
    void loadAnalytics(false);
  }, [loadAnalytics]);

  const handleLogout = () => {
    setStoredAdminToken(null);
    onLogout();
  };

  return (
    <div
      data-slot="sidebar-wrapper"
      className="group/sidebar-wrapper flex min-h-svh w-full bg-[var(--background)] text-[var(--foreground)]"
    >
      {/* 1. Collapsible Inset Sidebar (sidebar-07) */}
      <AdminSidebar
        activeTab={activeTab}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        userSession={userSession}
        onSelectTab={handleSelectTab}
        onToggleCollapse={toggleCollapse}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />

      {/* 2. Main Content Canvas (sidebar-inset) */}
      <main
        data-slot="sidebar-inset"
        className="relative w-full flex-1 flex min-h-svh flex-col bg-[var(--pure-white)] overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      >
        <AdminHeader
          locale={locale}
          activeTab={activeTab}
          asOfDate={asOfDate}
          refreshing={refreshing}
          theme={theme}
          onThemeToggle={toggleTheme}
          onAsOfChange={setAsOfDate}
          onRefresh={() => void loadAnalytics(true)}
          onToggleMobileNav={() => setMobileOpen((prev) => !prev)}
        />

        <div className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 space-y-6 w-full overflow-y-auto">
          {/* Floating Toast Banner */}
          {showToast ? (
            <div
              className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-[var(--card)] text-[var(--ink-charcoal)] border border-[var(--border-hairline)] px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-5 duration-200 text-xs font-semibold"
              role="status"
            >
              <span>{toastMessage}</span>
            </div>
          ) : null}

          {/* Error Banner */}
          {error ? (
            <div
              className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400"
              role="alert"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadAnalytics(true)}
                className="h-7 text-xs rounded-lg"
              >
                <RefreshCw className="size-3 mr-1" />
                Retry
              </Button>
            </div>
          ) : null}

          {/* Loading Skeleton */}
          {loading && !report ? (
            <div className="space-y-4" role="status">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
              <Skeleton className="h-72 rounded-xl" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-56 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
              </div>
              <span className="sr-only">Loading analytics dashboard...</span>
            </div>
          ) : null}

          {/* Active Tab View */}
          {activeTab === 'ai_assistant' ? (
            <div className="h-[calc(100vh-8.5rem)] rounded-xl border border-[var(--border-hairline)] overflow-hidden shadow-xs bg-[var(--pure-white)]">
              <AdminAiChatView />
            </div>
          ) : report ? (
            <div className="space-y-5">
              {selectedUserId ? (
                <UserDetailsPage
                  userId={selectedUserId}
                  locale={locale}
                  onBack={handleBackToDirectory}
                  onStatusChanged={() => void loadAnalytics(true)}
                  canManageUsers={userSession?.role === 'super_admin'}
                />
              ) : (
                <>
                  {activeTab === 'overview' ? (
                    <div className="space-y-5">
                      {/* Overview Header */}
                      <div className="space-y-1 mb-1">
                        <p className="text-[11px] font-bold tracking-widest text-[var(--slate-gray)] uppercase">
                          OVERVIEW
                        </p>
                        <h1 className="text-[26px] md:text-[28px] font-bold tracking-tight text-[var(--ink-charcoal)]">
                          Executive Dashboard
                        </h1>
                        <p className="text-[13px] text-[var(--slate-gray)] max-w-3xl leading-relaxed">
                          Live consumer finance — ledger-backed KPIs, multi-channel payment rails,
                          voice telemetry, and spending intelligence for Muday.
                        </p>
                      </div>

                      {/* Row 1: 4 Top KPI Cards */}
                      <KPIOverviewGrid report={report} locale={locale} />

                      {/* Row 2: Executive AI Insight Banner */}
                      <AdminAiInsightBanner report={report} />

                      {/* Row 3: 6 Quick Metric Micro-Tiles */}
                      <QuickStatGrid report={report} />

                      {/* Row 4: Multi-Wave Revenue Area Chart (8 cols) + Payment Channels (4 cols) */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <div className="lg:col-span-8 flex flex-col">
                          <ExecutiveRevenueWaveCard report={report} />
                        </div>
                        <div className="lg:col-span-4 flex flex-col">
                          <PaymentChannelsCard report={report} />
                        </div>
                      </div>

                      {/* Row 5: 3-Column Chart Trio (Bar, Dual Spline, Ranked Drivers) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ModalityBreakdownBarCard report={report} />
                        <ExpenseVsIncomeCard report={report} />
                        <TopExpenseDriversCard report={report} />
                      </div>

                      {/* Row 6: 4 Operational Metrics Summary */}
                      <OperationalMetricsRow report={report} />

                      {/* Row 7: Authentic Visualization Cards (Hourly Curve, Event Types, Rail Baskets) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <HourlySpendingCard report={report} />
                        <EventKindBreakdownCard report={report} />
                        <AvgTicketByRailCard report={report} />
                      </div>

                      {/* Row 8: Live Transactions Feed (8 cols) + High-Value Outliers (4 cols) */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <div className="lg:col-span-8 flex flex-col">
                          <RecentTransactionsTableCard report={report} />
                        </div>
                        <div className="lg:col-span-4 flex flex-col">
                          <HighValueTransactionsCard report={report} />
                        </div>
                      </div>

                      {/* Row 9: 30d Category Spending Variance Table */}
                      <CategoryVarianceTableCard report={report} />

                      {/* Row 10: Activity Timeline (Live Audit Log) */}
                      <ActivityTimelineCard report={report} />
                    </div>
                  ) : null}

                  {activeTab === 'financials' ? (
                    <div className="space-y-4">
                      <FinancialVolumeCard report={report} locale={locale} />
                      <ExtractionPerformanceCard report={report} locale={locale} />
                    </div>
                  ) : null}

                  {activeTab === 'transactions' ? (
                    <TransactionsPage locale={locale} onNavigateUser={handleSelectUser} />
                  ) : null}

                  {activeTab === 'users' ? (
                    <div className="space-y-4">
                      <UserDirectoryCard
                        report={report}
                        locale={locale}
                        onSelectUser={handleSelectUser}
                      />
                      <RetentionCohortCard report={report} locale={locale} />
                    </div>
                  ) : null}

                  {activeTab === 'voice' ? (
                    <div className="space-y-4">
                      <VoiceHealthCard report={report} locale={locale} />
                      <VoiceErrorDebuggerCard />
                    </div>
                  ) : null}

                  {activeTab === 'system' ? <SystemHealthCard /> : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* Floating AI Trigger Pill */}
        {activeTab !== 'ai_assistant' ? (
          <button
            type="button"
            onClick={() => handleSelectTab('ai_assistant')}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#059669] to-[#10b981] px-4 py-2.5 text-xs font-semibold text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer group border border-white/20"
          >
            <Bot className="size-4 text-emerald-100 group-hover:scale-110 transition-transform" />
            <span>Ask Muday AI</span>
          </button>
        ) : null}
      </main>
    </div>
  );
}
