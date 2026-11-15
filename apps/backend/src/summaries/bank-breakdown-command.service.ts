import { Inject, Injectable } from '@nestjs/common';

import { DashboardRepository } from '../dashboard/dashboard.repository.js';
import { I18nService, type Locale } from '../i18n/i18n.service.js';
import { NavigationMenuService } from '../onboarding/navigation-menu.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { UsersService } from '../users/users.service.js';
import { summaryPeriodRanges, type SummaryPeriodKind } from './summary-period.js';

@Injectable()
export class BankBreakdownCommandService {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(DashboardRepository) private readonly dashboardRepository: DashboardRepository,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(NavigationMenuService) private readonly navigation: NavigationMenuService,
  ) {}

  async sendByUserId(
    userId: string,
    chatId: number,
    period: SummaryPeriodKind = 'month',
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== 'ACTIVE') return;
    const locale: Locale = user.language === 'EN' ? 'en' : 'am';
    const ranges = summaryPeriodRanges(period, new Date());
    const data = await this.dashboardRepository.getBankBreakdown(user.id, ranges.current);

    const isAm = locale === 'am';
    const periodLabel =
      period === 'today'
        ? isAm
          ? 'ዛሬ'
          : 'Today'
        : period === 'week'
          ? isAm
            ? 'የዚህ ሳምንት'
            : 'This Week'
          : period === 'all'
            ? isAm
              ? 'ሁሉም ጊዜ'
              : 'All Time'
            : isAm
              ? 'የዚህ ወር'
              : 'This Month';

    if (data.totalCount === 0) {
      const text = `${this.i18n.translate('banks.title', locale, { period: periodLabel })}\n\n${this.i18n.translate('banks.empty', locale)}`;
      await this.transport.sendMessage(chatId, text, {
        replyKeyboard: this.navigation.replyKeyboard(locale),
      });
      return;
    }

    const lines: string[] = [
      this.i18n.translate('banks.title', locale, { period: periodLabel }),
      '',
    ];

    for (const bank of data.banks) {
      const bankName = isAm ? bank.nameAm : bank.name;
      lines.push(
        `${bank.emoji} ${this.i18n.translate('banks.line', locale, {
          bank: bankName,
          count: bank.count,
          amount: bank.totalEtb.toFixed(2),
        })}`,
      );
    }

    if (data.other.count > 0) {
      const otherName = isAm ? '💵 በእጅ ጥሬ ገንዘብ / ሌሎች' : '💵 Cash / Other';
      lines.push(
        `${this.i18n.translate('banks.line', locale, {
          bank: otherName,
          count: data.other.count,
          amount: data.other.totalEtb.toFixed(2),
        })}`,
      );
    }

    lines.push('');
    lines.push(
      this.i18n.translate('banks.total', locale, {
        count: data.totalCount,
        amount: data.totalEtb.toFixed(2),
      }),
    );

    await this.transport.sendMessage(chatId, lines.join('\n'), {
      replyKeyboard: this.navigation.replyKeyboard(locale),
    });
  }

  async send(
    telegramId: number,
    chatId: number,
    period: SummaryPeriodKind = 'month',
  ): Promise<void> {
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) return;
    return this.sendByUserId(user.id, chatId, period);
  }
}
