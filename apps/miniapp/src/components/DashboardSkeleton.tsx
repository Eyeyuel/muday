import type { Locale } from '../api/dashboard-types';
import { t } from '../i18n/catalogs';
import { Skeleton } from './ui/skeleton';

export function DashboardSkeleton({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col min-h-screen w-full select-none gap-4" role="status">
      {/* 1. TOP SECTION SKELETON: Header + Hero Card + Carousel */}
      <div className="w-full bg-[var(--card)] rounded-b-[2.5rem] px-5 pt-3 pb-6 flex flex-col gap-4 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)]">
        {/* Brand Header Bar */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-2xl" />
            <Skeleton className="h-6 w-20 rounded-xl" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-16 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>

        {/* Hero Balance Card Skeleton */}
        <div className="p-5 rounded-3xl bg-[var(--secondary)]/50 border border-[var(--border)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded-lg" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
          <Skeleton className="h-9 w-44 rounded-xl" />
          <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]/60">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-16 rounded-md" />
          </div>
        </div>

        {/* Financial Flow & Review Carousel Skeleton */}
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>

      {/* 2. MIDDLE SECTION: Quick Action Floating Toolbar Skeleton */}
      <div className="py-2 px-4 w-full flex justify-center">
        <Skeleton className="h-12 w-full max-w-sm rounded-full" />
      </div>

      {/* 3. BOTTOM SECTION: Transaction Feed Skeleton */}
      <div className="w-full bg-[var(--card)] rounded-t-[2.5rem] px-5 pt-6 pb-28 flex-1 flex flex-col gap-4 shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32 rounded-lg" />
          <Skeleton className="h-5 w-20 rounded-lg" />
        </div>

        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--secondary)]/40 border border-[var(--border)]"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-2xl" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-3 w-16 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-5 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">{t(locale, 'loading')}</span>
    </div>
  );
}
