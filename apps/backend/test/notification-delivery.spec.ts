import { describe, expect, it } from 'vitest';

import { notificationErrorCode } from '../src/notifications/notification-delivery.service.js';

describe('notificationErrorCode', () => {
  it('classifies permanent Telegram recipient failures', () => {
    expect(notificationErrorCode(new Error('Forbidden: bot was blocked by the user'))).toEqual({
      code: 'TELEGRAM_BOT_BLOCKED',
      permanent: true,
    });
    expect(notificationErrorCode(new Error('Bad Request: chat not found')).permanent).toBe(true);
  });

  it('allows retry for rate limits and unknown transient failures', () => {
    expect(notificationErrorCode(new Error('429: Too Many Requests'))).toEqual({
      code: 'TELEGRAM_RATE_LIMITED',
      permanent: false,
    });
    expect(notificationErrorCode(new Error('network timeout')).permanent).toBe(false);
  });
});
