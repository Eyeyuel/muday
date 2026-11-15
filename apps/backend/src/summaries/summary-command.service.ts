import { Inject, Injectable } from '@nestjs/common';

import { NavigationMenuService } from '../onboarding/navigation-menu.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramInlineButton,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import type { Locale } from '../i18n/i18n.service.js';
import { UsersService } from '../users/users.service.js';
import { SummaryFormatterService } from './summary-formatter.service.js';
import type { SummaryPeriodKind } from './summary-period.js';
import { SummaryService } from './summary.service.js';

export function summaryTimeframeKeyboard(
  currentPeriod: SummaryPeriodKind,
  locale: Locale,
): TelegramInlineButton[][] {
  const isAm = locale === 'am';
  const periods: Array<{ kind: SummaryPeriodKind; label: string }> = [
    { kind: 'today', label: isAm ? '📅 ዛሬ' : '📅 Today' },
    { kind: 'week', label: isAm ? '🗓️ ሳምንት' : '🗓️ Week' },
    { kind: 'month', label: isAm ? '📆 ወር' : '📆 Month' },
    { kind: 'all', label: isAm ? '♾️ ሁሉም' : '♾️ All' },
  ];

  const buttons = periods.map((p) => ({
    text: p.kind === currentPeriod ? `• ${p.label} •` : p.label,
    callbackData: `summary:period:${p.kind}`,
  }));

  return [buttons.slice(0, 2), buttons.slice(2, 4)];
}

@Injectable()
export class SummaryCommandService {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(SummaryService) private readonly summaries: SummaryService,
    @Inject(SummaryFormatterService) private readonly formatter: SummaryFormatterService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(NavigationMenuService) private readonly navigation: NavigationMenuService,
  ) {}

  async sendByUserId(userId: string, chatId: number, period: SummaryPeriodKind): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== 'ACTIVE') return;
    const locale = user.language === 'EN' ? 'en' : 'am';
    const summary = await this.summaries.get(user.id, period);
    await this.transport.sendMessage(chatId, this.formatter.format(summary, locale), {
      inlineKeyboard: summaryTimeframeKeyboard(period, locale),
      replyKeyboard: this.navigation.replyKeyboard(locale),
    });
  }

  async editByUserId(
    userId: string,
    chatId: number,
    messageId: number,
    period: SummaryPeriodKind,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== 'ACTIVE') return;
    const locale = user.language === 'EN' ? 'en' : 'am';
    const summary = await this.summaries.get(user.id, period);
    await this.transport.editMessageText(
      chatId,
      messageId,
      this.formatter.format(summary, locale),
      {
        inlineKeyboard: summaryTimeframeKeyboard(period, locale),
      },
    );
  }

  async send(telegramId: number, chatId: number, period: SummaryPeriodKind): Promise<void> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) return;
    return this.sendByUserId(user.id, chatId, period);
  }
}
