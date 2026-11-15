import { Inject, Injectable } from '@nestjs/common';
import { CategoryRepository } from '../categories/category.repository.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramInlineButton,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import type { BankSmsDraftPayload } from '../customer-api/customer-transactions.controller.js';
import {
  InteractionKind,
  InteractionState,
  type PendingInteraction,
} from '../generated/prisma/client.js';

const DEFAULT_EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'groceries',
  'utilities',
  'shopping',
  'cafe',
];
const DEFAULT_INCOME_CATEGORIES = ['salary', 'business', 'gift', 'remittance', 'other_income'];

const CATEGORY_TRANSLATIONS: Record<string, { en: string; am: string; emoji: string }> = {
  food: { en: 'Food', am: 'ምግብ', emoji: '🍔' },
  transport: { en: 'Transport', am: 'ትራንስፖርት', emoji: '🚗' },
  groceries: { en: 'Groceries', am: 'ሸቀጥ / ግሮሰሪ', emoji: '🛒' },
  utilities: { en: 'Utilities', am: 'መብራት / ውሃ', emoji: '💡' },
  housing: { en: 'Housing / Rent', am: 'የቤት ኪራይ', emoji: '🏠' },
  health: { en: 'Health', am: 'ጤና / መድኃኒት', emoji: '💊' },
  education: { en: 'Education', am: 'ትምህርት', emoji: '📚' },
  clothing: { en: 'Clothing', am: 'ልብስ', emoji: '👕' },
  entertainment: { en: 'Entertainment', am: 'መዝናኛ', emoji: '🎬' },
  'edir/community fund': { en: 'Edir / Community', am: 'እድር / ማህበር', emoji: '🤝' },
  'family support': { en: 'Family Support', am: 'የቤተሰብ ድጋፍ', emoji: '👨‍👩‍👧‍👦' },
  shopping: { en: 'Shopping', am: 'ግብይት', emoji: '🛍️' },
  cafe: { en: 'Cafe', am: 'ካፌ / ቡና', emoji: '☕' },
  salary: { en: 'Salary', am: 'ደመወዝ', emoji: '💼' },
  business: { en: 'Business', am: 'ንግድ', emoji: '📈' },
  freelance: { en: 'Freelance', am: 'ፍሪላንስ', emoji: '💻' },
  remittance: { en: 'Remittance', am: 'ሬሚታንስ', emoji: '🌍' },
  gift: { en: 'Gift', am: 'ስጦታ', emoji: '🎁' },
  investment: { en: 'Investment', am: 'ኢንቨስትመንት', emoji: '📊' },
  'rental income': { en: 'Rental Income', am: 'የኪራይ ገቢ', emoji: '🏢' },
  other_income: { en: 'Other Income', am: 'ሌላ ገቢ', emoji: '💵' },
  other: { en: 'Other', am: 'ሌላ', emoji: '🏷️' },
};

export function formatCategoryLabel(cat: string, locale: 'am' | 'en' = 'en'): string {
  const clean = cat.toLowerCase().trim();
  const meta = CATEGORY_TRANSLATIONS[clean];
  if (meta) {
    const label = locale === 'am' ? meta.am : meta.en;
    return `${meta.emoji} ${label}`;
  }
  const emoji = '🏷️';
  const name = clean.charAt(0).toUpperCase() + clean.slice(1).replace(/_/g, ' ');
  return `${emoji} ${name}`;
}

