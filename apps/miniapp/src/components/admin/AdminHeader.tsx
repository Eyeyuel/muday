import { CalendarDays, ChevronRight, Moon, PanelLeft, RefreshCw, Sun } from 'lucide-react';
import type { Locale } from '../../api/dashboard-types';
import type { AdminNavTab } from './AdminSidebar';

const TAB_TITLES: Record<AdminNavTab, { kicker: string; title: string }> = {
  overview: { kicker: 'Overview', title: 'Executive Dashboard' },
  financials: { kicker: 'Analytics', title: 'Financial Volume & Channels' },
  transactions: { kicker: 'Ledger', title: 'Transactions & Banking Rails' },
  users: { kicker: 'Directory', title: 'User Directory & Ledgers' },
  voice: { kicker: 'Telemetry', title: 'Voice & AI Health' },
  system: { kicker: 'Infrastructure', title: 'System Health & Queues' },
  ai_assistant: { kicker: 'Intelligence', title: 'AI Data Assistant' },
};

export function AdminHeader({
  activeTab = 'overview',
  asOfDate,
  refreshing = false,
  theme,
  onThemeToggle,
  onAsOfChange,
  onRefresh,
  onToggleMobileNav,
}: {
  locale?: Locale;
  activeTab?: AdminNavTab;
  displayName?: string;
  userRole?: 'analytics_viewer' | 'super_admin';
  asOfDate: string;
  refreshing?: boolean;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onAsOfChange: (date: string) => void;
  onRefresh: () => void;
  onToggleMobileNav?: () => void;
  onLogout?: () => void;
}) {
  const currentMeta = TAB_TITLES[activeTab] ?? TAB_TITLES.overview;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-hairline)] bg-[var(--pure-white)] px-3 md:px-4 transition-colors">
      {/* 1. Left: Mobile trigger, separator, Breadcrumb */}
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {onToggleMobileNav ? (
          <button
            type="button"
            className="lg:hidden flex size-8 items-center justify-center rounded-lg text-[var(--slate-gray)] hover:bg-[var(--surface-ivory)] hover:text-[var(--ink-charcoal)] transition-colors"
            onClick={onToggleMobileNav}
            aria-label="Toggle navigation"
          >
            <PanelLeft className="size-4" />
          </button>
        ) : null}

        <div className="hidden sm:block h-4 w-px bg-[var(--border-hairline)] shrink-0" />

        <nav aria-label="breadcrumb" className="hidden min-w-0 md:block">
          <ol className="flex items-center gap-1.5 text-xs text-[var(--slate-gray)]">
            <li className="truncate">{currentMeta.kicker}</li>
            <ChevronRight className="size-3.5 text-[var(--slate-gray)] shrink-0" />
            <li className="truncate font-semibold text-[var(--ink-charcoal)]">
              {currentMeta.title}
            </li>
          </ol>
        </nav>
      </div>

      {/* 2. Right: Date filter, Refresh, Theme */}
      <div className="ms-auto flex shrink-0 items-center gap-1.5 md:gap-2">
        {/* As Of Date Picker */}
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] px-2.5 py-1 text-xs text-[var(--ink-charcoal)] shadow-none">
          <CalendarDays className="size-3.5 text-[var(--slate-gray)] shrink-0" />
          <span className="text-[11px] text-[var(--slate-gray)] font-medium">As Of:</span>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => onAsOfChange(e.target.value)}
            className="bg-transparent text-[11px] font-semibold text-[var(--ink-charcoal)] outline-none cursor-pointer"
          />
        </div>

        {/* Refresh Action */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex size-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] transition-colors disabled:opacity-50 cursor-pointer"
          title="Reload live telemetry"
          aria-label="Reload telemetry"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onThemeToggle}
          className="flex size-8 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--pure-white)] text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] transition-colors cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </button>
      </div>
    </header>
  );
}
