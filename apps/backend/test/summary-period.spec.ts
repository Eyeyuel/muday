import { describe, expect, it } from 'vitest';

import { summaryPeriodRanges } from '../src/summaries/summary-period.js';

describe('summaryPeriodRanges', () => {
  const now = new Date('2026-08-03T20:30:00.000Z');

  it('uses EAT midnight for today and the previous day', () => {
    const ranges = summaryPeriodRanges('today', now);
    expect(ranges.current.start.toISOString()).toBe('2026-08-02T21:00:00.000Z');
    expect(ranges.current.end.toISOString()).toBe('2026-08-03T21:00:00.000Z');
    expect(ranges.previous.start.toISOString()).toBe('2026-08-01T21:00:00.000Z');
    expect(ranges.previous.end).toEqual(ranges.current.start);
  });

  it('starts weeks on Monday in EAT', () => {
    const ranges = summaryPeriodRanges('week', now);
    expect(ranges.current.start.toISOString()).toBe('2026-08-02T21:00:00.000Z');
    expect(ranges.current.end.toISOString()).toBe('2026-08-09T21:00:00.000Z');
    expect(ranges.previous.start.toISOString()).toBe('2026-07-26T21:00:00.000Z');
    expect(ranges.previous.end).toEqual(ranges.current.start);
  });

  it('handles calendar month and year boundaries in EAT', () => {
    const august = summaryPeriodRanges('month', now);
    expect(august.current.start.toISOString()).toBe('2026-07-31T21:00:00.000Z');
    expect(august.current.end.toISOString()).toBe('2026-08-31T21:00:00.000Z');
    expect(august.previous.start.toISOString()).toBe('2026-06-30T21:00:00.000Z');

    const january = summaryPeriodRanges('month', new Date('2027-01-15T09:00:00.000Z'));
    expect(january.current.start.toISOString()).toBe('2026-12-31T21:00:00.000Z');
    expect(january.previous.start.toISOString()).toBe('2026-11-30T21:00:00.000Z');
  });

  it('moves to the next EAT day exactly at 21:00 UTC', () => {
    const before = summaryPeriodRanges('today', new Date('2026-08-03T20:59:59.999Z'));
    const after = summaryPeriodRanges('today', new Date('2026-08-03T21:00:00.000Z'));
    expect(before.current.start.toISOString()).toBe('2026-08-02T21:00:00.000Z');
    expect(after.current.start.toISOString()).toBe('2026-08-03T21:00:00.000Z');
  });

  it('handles leap-day boundaries', () => {
    const ranges = summaryPeriodRanges('today', new Date('2028-02-29T12:00:00.000Z'));
    expect(ranges.current.start.toISOString()).toBe('2028-02-28T21:00:00.000Z');
    expect(ranges.current.end.toISOString()).toBe('2028-02-29T21:00:00.000Z');
  });

  it('calculates custom date range in EAT', () => {
    const ranges = summaryPeriodRanges('custom', now, '2026-08-01', '2026-08-14');
    expect(ranges.current.start.toISOString()).toBe('2026-07-31T21:00:00.000Z');
    expect(ranges.current.end.toISOString()).toBe('2026-08-14T21:00:00.000Z');
  });
});
