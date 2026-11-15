import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import { TelegramProfileSyncService } from '../src/telegram/transport/telegram-profile-sync.service.js';

function createService(miniAppUrl = 'https://app.muday.example') {
  const log = vi.fn();
  const warn = vi.fn();
  const logger = { log, warn } as unknown as StructuredLogger;
  const config = {
    get: vi.fn((key: string) =>
      key === 'TELEGRAM_BOT_TOKEN'
        ? '123456:test-token'
        : key === 'MINIAPP_URL'
          ? miniAppUrl
          : undefined,
    ),
  } as unknown as ConfigService<Environment, true>;
  const service = new TelegramProfileSyncService(config, logger);
  const internals = service as unknown as {
    bot: {
      api: {
        setMyCommands: (commands: unknown, options?: unknown) => Promise<boolean>;
        setMyDescription: (description: string, options?: unknown) => Promise<boolean>;
        setMyShortDescription: (description: string, options?: unknown) => Promise<boolean>;
        setChatMenuButton: (options: unknown) => Promise<boolean>;
      };
    };
  };
  const commands = vi.spyOn(internals.bot.api, 'setMyCommands').mockResolvedValue(true);
  vi.spyOn(internals.bot.api, 'setMyDescription').mockResolvedValue(true);
  vi.spyOn(internals.bot.api, 'setMyShortDescription').mockResolvedValue(true);
  const menu = vi.spyOn(internals.bot.api, 'setChatMenuButton').mockResolvedValue(true);
  return { service, log, warn, commands, menu };
}

describe('Telegram deployment synchronization', () => {
  it('synchronizes localized commands, descriptions, and the production menu button', async () => {
    const { service, log, commands, menu } = createService();

    await expect(
      service.sync({ strict: true, requirePublicMiniAppUrl: true }),
    ).resolves.toBeUndefined();

    expect(commands).toHaveBeenCalledTimes(2);
    expect(commands).toHaveBeenNthCalledWith(2, expect.any(Array), {
      language_code: 'en',
    });
    expect(menu).toHaveBeenCalledWith({
      menu_button: {
        type: 'web_app',
        text: '📊 Dashboard',
        web_app: { url: 'https://app.muday.example' },
      },
    });
    expect(log).toHaveBeenCalledWith('Telegram profile synchronization completed', {
      operationCount: 7,
      failureCount: 0,
    });
  });

  it('rejects a non-public Mini App URL in strict deployment mode', async () => {
    const { service } = createService('http://localhost:5173');

    await expect(service.sync({ strict: true, requirePublicMiniAppUrl: true })).rejects.toThrow(
      'MINIAPP_URL must be a public HTTPS URL',
    );
  });

  it('fails the deployment when any Telegram operation fails', async () => {
    const { service, warn, commands } = createService();
    commands.mockRejectedValueOnce(new Error('Telegram unavailable'));

    await expect(service.sync({ strict: true, requirePublicMiniAppUrl: true })).rejects.toThrow(
      'commands-default',
    );
    expect(warn).toHaveBeenCalledWith(
      'Telegram profile synchronization failed',
      expect.objectContaining({ operation: 'commands-default' }),
    );
  });
});
