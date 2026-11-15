import { Inject, Injectable } from '@nestjs/common';

import { ConsentService } from '../consent/consent.service.js';
import { I18nService, type Locale } from '../i18n/i18n.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { UsersService } from '../users/users.service.js';
import { NavigationMenuService } from './navigation-menu.service.js';

@Injectable()
export class LanguageService {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(NavigationMenuService) private readonly navigation: NavigationMenuService,
    @Inject(ConsentService) private readonly consent: ConsentService,
  ) {}

  async prompt(telegramId: number, chatId: number): Promise<void> {
    const { user } = await this.users.findOrCreate(telegramId);
    const locale: Locale = user.language === 'EN' ? 'en' : 'am';
    await this.transport.sendMessage(chatId, this.i18n.translate('language.prompt', locale), {
      inlineKeyboard: [
        [
          { text: '🇪🇹 አማርኛ', callbackData: 'language:set:am' },
          { text: '🇬🇧 English', callbackData: 'language:set:en' },
        ],
      ],
    });
  }

  async changeByUserId(userId: string, chatId: number, locale: Locale): Promise<void> {
    const user = await this.users.changeLanguageByUserId(userId, locale);
    const active = this.consent.isActive(user);

    if (!active) {
      const interaction = await this.consent.createInteraction(user.id, 0);
      await this.transport.sendMessage(
        chatId,
        this.i18n.translate('consent.text', locale, { consentVersion: this.consent.version }),
        {
          inlineKeyboard: [
            [
              {
                text: this.i18n.translate('consent.agree', locale),
                callbackData: `consent:accept:${interaction.id}`,
              },
            ],
            [
              {
                text: this.i18n.translate('navigation.language', locale),
                callbackData: 'nav:language',
              },
            ],
          ],
        },
      );
      return;
    }

    await this.transport.sendMessage(chatId, this.i18n.translate('language.updated', locale), {
      replyKeyboard: this.navigation.replyKeyboard(locale),
    });
  }

  async change(telegramId: number, chatId: number, locale: Locale): Promise<void> {
    const { user } = await this.users.findOrCreate(telegramId);
    return this.changeByUserId(user.id, chatId, locale);
  }
}
