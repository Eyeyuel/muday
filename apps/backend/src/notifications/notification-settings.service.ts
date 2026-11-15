import { Inject, Injectable } from '@nestjs/common';

import { I18nService, type Locale } from '../i18n/i18n.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramInlineButton,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { UsersService } from '../users/users.service.js';
import { NotificationSettingsRepository } from './notification-settings.repository.js';
import { MORNING_HOURS, NIGHT_HOURS } from './notification.types.js';

export type SettingsAction =
  | { kind: 'open' }
  | { kind: 'toggle'; target: 'morning' | 'night' }
  | { kind: 'time'; target: 'morning' | 'night'; hour: number };

@Injectable()
export class NotificationSettingsService {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(NotificationSettingsRepository)
    private readonly repository: NotificationSettingsRepository,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
  ) {}

  async showByUserId(userId: string, chatId: number): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== 'ACTIVE') return;
    const locale = user.language === 'EN' ? 'en' : 'am';
    await this.transport.sendMessage(chatId, this.message(user, locale), {
      inlineKeyboard: this.keyboard(user, locale),
    });
  }

  async show(telegramId: number, chatId: number): Promise<void> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) return;
    return this.showByUserId(user.id, chatId);
  }

  async applyByUserId(userId: string, chatId: number, action: SettingsAction): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== 'ACTIVE') return;
    if (action.kind === 'toggle') {
      await this.repository.toggle(
        user.id,
        action.target === 'morning' ? 'morningEnabled' : 'nightEnabled',
      );
    } else if (action.kind === 'time') {
      const allowed = action.target === 'morning' ? MORNING_HOURS : NIGHT_HOURS;
      if (!(allowed as readonly number[]).includes(action.hour)) return;
      await this.repository.setTime(
        user.id,
        action.target === 'morning' ? 'morningTime' : 'nightTime',
        action.hour,
      );
    }
    await this.showByUserId(user.id, chatId);
  }

  async apply(telegramId: number, chatId: number, action: SettingsAction): Promise<void> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) return;
    return this.applyByUserId(user.id, chatId, action);
  }

  static parseCallback(data: string): SettingsAction | null {
    if (data === 'settings:open') return { kind: 'open' };
    const toggle = /^settings:(morning|night):toggle$/.exec(data);
    if (toggle?.[1] === 'morning' || toggle?.[1] === 'night') {
      return { kind: 'toggle', target: toggle[1] };
    }
    const time = /^settings:(morning|night):time:(\d{1,2})$/.exec(data);
    if ((time?.[1] === 'morning' || time?.[1] === 'night') && time[2]) {
      const hour = Number(time[2]);
      const allowed = time[1] === 'morning' ? MORNING_HOURS : NIGHT_HOURS;
      return (allowed as readonly number[]).includes(hour)
        ? { kind: 'time', target: time[1], hour }
        : null;
    }
    return null;
  }

  private message(
    user: {
      morningEnabled: boolean;
      morningTime: Date;
      nightEnabled: boolean;
      nightTime: Date;
    },
    locale: Locale,
  ): string {
    return this.i18n.translate('settings.body', locale, {
      morningStatus: this.status(user.morningEnabled, locale),
      morningTime: this.hour(user.morningTime),
      nightStatus: this.status(user.nightEnabled, locale),
      nightTime: this.hour(user.nightTime),
    });
  }

  private keyboard(
    user: { morningEnabled: boolean; nightEnabled: boolean },
    locale: Locale,
  ): TelegramInlineButton[][] {
    return [
      [
        {
          text: this.i18n.translate(
            user.morningEnabled
              ? 'settings.button.disable_morning'
              : 'settings.button.enable_morning',
            locale,
          ),
          callbackData: 'settings:morning:toggle',
        },
      ],
      MORNING_HOURS.map((hour) => ({
        text: `${this.displayHour(hour)} ☀️`,
        callbackData: `settings:morning:time:${hour}`,
      })),
      [
        {
          text: this.i18n.translate(
            user.nightEnabled ? 'settings.button.disable_night' : 'settings.button.enable_night',
            locale,
          ),
          callbackData: 'settings:night:toggle',
        },
      ],
      NIGHT_HOURS.map((hour) => ({
        text: `${this.displayHour(hour)} 🌙`,
        callbackData: `settings:night:time:${hour}`,
      })),
    ];
  }

  private status(enabled: boolean, locale: Locale): string {
    return this.i18n.translate(enabled ? 'settings.enabled' : 'settings.disabled', locale);
  }

  private hour(value: Date): string {
    return this.displayHour(value.getUTCHours());
  }

  private displayHour(hour: number): string {
    const normalized = hour % 12 || 12;
    return `${normalized}:00 ${hour < 12 ? 'AM' : 'PM'}`;
  }
}
