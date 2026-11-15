import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { ConsentService } from '../consent/consent.service.js';
import { AppCodeService } from '../customer-auth/app-code.service.js';
import { I18nService, type Locale } from '../i18n/i18n.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { UsersService } from '../users/users.service.js';
import { NavigationMenuService } from './navigation-menu.service.js';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ConsentService) private readonly consent: ConsentService,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(NavigationMenuService) private readonly navigation: NavigationMenuService,
    @Inject(AppCodeService) private readonly appCodeService: AppCodeService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  async start(telegramId: number, chatId: number, _updateId?: number): Promise<void> {
    void _updateId;
    const { user } = await this.users.findOrCreate(telegramId);
    const locale = this.localeOf(user.language);

    if (this.consent.isActive(user)) {
      await this.transport.sendMessage(
        chatId,
        this.i18n.translate('onboarding.returning', locale),
        {
          replyKeyboard: this.navigation.replyKeyboard(locale),
        },
      );
      return;
    }

    await this.transport.sendMessage(
      chatId,
      this.i18n.translate('language.prompt_initial', locale),
      {
        inlineKeyboard: [
          [
            { text: '🇪🇹 አማርኛ', callbackData: 'language:set:am' },
            { text: '🇬🇧 English', callbackData: 'language:set:en' },
          ],
        ],
      },
    );
  }

  async reviewConsent(interactionId: string, telegramId: number, chatId: number): Promise<void> {
    const user = await this.users.findByTelegramId(telegramId);
    const locale = this.localeOf(user?.language);
    await this.transport.sendMessage(
      chatId,
      this.i18n.translate('consent.text', locale, { consentVersion: this.consent.version }),
      {
        inlineKeyboard: [
          [
            {
              text: this.i18n.translate('consent.agree', locale),
              callbackData: `consent:accept:${interactionId}`,
            },
          ],
        ],
      },
    );
  }

  async acceptByUserId(interactionId: string, userId: string, chatId: number): Promise<void> {
    const result = await this.consent.acceptByUserId(interactionId, userId);
    const user = await this.users.findById(userId);
    const locale = this.localeOf(user?.language);
    const messageKey = {
      accepted: 'consent.accepted',
      already_accepted: 'consent.already_accepted',
      expired: 'consent.expired',
      outdated: 'consent.outdated',
      invalid: 'consent.invalid',
    } as const;

    if (result === 'accepted') {
      let code: string | null = null;
      try {
        code = await this.appCodeService.generateForUser(userId);
      } catch (error) {
        this.logger.error('Failed to generate pairing code during onboarding', error);
      }

      if (code) {
        const deepLinkBase = this.config.get('FLUTTER_DEEP_LINK_BASE', { infer: true });
        const deepLinkUrl = `${deepLinkBase.replace(/\/$/, '')}/auth?code=${encodeURIComponent(code)}`;
        await this.transport.sendMessage(
          chatId,
          this.i18n.translate('onboarding.app_code', locale, { code }),
          {
            parseMode: 'HTML',
            inlineKeyboard: [[{ text: '🚀 Open Muday App', url: deepLinkUrl }]],
          },
        );
      }

      await this.transport.sendMessage(chatId, this.i18n.translate('onboarding.ready', locale), {
        replyKeyboard: this.navigation.replyKeyboard(locale),
      });
      return;
    }
    await this.transport.sendMessage(chatId, this.i18n.translate(messageKey[result], locale));
  }

  async accept(interactionId: string, telegramId: number, chatId: number): Promise<void> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) {
      await this.transport.sendMessage(chatId, this.i18n.translate('consent.invalid', 'am'));
      return;
    }
    return this.acceptByUserId(interactionId, user.id, chatId);
  }

  private localeOf(language: string | undefined): Locale {
    return language === 'EN' ? 'en' : 'am';
  }
}
