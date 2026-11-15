import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';
import { TelegramProfileSyncService } from '../src/telegram/transport/telegram-profile-sync.service.js';

describe('Telegram profile synchronization', () => {
  it('continues after a non-critical local operation fails and configures a public Mini App', async () => {
    const warn = vi.fn();
    const config = {
      get: vi.fn((key: string) =>
        key === 'TELEGRAM_BOT_TOKEN'
          ? '123456:test-token'
          : key === 'MINIAPP_URL'
            ? 'https://app.muday.example'
            : undefined,
      ),
    } as unknown as ConfigService<Environment, true>;
    const service = new TelegramProfileSyncService(config, {
      warn,
      log: vi.fn(),
    } as unknown as StructuredLogger);
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
    vi.spyOn(internals.bot.api, 'setMyCommands')
      .mockRejectedValueOnce(new Error('temporary Telegram failure'))
      .mockResolvedValue(true);
    vi.spyOn(internals.bot.api, 'setMyDescription').mockResolvedValue(true);
    vi.spyOn(internals.bot.api, 'setMyShortDescription').mockResolvedValue(true);
    const menu = vi.spyOn(internals.bot.api, 'setChatMenuButton').mockResolvedValue(true);

    await expect(service.sync()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Telegram profile synchronization failed',
      expect.objectContaining({ operation: 'commands-default' }),
    );
    expect(menu).toHaveBeenCalledOnce();
    expect(menu.mock.calls[0]?.[0]).toEqual({
      menu_button: {
        type: 'web_app',
        text: '📊 Dashboard',
        web_app: { url: 'https://app.muday.example' },
      },
    });
  });
});
