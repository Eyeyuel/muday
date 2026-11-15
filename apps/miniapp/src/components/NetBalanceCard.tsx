import { TrendingDown, TrendingUp } from 'lucide-react';
import type { Locale } from '../api/dashboard-types';
import { t } from '../i18n/catalogs';
import { formatETB } from '@/lib/utils';
import { Card } from './ui/card';

export function NetBalanceCard({ netEtb, locale }: { netEtb: string; locale: Locale }) {
  const isPositive = Number(netEtb) >= 0;
  const sign = isPositive ? '+' : '';

  return (
    <Card
      className={`relative overflow-hidden border p-6 transition-all duration-300 ${
        isPositive
          ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 text-emerald-500'
          : 'bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-500/20 text-rose-500'
      }`}
    >
      {/* Subtle top-right ambient background glow */}
      <div
        className={`absolute -top-12 -right-12 h-36 w-36 rounded-full blur-3xl opacity-30 ${
          isPositive ? 'bg-emerald-400' : 'bg-rose-400'
        }`}
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
          {t(locale, 'netBalance')}
        </span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-xs transition-transform hover:scale-105 ${
            isPositive
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-500'
          }`}
          aria-hidden="true"
        >
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        </div>
      </div>

      <div className="relative z-10 mt-3 flex items-baseline max-w-full overflow-hidden">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--foreground)] tabular-nums truncate max-w-full">
          <span
            className={isPositive ? 'text-emerald-500 mr-1' : 'text-rose-500 mr-1'}
            aria-hidden="true"
          >
            {sign}
          </span>
          ETB {formatETB(netEtb, locale)}
        </h2>
      </div>

      {/* Decorative Sparkline */}
      <div className="relative mt-4 h-10 w-full overflow-hidden opacity-60">
        <svg
          className="h-full w-full"
          viewBox="0 0 300 50"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="netSparklineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d="M 0 35 C 50 30, 100 42, 150 18 C 200 8, 250 24, 300 12 L 300 50 L 0 50 Z"
            fill="url(#netSparklineGrad)"
          />
          <path
            d="M 0 35 C 50 30, 100 42, 150 18 C 200 8, 250 24, 300 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="300" cy="12" r="3.5" fill="currentColor" />
        </svg>
      </div>
    </Card>
  );
}
