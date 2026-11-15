import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import type { ConsentService } from '../src/consent/consent.service.js';
import { MiniAppAuthService } from '../src/miniapp-auth/miniapp-auth.service.js';
import type { TelegramInitDataService } from '../src/miniapp-auth/telegram-init-data.service.js';
import type { UsersService } from '../src/users/users.service.js';

const activeUser = {
  id: 'user-id',
  status: 'ACTIVE',
  consentVersion: 'v1',
  consentAt: new Date(),
  firstName: 'Stored',
  lastName: null,
  username: 'stored_user',
};

function setup(options: { enabled?: boolean; environment?: string; active?: boolean } = {}) {
  const config = {
    get: (key: string) =>
      ({
        NODE_ENV: options.environment ?? 'development',
        ALLOW_LOCAL_DEV_AUTH: options.enabled ?? true,
        LOCAL_DEV_TELEGRAM_ID: 123n,
      })[key],
  } as unknown as ConfigService<Environment, true>;
  const findByTelegramId = vi.fn().mockResolvedValue(options.active === false ? null : activeUser);
  const syncVerifiedTelegramProfile = vi.fn().mockResolvedValue(activeUser);
  const validate = vi.fn().mockReturnValue({ id: 456n, firstName: 'Telegram' });
  const service = new MiniAppAuthService(
    config,
    { validate } as unknown as TelegramInitDataService,
    { findByTelegramId, syncVerifiedTelegramProfile } as unknown as UsersService,
    { isActive: vi.fn().mockReturnValue(options.active !== false) } as unknown as ConsentService,
  );
  return { service, findByTelegramId, syncVerifiedTelegramProfile, validate };
}

describe('MiniAppAuthService', () => {
  it('uses only the fixed configured user for exact development auth', async () => {
    const { service, findByTelegramId } = setup();
    await expect(service.authenticate('dev')).resolves.toMatchObject({
      userId: 'user-id',
      telegramId: 123n,
      mode: 'development',
    });
    expect(findByTelegramId).toHaveBeenCalledWith(123);
    await expect(service.authenticate('dev 999')).rejects.toMatchObject({
      code: 'MINIAPP_AUTH_INVALID',
    });
  });

  it('forbids development auth when disabled or outside development', async () => {
    await expect(setup({ enabled: false }).service.authenticate('dev')).rejects.toBeDefined();
    await expect(
      setup({ environment: 'production' }).service.authenticate('dev'),
    ).rejects.toBeDefined();
  });

  it('validates tma data before resolving its user and rejects ineligible users', async () => {
    const valid = setup();
    await expect(valid.service.authenticate('tma signed-data')).resolves.toMatchObject({
      telegramId: 456n,
      mode: 'telegram',
    });
    expect(valid.validate).toHaveBeenCalledWith('signed-data');
    expect(valid.syncVerifiedTelegramProfile).toHaveBeenCalledWith(
      456,
      {
        firstName: 'Telegram',
        lastName: null,
        username: null,
      },
      'TELEGRAM_MINIAPP',
    );
    await expect(setup({ active: false }).service.authenticate('tma signed')).rejects.toBeDefined();
  });
});
