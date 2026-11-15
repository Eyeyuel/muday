import { summaryPeriodRanges } from '../summaries/summary-period.js';
import type { NotificationKind } from './notification.types.js';

const EAT_OFFSET_MS = 3 * 60 * 60 * 1_000;

const datePart = (date: Date) => date.toISOString().slice(0, 10);

export function notificationPeriodKey(kind: NotificationKind, now: Date): string {
  const eat = new Date(now.getTime() + EAT_OFFSET_MS);
  if (kind === 'morning_reminder' || kind === 'night_status') return datePart(eat);
  if (kind === 'weekly_summary') {
    const start = summaryPeriodRanges('week', now).current.start;
    return datePart(new Date(start.getTime() + EAT_OFFSET_MS));
  }
  const previousMonth = new Date(Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth() - 1, 1));
  return previousMonth.toISOString().slice(0, 7);
}
