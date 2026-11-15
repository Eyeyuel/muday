import { Receipt } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { t } from '../i18n/catalogs';
import { Card } from './ui/card';

export function EmptyStateCard({ locale }: { locale: Locale }) {
  return (
    <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed border-2">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--secondary)] text-[var(--muted-foreground)] mb-3 border border-[var(--border)]">
        <Receipt size={26} aria-hidden="true" />
      </div>
      <h2 className="text-base font-bold text-[var(--foreground)] m-0">{t(locale, 'empty')}</h2>
      <p className="text-xs text-[var(--muted-foreground)] max-w-[260px] mt-1.5 leading-relaxed">
        {t(locale, 'emptyHint')}
      </p>
    </Card>
  );
}