@Injectable()
export class SmsReviewNotificationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CategoryRepository) private readonly categoryRepository: CategoryRepository,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
  ) {}

  async getPendingDrafts(userId: string): Promise<PendingInteraction[]> {
    return this.prisma.pendingInteraction.findMany({
      where: {
        userId,
        kind: InteractionKind.CLARIFY_FINANCIAL,
        state: InteractionState.PENDING,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendReviewPrompt(
    userId: string,
    telegramId: number,
    locale: 'am' | 'en',
    draft: PendingInteraction,
    currentIndex: number,
    totalCount: number,
  ): Promise<void> {
    const payload = draft.payload as unknown as BankSmsDraftPayload;
    const amount = Number(payload?.amount || 0).toFixed(2);
    const bank = payload?.bankSource || 'Bank';
    const isIncome = (payload?.type || 'expense').toLowerCase() === 'income';

    // Format time from occurredAt
    const timeDate = payload?.occurredAt ? new Date(payload.occurredAt) : draft.createdAt;
    const timeStr = timeDate.toLocaleTimeString(locale === 'am' ? 'am-ET' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const isAmharic = locale === 'am';
    const typeLabel = isIncome ? (isAmharic ? 'ገቢ' : 'Income') : isAmharic ? 'ወጪ' : 'Expense';

    const text = isAmharic
      ? `📥 ${bank} የባንክ መልዕክት (${currentIndex} ከ ${totalCount})\n` +
        `💰 መጠን: ${amount} ETB (${typeLabel})\n` +
        `🕒 ሰዓት: ${timeStr}\n\n` +
        `🏷️ ይህ ${typeLabel} ለምን ነበር? ከታች ምድብ ይምረጡ:`
      : `📥 ${bank} Bank SMS (${currentIndex} of ${totalCount})\n` +
        `💰 Amount: ${amount} ETB (${typeLabel})\n` +
        `🕒 Time: ${timeStr}\n\n` +
        `🏷️ What was this ${typeLabel.toLowerCase()} for? Tap a category below:`;

    // Fetch user categories
    const userCategories = await this.categoryRepository.getUserCategories(userId);
    const filteredUserCats = userCategories
      .filter((c) =>
        isIncome ? c.type.toLowerCase() === 'income' : c.type.toLowerCase() !== 'income',
      )
      .map((c) => c.label.toLowerCase())
      .filter((c) => c !== 'uncategorized');

    // Combine user's top categories with default fallbacks (deduplicating)
    const defaults = isIncome ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
    const combinedSet = new Set<string>([...filteredUserCats, ...defaults]);
    const categoriesToDisplay = Array.from(combinedSet).slice(0, 6);

    // Build 2-column inline keyboard
    const inlineKeyboard: TelegramInlineButton[][] = [];
    for (let i = 0; i < categoriesToDisplay.length; i += 2) {
      const row: TelegramInlineButton[] = [
        {
          text: formatCategoryLabel(categoriesToDisplay[i]!, locale),
          callbackData: `sms_cat:${draft.id}:${categoriesToDisplay[i]}`,
        },
      ];
      if (i + 1 < categoriesToDisplay.length) {
        row.push({
          text: formatCategoryLabel(categoriesToDisplay[i + 1]!, locale),
          callbackData: `sms_cat:${draft.id}:${categoriesToDisplay[i + 1]}`,
        });
      }
      inlineKeyboard.push(row);
    }

    // Add Dismiss row
    inlineKeyboard.push([
      {
        text: isAmharic ? '❌ ሰርዝ / ዝለል' : '❌ Skip / Dismiss',
        callbackData: `sms_dismiss:${draft.id}`,
      },
    ]);

    await this.transport.sendMessage(telegramId, text, { inlineKeyboard });
  }

  async sendCompletionMessage(telegramId: number, locale: 'am' | 'en'): Promise<void> {
    const isAmharic = locale === 'am';
    const text = isAmharic
      ? '🎉 ሁሉም ተጠናቋል! የዛሬ የባንክ ግብይቶችዎ በተሳካ ሁኔታ ተመድበው ተመዝግበዋል።'
      : '🎉 All caught up! All of your bank transactions for today have been categorized and recorded.';

    await this.transport.sendMessage(telegramId, text);
  }

  async sendNextPromptOrSummary(
    userId: string,
    telegramId: number,
    locale: 'am' | 'en',
  ): Promise<void> {
    const pendingDrafts = await this.getPendingDrafts(userId);
    if (pendingDrafts.length > 0) {
      await this.sendReviewPrompt(
        userId,
        telegramId,
        locale,
        pendingDrafts[0]!,
        1,
        pendingDrafts.length,
      );
    } else {
      await this.sendCompletionMessage(telegramId, locale);
    }
  }
}
