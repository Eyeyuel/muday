export type SummaryPeriodKind = 'today' | 'week' | 'month' | 'all' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface SummaryPeriodRanges {
  current: DateRange;
  previous: DateRange;
}

const EAT_OFFSET_MS = 3 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

function eatDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - EAT_OFFSET_MS);
}

export function parseEatDate(dateStr: string): Date | null {
  const parts = dateStr.trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => isNaN(p))) return null;
  const [year, month, day] = parts as [number, number, number];
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return eatDate(year, month - 1, day);
}

export function customPeriodRanges(
  startDateStr?: string,
  endDateStr?: string,
  now: Date = new Date(),
): SummaryPeriodRanges {
  const parsedStart = startDateStr ? parseEatDate(startDateStr) : null;
  const parsedEnd = endDateStr ? parseEatDate(endDateStr) : null;

  const eatNow = new Date(now.getTime() + EAT_OFFSET_MS);
  const year = eatNow.getUTCFullYear();
  const month = eatNow.getUTCMonth();
  const day = eatNow.getUTCDate();

  const start = parsedStart ?? eatDate(year, month - 1, day);
  let end = parsedEnd ? new Date(parsedEnd.getTime() + DAY_MS) : eatDate(year, month, day + 1);

  if (end <= start) {
    end = new Date(start.getTime() + DAY_MS);
  }

  const durationMs = end.getTime() - start.getTime();

  return {
    current: { start, end },
    previous: {
      start: new Date(start.getTime() - durationMs),
      end: start,
    },
  };
}

export function summaryPeriodRanges(
  kind: SummaryPeriodKind,
  now: Date = new Date(),
  startDateStr?: string,
  endDateStr?: string,
): SummaryPeriodRanges {
  if (kind === 'custom') {
    return customPeriodRanges(startDateStr, endDateStr, now);
  }

  if (kind === 'all') {
    return {
      current: {
        start: new Date('1970-01-01T00:00:00.000Z'),
        end: new Date('2100-01-01T00:00:00.000Z'),
      },
      previous: {
        start: new Date('1970-01-01T00:00:00.000Z'),
        end: new Date('1970-01-01T00:00:00.000Z'),
      },
    };
  }

  const eatNow = new Date(now.getTime() + EAT_OFFSET_MS);
  const year = eatNow.getUTCFullYear();
  const month = eatNow.getUTCMonth();
  const day = eatNow.getUTCDate();

  if (kind === 'today') {
    const start = eatDate(year, month, day);
    return {
      current: { start, end: new Date(start.getTime() + DAY_MS) },
      previous: {
        start: new Date(start.getTime() - DAY_MS),
        end: start,
      },
    };
  }

  if (kind === 'week') {
    const dayOfWeek = eatNow.getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const start = eatDate(year, month, day - daysSinceMonday);
    return {
      current: { start, end: new Date(start.getTime() + 7 * DAY_MS) },
      previous: {
        start: new Date(start.getTime() - 7 * DAY_MS),
        end: start,
      },
    };
  }

  const start = eatDate(year, month, 1);
  return {
    current: { start, end: eatDate(year, month + 1, 1) },
    previous: {
      start: eatDate(year, month - 1, 1),
      end: start,
    },
  };
}
