import { createHmac } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { TelegramInitDataService } from '../src/miniapp-auth/telegram-init-data.service.js';

const token = '123456:test-bot-token';
const now = new Date('2026-08-04T09:00:00.000Z');
const authDate = Math.floor(now.getTime() / 1000);
const config = {
  get: (key: string) =>
    ({ TELEGRAM_BOT_TOKEN: token, MINIAPP_INIT_DATA_MAX_AGE_SECONDS: 3600 })[key],
} as unknown as ConfigService<Environment, true>;

function signed(fields: Record<string, string>): string {
  const checkString = Object.entries(fields)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe('TelegramInitDataService', () => {
  const service = new TelegramInitDataService(config);

  it('validates an official-algorithm fixture and returns signed user profile metadata', () => {
    const raw = signed({
      auth_date: String(authDate),
      query_id: 'opaque-query',
      user: JSON.stringify({ id: 123456789, first_name: 'Private' }),
    });
    const result = service.validate(raw, now);
    expect(result.id).toBe(123456789n);
    expect(result.firstName).toBe('Private');
  });

  it('rejects tampering, malformed hashes, missing fields, and duplicate keys', () => {
    const valid = signed({
      auth_date: String(authDate),
      user: JSON.stringify({ id: 123456789 }),
    });
    expect(() => service.validate(valid.replace('123456789', '987654321'), now)).toThrow();
    expect(() => service.validate('auth_date=1&user=%7B%7D&hash=bad', now)).toThrow();
    expect(() => service.validate('', now)).toThrow();
    expect(() => service.validate(`${valid}&auth_date=${authDate}`, now)).toThrow();
  });

  it('rejects expired and future authentication dates', () => {
    const old = signed({
      auth_date: String(authDate - 3601),
      user: JSON.stringify({ id: 123456789 }),
    });
    const future = signed({
      auth_date: String(authDate + 31),
      user: JSON.stringify({ id: 123456789 }),
    });
    expect(() => service.validate(old, now)).toThrow('expired');
    expect(() => service.validate(future, now)).toThrow('expired');
  });

  it('rejects signed malformed or non-positive Telegram users', () => {
    expect(() =>
      service.validate(signed({ auth_date: String(authDate), user: '{bad' }), now),
    ).toThrow();
    expect(() =>
      service.validate(
        signed({ auth_date: String(authDate), user: JSON.stringify({ id: 0 }) }),
        now,
      ),
    ).toThrow();
  });
});
