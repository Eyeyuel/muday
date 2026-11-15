import { createHmac, timingSafeEqual } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { ApplicationException } from '../common/errors/application.exception.js';
import { ErrorCode } from '../common/errors/error-code.js';
import type { Environment } from '../config/environment.js';

const telegramUserSchema = z
  .object({
    id: z.coerce.bigint().positive(),
    first_name: z.string().min(1),
    last_name: z.string().optional(),
    username: z.string().optional(),
  })
  .passthrough();

export interface ValidatedTelegramUser {
  id: bigint;
  firstName: string;
  lastName?: string;
  username?: string;
}

@Injectable()
export class TelegramInitDataService {
  private readonly token: string;
  private readonly maxAgeSeconds: number;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.token = config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    this.maxAgeSeconds = config.get('MINIAPP_INIT_DATA_MAX_AGE_SECONDS', { infer: true });
  }

  validate(raw: string, now = new Date()): ValidatedTelegramUser {
    if (!raw || raw.length > 8192 || !this.token) this.invalid();
    const params = new URLSearchParams(raw);
    const seen = new Set<string>();
    for (const [key] of params) {
      if (seen.has(key)) this.invalid();
      seen.add(key);
    }
    const hash = params.get('hash');
    const authDateRaw = params.get('auth_date');
    const userRaw = params.get('user');
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || !authDateRaw || !userRaw) this.invalid();

    const checkString = [...params.entries()]
      .filter(([key]) => key !== 'hash')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(this.token).digest();
    const expected = createHmac('sha256', secret).update(checkString).digest();
    const supplied = Buffer.from(hash, 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) this.invalid();

    const authDate = Number(authDateRaw);
    if (!Number.isSafeInteger(authDate) || authDate <= 0) this.invalid();
    const ageSeconds = Math.floor(now.getTime() / 1000) - authDate;
    if (ageSeconds > this.maxAgeSeconds || ageSeconds < -30) {
      throw new ApplicationException(
        ErrorCode.MINIAPP_AUTH_EXPIRED,
        HttpStatus.UNAUTHORIZED,
        'Mini App authentication expired.',
      );
    }
    try {
      const parsed = telegramUserSchema.parse(JSON.parse(userRaw) as unknown);
      return {
        id: parsed.id,
        firstName: parsed.first_name,
        ...(parsed.last_name ? { lastName: parsed.last_name } : {}),
        ...(parsed.username ? { username: parsed.username } : {}),
      };
    } catch {
      return this.invalid();
    }
  }

  private invalid(): never {
    throw new ApplicationException(
      ErrorCode.MINIAPP_AUTH_INVALID,
      HttpStatus.UNAUTHORIZED,
      'Mini App authentication failed.',
    );
  }
}
