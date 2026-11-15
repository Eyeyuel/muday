import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Locale } from '../api/dashboard-types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a monetary amount into a clean, comma-separated ETB string with 2 decimal places.
 * Example: 1250000.5 -> "1,250,000.50"
 */
export function formatETB(
  value: string | number | null | undefined,
  locale: Locale = 'en',
): string {
  if (value === null || value === undefined || value === '') return '0.00';
  const num = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
  if (isNaN(num)) return '0.00';

  return new Intl.NumberFormat(locale === 'am' ? 'am-ET' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Formats large amounts into compact notation (k, M, B) for constrained spaces like chart bars.
 * Example: 1500 -> "1.5k", 2500000 -> "2.5M", 1200000000 -> "1.2B"
 */
export function formatCompactETB(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
  if (isNaN(num) || num === 0) return '0';

  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${sign}${Math.round(abs)}`;
}

export function formatPercent(value: number): string {
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
}
