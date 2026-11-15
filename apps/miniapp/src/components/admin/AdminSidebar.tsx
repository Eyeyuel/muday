import { useState } from 'react';
import {
  ArrowLeftRight,
  Bot,
  Coins,
  Cpu,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminUserSession } from '../../api/admin-types';

export type AdminNavTab =
  'overview' | 'financials' | 'transactions' | 'users' | 'voice' | 'system' | 'ai_assistant';

export function AdminSidebar({
  activeTab,
  collapsed,
  mobileOpen,
  userSession,
  onSelectTab,
  onToggleCollapse,
  onCloseMobile,
  onLogout,
}: {
  activeTab: AdminNavTab;
  collapsed: boolean;
  mobileOpen: boolean;
  userSession?: AdminUserSession;
  onSelectTab: (tab: AdminNavTab) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onLogout?: () => void;
}) {
  const [headerHovered, setHeaderHovered] = useState(false);

  const navItems: Array<{ id: AdminNavTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'financials', label: 'Financial Volume', icon: Coins },
    { id: 'transactions', label: 'Transactions & Rails', icon: ArrowLeftRight },
    { id: 'users', label: 'User Directory', icon: Users },
    { id: 'voice', label: 'Voice & AI Health', icon: Cpu },
    { id: 'system', label: 'System Infrastructure', icon: ShieldAlert },
    { id: 'ai_assistant', label: 'AI Data Assistant', icon: Bot },
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden animate-in fade-in-0 duration-200"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      ) : null}

      <aside
        data-slot="sidebar"
        data-state={collapsed ? 'collapsed' : 'expanded'}
        data-collapsible=""
        data-variant="sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen max-h-screen sticky top-0 flex-col justify-between border-r border-[var(--border-hairline)] bg-[var(--card)] select-none overflow-hidden shrink-0 transition-[width,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          collapsed ? 'w-[var(--sidebar-width-icon)]' : 'w-[var(--sidebar-width)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* 1. Sidebar Header (Brand / Expand & Collapse Trigger) */}
        <div
          data-slot="sidebar-header"
          className="flex flex-col p-2.5 border-b border-[var(--border-hairline)] shrink-0"
        >
          {collapsed ? (
            /* Collapsed Mode: Hovering avatar shows Expand button */
            <button
              type="button"
              onClick={onToggleCollapse}
              onMouseEnter={() => setHeaderHovered(true)}
              onMouseLeave={() => setHeaderHovered(false)}
              className="relative flex size-10 mx-auto items-center justify-center rounded-xl bg-[var(--surface-ivory)] hover:bg-[var(--electric-cobalt)]/10 border border-[var(--border-hairline)] hover:border-[var(--electric-cobalt)]/30 transition-all cursor-pointer group shadow-none"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              {headerHovered ? (
                <PanelLeftOpen className="size-4.5 text-[var(--electric-cobalt)] animate-in fade-in-0 zoom-in-90 duration-150" />
              ) : (
                <img
                  src="/favicon.png"
                  alt="Muday"
                  className="size-6 object-contain drop-shadow-xs"
                />
              )}
            </button>
          ) : (
            /* Expanded Mode: Full brand title and collapse button */
            <div className="flex w-full items-center justify-between gap-2 overflow-hidden rounded-xl p-1 text-left">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/favicon.png"
                  alt="Muday"
                  className="size-8 shrink-0 object-contain rounded-lg p-0.5 bg-[var(--surface-ivory)] border border-[var(--border-hairline)] shadow-2xs"
                />
                <div className="grid min-w-0 flex-1 text-left leading-tight transition-opacity duration-200">
                  <span className="truncate text-sm font-semibold text-[var(--ink-charcoal)]">
                    Muday Admin
                  </span>
                  <span className="truncate text-[11px] text-[var(--slate-gray)]">
                    Financial OS · Ethiopia
                  </span>
                </div>
              </div>

              {/* Desktop Collapse Trigger */}
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)] hover:bg-[var(--surface-ivory)] transition-colors cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="size-4" />
              </button>

              {/* Mobile Close Button */}
              <button
                type="button"
                className="flex lg:hidden size-7 shrink-0 items-center justify-center rounded-lg text-[var(--slate-gray)] hover:text-[var(--ink-charcoal)]"
                onClick={onCloseMobile}
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* 2. Navigation Items (sidebar-menu) */}
        <div
          data-slot="sidebar-content"
          className="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-3 space-y-1"
        >
          {!collapsed ? (
            <div className="px-2 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--slate-gray)] uppercase transition-opacity duration-200">
              Platform Core
            </div>
          ) : null}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-active={isActive ? 'true' : undefined}
                className={cn(
                  'group flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-left text-sm transition-all duration-200 cursor-pointer select-none',
                  collapsed ? 'justify-center px-0 size-10 mx-auto' : 'h-9',
                  isActive
                    ? 'bg-[var(--electric-cobalt)]/10 font-semibold text-[var(--electric-cobalt)]'
                    : 'text-[var(--slate-gray)] hover:bg-[var(--surface-ivory)] hover:text-[var(--ink-charcoal)]',
                )}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0 transition-transform duration-200 group-hover:scale-105',
                    isActive
                      ? 'text-[var(--electric-cobalt)]'
                      : 'text-[var(--slate-gray)] group-hover:text-[var(--ink-charcoal)]',
                  )}
                />
                {!collapsed ? (
                  <span className="truncate text-[13px] transition-opacity duration-200">
                    {item.label}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* 3. Sidebar Footer (Always pinned at the bottom of the visible screen) */}
        <div
          data-slot="sidebar-footer"
          className="mt-auto flex flex-col p-2.5 border-t border-[var(--border-hairline)] shrink-0 bg-[var(--card)]"
        >
          <div
            className={cn(
              'flex w-full items-center gap-2.5 overflow-hidden rounded-xl p-1.5 text-left transition-colors',
              collapsed ? 'justify-center p-0' : 'hover:bg-[var(--surface-ivory)]',
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--electric-cobalt)] text-[11px] font-semibold text-white shadow-xs">
              {userSession?.displayName?.[0]?.toUpperCase() || 'A'}
            </div>

            {!collapsed ? (
              <div className="grid min-w-0 flex-1 text-left text-xs leading-tight transition-opacity duration-200">
                <span className="truncate font-semibold text-[var(--ink-charcoal)]">
                  {userSession?.displayName || 'Admin'}
                </span>
                <span className="truncate text-[11px] text-[var(--slate-gray)]">
                  {userSession?.role === 'super_admin' ? 'Super Admin' : 'Viewer'}
                </span>
              </div>
            ) : null}

            {!collapsed && onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="size-7 flex items-center justify-center rounded-lg text-[var(--slate-gray)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
