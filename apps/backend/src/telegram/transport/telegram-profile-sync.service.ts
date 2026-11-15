import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';

import type { Environment } from '../../config/environment.js';
import { StructuredLogger } from '../../observability/structured-logger.service.js';
import {
  TELEGRAM_COMMANDS,
  TELEGRAM_COMMANDS_AM,
  TELEGRAM_PROFILE,
} from './telegram-profile.constants.js';

export interface TelegramProfileSyncOptions {
  strict?: boolean;
  requirePublicMiniAppUrl?: boolean;
}

@Injectable()
export class TelegramProfileSyncService {
  private readonly miniAppUrl: string;
  private readonly bot?: Bot;

  constructor(
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {
    const token = config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    this.miniAppUrl = config.get('MINIAPP_URL', { infer: true });
    if (token) this.bot = new Bot(token);
  }

  async sync(options: TelegramProfileSyncOptions = {}): Promise<void> {
    if (!this.bot) throw new Error('TELEGRAM_BOT_TOKEN is required to synchronize Telegram');

    const hasPublicMiniAppUrl = this.isPublicHttpsUrl(this.miniAppUrl);
    if (options.requirePublicMiniAppUrl && !hasPublicMiniAppUrl) {
      throw new Error('MINIAPP_URL must be a public HTTPS URL for Telegram synchronization');
    }

    const operations: Array<{ name: string; run: () => Promise<unknown> }> = [
      {
        name: 'commands-default',
        run: () => this.bot!.api.setMyCommands([...TELEGRAM_COMMANDS_AM]),
      },
      {
        name: 'commands-en',
        run: () => this.bot!.api.setMyCommands([...TELEGRAM_COMMANDS], { language_code: 'en' }),
      },
      {
        name: 'description-default',
        run: () => this.bot!.api.setMyDescription(TELEGRAM_PROFILE.am.description),
      },
      {
        name: 'description-en',
        run: () =>
          this.bot!.api.setMyDescription(TELEGRAM_PROFILE.en.description, { language_code: 'en' }),
      },
      {
        name: 'short-description-default',
        run: () => this.bot!.api.setMyShortDescription(TELEGRAM_PROFILE.am.shortDescription),
      },
      {
        name: 'short-description-en',
        run: () =>
          this.bot!.api.setMyShortDescription(TELEGRAM_PROFILE.en.shortDescription, {
            language_code: 'en',
          }),
      },
    ];
    if (hasPublicMiniAppUrl) {
      operations.push({
        name: 'menu-button',
        run: () =>
          this.bot!.api.setChatMenuButton({
            menu_button: {
              type: 'web_app',
              text: '📊 Dashboard',
              web_app: { url: this.miniAppUrl },
            },
          }),
      });
    }

    const results = await Promise.allSettled(operations.map(({ run }) => run()));
    const failures: string[] = [];
    results.forEach((result, index) => {
      if (result.status !== 'rejected') return;
      const operation = operations[index]?.name ?? 'unknown';
      failures.push(operation);
      this.logger.warn('Telegram profile synchronization failed', {
        operation,
        exceptionType: result.reason instanceof Error ? result.reason.name : typeof result.reason,
      });
    });

    if (options.strict && failures.length > 0) {
      throw new Error(`Telegram profile synchronization failed: ${failures.join(', ')}`);
    }

    this.logger.log('Telegram profile synchronization completed', {
      operationCount: operations.length,
      failureCount: failures.length,
    });
  }

  private isPublicHttpsUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname);
    } catch {
      return false;
    }
  }
}
