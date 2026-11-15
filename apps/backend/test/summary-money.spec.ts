import { describe, expect, it } from 'vitest';

import {
  decimalToCents,
  formatCents,
  formatPercentage,
  roundedPercentageHundredths,
} from '../src/summaries/summary-money.js';

describe('summary money', () => {
  it('calculates and formats exact integer cents', () => {
    expect(decimalToCents('1234.50')).toBe(123_450n);
    expect(decimalToCents('-2.05')).toBe(-205n);
    expect(formatCents(1_234_567n)).toBe('12,345.67');
    expect(formatCents(-205n)).toBe('-2.05');
  });

  it('rounds percentages to two decimal places and handles zero', () => {
    expect(roundedPercentageHundredths(1n, 3n)).toBe(3_333n);
    expect(formatPercentage(3_333n)).toBe('33.33');
    expect(roundedPercentageHundredths(10n, 0n)).toBe(0n);
  });
});
