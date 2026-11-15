import type { DashboardResponse, Locale } from '../api/dashboard-types';
import { categoryLabels, t } from '../i18n/catalogs';
import { formatETB, formatPercent } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from './ui/card';

const categoryColorPalette: Record<string, string> = {
  food: '#10b981',
  transport: '#3b82f6',
  rent: '#8b5cf6',
  housing: '#8b5cf6',
  utilities: '#f59e0b',
  airtime_data: '#ec4899',
  health: '#ef4444',
  education: '#06b6d4',
  family_support: '#f97316',
  entertainment: '#a855f7',
  clothing: '#14b8a6',
  church_charity: '#6366f1',
  groceries: '#10b981',
  cafe: '#d97706',
  shopping: '#ec4899',
  other: '#64748b',
};

const getCategoryColor = (category: string, index: number): string => {
  const key = category.toLowerCase();
  const color = categoryColorPalette[key];
  if (color) {
    return color;
  }
  const fallbackColors = [
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#f59e0b',
    '#ec4899',
    '#ef4444',
    '#06b6d4',
    '#14b8a6',
    '#f97316',
  ];
  return fallbackColors[index % fallbackColors.length] ?? '#10b981';
};

export function CategoryBreakdownCard({
  categories,
  totalExpenseEtb,
  locale,
}: {
  categories: DashboardResponse['expenseCategories'];
  totalExpenseEtb: string;
  locale: Locale;
}) {
  if (categories.length === 0) return null;

  // Build conic-gradient string for donut visualization
  let accumulatedDegrees = 0;
  const gradientStops = categories.map((cat, idx) => {
    const color = getCategoryColor(cat.category, idx);
    const startDeg = accumulatedDegrees;
    const degShare = (cat.percentage / 100) * 360;
    accumulatedDegrees += degShare;
    return `${color} ${startDeg}deg ${accumulatedDegrees}deg`;
  });

  const conicGradientStyle =
    gradientStops.length > 0
      ? `conic-gradient(${gradientStops.join(', ')})`
      : 'conic-gradient(#64748b 0deg 360deg)';

  return (
    <Card className="p-5" aria-labelledby="categories-heading">
      <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
        <CardTitle id="categories-heading" className="text-sm font-bold text-[var(--foreground)]">
          {t(locale, 'categories')}
        </CardTitle>
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {categories.length} {locale === 'am' ? 'ምድቦች' : 'categories'}
        </span>
      </CardHeader>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut Chart Ring */}
        <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
          <div
            className="h-full w-full rounded-full p-3.5 shadow-inner transition-transform duration-300 hover:scale-105"
            style={{ backgroundImage: conicGradientStyle }}
          >
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[var(--card)] shadow-xs">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--muted-foreground)]">
                {t(locale, 'total')}
              </span>
              <strong className="text-xs sm:text-sm font-bold text-[var(--foreground)] tabular-nums truncate px-2 max-w-full">
                ETB {formatETB(totalExpenseEtb, locale)}
              </strong>
            </div>
          </div>
        </div>

        {/* Category List */}
        <div className="flex flex-1 flex-col gap-2.5 w-full">
          {categories.map((item, idx) => {
            const color = getCategoryColor(item.category, idx);
            const label = categoryLabels[locale][item.category] ?? item.category;

            return (
              <div key={item.category} className="flex flex-col gap-1 w-full">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shadow-2xs"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-[var(--foreground)]">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong className="font-bold text-[var(--foreground)] tabular-nums">
                      ETB {formatETB(item.amountEtb, locale)}
                    </strong>
                    <span className="min-w-9 text-right font-medium text-[var(--muted-foreground)] tabular-nums">
                      {formatPercent(item.percentage)}
                    </span>
                  </div>
                </div>

                {/* Micro Progress Bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(3, item.percentage)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
