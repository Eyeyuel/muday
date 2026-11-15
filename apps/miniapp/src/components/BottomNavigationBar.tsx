import { Home, Plus, ReceiptText, User } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { triggerHaptic } from '@/telegram/telegram-webapp';

export type NavigationTab = 'home' | 'add' | 'receipts' | 'profile';

export function BottomNavigationBar({
  currentTab,
  onSelectTab,
  locale,
}: {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  locale: Locale;
}) {
  return (
    <nav
      className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none select-none"
      aria-label="Bottom Navigation"
    >
      <div className="flex items-center justify-between h-14 px-3 rounded-full bg-white/95 dark:bg-[#12131a]/95 text-[var(--foreground)] dark:text-white shadow-[0_12px_32px_-4px_rgba(15,23,42,0.12)] dark:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.5)] border border-slate-200/80 dark:border-white/10 backdrop-blur-xl pointer-events-auto min-w-[280px] max-w-[340px] w-full">
        {/* Home Tab */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            onSelectTab('home');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
            currentTab === 'home'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] dark:text-white/60 dark:hover:text-white'
          }`}
        >
          <Home size={16} />
          {currentTab === 'home' ? <span>{locale === 'en' ? 'Home' : 'ዋና'}</span> : null}
        </button>

        {/* Add Tab */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('heavy');
            onSelectTab('add');
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
            currentTab === 'add'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] dark:text-white/60 dark:hover:text-white'
          }`}
          aria-label="Add transaction"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-current opacity-70">
            <Plus size={13} />
          </div>
          {currentTab === 'add' ? <span>{locale === 'en' ? 'Add' : 'ጨምር'}</span> : null}
        </button>

        {/* History Tab */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            onSelectTab('receipts');
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
            currentTab === 'receipts'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] dark:text-white/60 dark:hover:text-white'
          }`}
          aria-label="History"
        >
          <ReceiptText size={18} />
          {currentTab === 'receipts' ? <span>{locale === 'en' ? 'History' : 'ታሪክ'}</span> : null}
        </button>

        {/* Profile Tab */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            onSelectTab('profile');
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
            currentTab === 'profile'
              ? 'bg-[#10B981] text-white shadow-md'
              : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] dark:text-white/60 dark:hover:text-white'
          }`}
          aria-label="Profile"
        >
          <User size={18} />
          {currentTab === 'profile' ? <span>{locale === 'en' ? 'Profile' : 'መገለጫ'}</span> : null}
        </button>
      </div>
    </nav>
  );
}
