import { AlertCircle, RotateCcw } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { t, type TranslationKey } from '../i18n/catalogs';
import { Card } from './ui/card';
import { Button } from './ui/button';

export function ErrorCard({
  locale,
  errorKey,
  onRetry,
}: {
  locale: Locale;
  errorKey: TranslationKey;
  onRetry?: () => void;
}) {
  return (
    <Card
      className="flex flex-col items-center justify-center p-8 text-center border-rose-500/20 bg-rose-500/5"
      role="alert"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 mb-3 border border-rose-500/30">
        <AlertCircle size={26} aria-hidden="true" />
      </div>
      <h2 className="text-base font-bold text-[var(--foreground)] m-0">{t(locale, errorKey)}</h2>
      {errorKey !== 'authError' && onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 flex items-center gap-1.5 rounded-xl border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
          onClick={onRetry}
        >
          <RotateCcw size={14} aria-hidden="true" />
          <span>{t(locale, 'retry')}</span>
        </Button>
      ) : null}
    </Card>
  );
}
