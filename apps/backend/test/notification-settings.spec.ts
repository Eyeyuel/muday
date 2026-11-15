import { describe, expect, it } from 'vitest';

import { NotificationSettingsService } from '../src/notifications/notification-settings.service.js';

describe('NotificationSettingsService callback contract', () => {
  it.each([
    ['settings:open', { kind: 'open' }],
    ['settings:morning:toggle', { kind: 'toggle', target: 'morning' }],
    ['settings:night:toggle', { kind: 'toggle', target: 'night' }],
    ['settings:morning:time:8', { kind: 'time', target: 'morning', hour: 8 }],
    ['settings:night:time:22', { kind: 'time', target: 'night', hour: 22 }],
  ])('parses %s', (data, expected) => {
    expect(NotificationSettingsService.parseCallback(data)).toEqual(expected);
  });

  it.each([
    'settings:morning:time:5',
    'settings:night:time:19',
    'settings:night:time:23',
    'settings:morning:time:08:extra',
    'settings:unknown:toggle',
  ])('rejects invalid callback %s', (data) => {
    expect(NotificationSettingsService.parseCallback(data)).toBeNull();
  });
});
