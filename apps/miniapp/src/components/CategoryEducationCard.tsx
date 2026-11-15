import { Info } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { t } from '../i18n/catalogs';
import { Card } from './ui/card';

export function CategoryEducationCard({ locale }: { locale: Locale }) {
  return (
    <Card
      className="p-4 border border-blue-500/20 bg-blue-500/5"
      aria-labelledby="category-help-heading"
    >
      <div className="flex items-center gap-2 text-blue-500 mb-1.5">
        <Info size={16} aria-hidden="true" />
        <h2 id="category-help-heading" className="text-xs font-bold uppercase tracking-wider m-0">
          {t(locale, 'categoryHelpTitle')}
        </h2>
      </div>
      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed m-0">
        {t(locale, 'categoryHelpBody')}
      </p>
    </Card>
  );
}
