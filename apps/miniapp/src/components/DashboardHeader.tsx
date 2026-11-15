import type { Locale } from '../api/dashboard-types';
import { t } from '../i18n/catalogs';
import { UserAvatar } from './UserAvatar';

export function DashboardHeader({
  locale,
  development,
  user,
}: {
  locale: Locale;
  development?: boolean;
  user?: { firstName: string | null; lastName: string | null; username: string | null };
}) {
  const firstName = user?.firstName?.trim() ?? '';
  const lastName = user?.lastName?.trim() ?? '';
  const username = user?.username ? `@${user.username}` : '';

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Muday User';

  return (
    <header className="flex flex-col gap-3 pt-1 pb-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserAvatar size="md" name={fullName} />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[var(--foreground)] leading-tight">
              {fullName}
            </span>
            {username ? (
              <span className="text-xs text-[var(--muted-foreground)]">{username}</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-[var(--secondary)] px-3 py-1 text-xs font-semibold text-[var(--foreground)] border border-[var(--border)]">
          <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-pulse" />
          <span>{t(locale, 'brand')}</span>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
          {t(locale, 'title')}
        </h1>
        <p className="text-xs text-[var(--muted-foreground)]">{t(locale, 'overviewSubtitle')}</p>
      </div>

      {development ? (
        <span className="sr-only" role="status">
          {t(locale, 'development')}
        </span>
      ) : null}
    </header>
  );
}
