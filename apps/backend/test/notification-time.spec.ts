import { describe, expect, it } from 'vitest';

import { notificationPeriodKey } from '../src/notifications/notification-time.js';

describe('notificationPeriodKey', () => {
  it('uses the EAT calendar day for reminders', () => {
    const beforeMidnight = new Date('2026-08-03T20:59:59.999Z');
    const midnight = new Date('2026-08-03T21:00:00.000Z');
    expect(notificationPeriodKey('morning_reminder', beforeMidnight)).toBe('2026-08-03');
    expect(notificationPeriodKey('night_status', midnight)).toBe('2026-08-04');
  });

  it('uses Monday as the weekly key and the completed prior month', () => {
    const sunday = new Date('2026-08-09T17:00:00.000Z');
    expect(notificationPeriodKey('weekly_summary', sunday)).toBe('2026-08-03');
    const firstOfMonth = new Date('2026-08-01T06:00:00.000Z');
    expect(notificationPeriodKey('monthly_summary', firstOfMonth)).toBe('2026-07');
  });
});
