import { describe, expect, it } from 'vitest';

import { addEatDays, eatDateKey, eatDayStart } from '../src/analytics/analytics-time.js';

describe('analytics EAT time boundaries', () => {
  it('starts an EAT day at the previous UTC date 21:00', () => {
    expect(eatDayStart(new Date('2026-08-04T20:59:59.999Z')).toISOString()).toBe(
      '2026-08-03T21:00:00.000Z',
    );
    expect(eatDayStart(new Date('2026-08-04T21:00:00.000Z')).toISOString()).toBe(
      '2026-08-04T21:00:00.000Z',
    );
  });

  it('adds exact EAT calendar days and creates stable date keys', () => {
    const start = new Date('2026-08-01T21:00:00.000Z');
    expect(addEatDays(start, 30).toISOString()).toBe('2026-08-31T21:00:00.000Z');
    expect(eatDateKey(start)).toBe('2026-08-02');
  });
});
