import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { I18nService, type Locale } from '../i18n/i18n.service.js';
import type {
  TelegramInlineButton,
  TelegramReplyButton,
} from '../telegram/transport/telegram-transport.interface.js';

export type NavigationAction =
  'today' | 'week' | 'month' | 'settings' | 'undo' | 'language' | 'help';

const navigationCallbackPattern = /^nav:(today|week|month|settings|undo|language|help)$/;

@Injectable()
export class NavigationMenuService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  keyboard(locale: Locale): TelegramInlineButton[][] {
    return [
      [
        { text: this.i18n.translate('navigation.today', locale), callbackData: 'nav:today' },
        { text: this.i18n.translate('navigation.week', locale), callbackData: 'nav:week' },
      ],
      [
        { text: this.i18n.translate('navigation.month', locale), callbackData: 'nav:month' },
        { text: this.i18n.translate('navigation.settings', locale), callbackData: 'nav:settings' },
      ],
      [
        { text: this.i18n.translate('navigation.undo', locale), callbackData: 'nav:undo' },
        { text: this.i18n.translate('navigation.language', locale), callbackData: 'nav:language' },
      ],
      [{ text: this.i18n.translate('navigation.help', locale), callbackData: 'nav:help' }],
    ];
  }

  replyKeyboard(locale: Locale): TelegramReplyButton[][] {
    return [
      [
        { text: this.i18n.translate('navigation.today', locale) },
        { text: this.i18n.translate('navigation.week', locale) },
      ],
      [
        { text: this.i18n.translate('navigation.month', locale) },
        { text: this.i18n.translate('navigation.settings', locale) },
      ],
      [
        { text: this.i18n.translate('navigation.undo', locale) },
        { text: this.i18n.translate('navigation.language', locale) },
      ],
      [{ text: this.i18n.translate('navigation.help', locale) }],
    ];
  }

  matchReplyButtonAction(text: string, locale: Locale): NavigationAction | null {
    const actions: NavigationAction[] = [
      'today',
      'week',
      'month',
      'settings',
      'undo',
      'language',
      'help',
    ];
    const locales: Locale[] = [locale, locale === 'en' ? 'am' : 'en'];
    const trimmed = text.trim();
    for (const loc of locales) {
      for (const action of actions) {
        const translated = this.i18n.translate(`navigation.${action}`, loc);
        if (trimmed === translated.trim()) {
          return action;
        }
      }
    }
    return null;
  }

  static parseCallback(value: string): NavigationAction | null {
    return (navigationCallbackPattern.exec(value)?.[1] as NavigationAction | undefined) ?? null;
  }

  private isPublicHttpsUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1'
      );
    } catch {
      return false;
    }
  }
}
