import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Message } from 'grammy/types';

import type { Environment } from '../config/environment.js';
import { ConsentGuard } from '../consent/consent.guard.js';
import { ConsentService } from '../consent/consent.service.js';
import { AppCodeService } from '../customer-auth/app-code.service.js';
import { DeletionService } from '../deletion/deletion.service.js';
import { parseDeletionCallback } from '../deletion/deletion.types.js';
import { I18nService, type Locale } from '../i18n/i18n.service.js';
import { LanguageService } from '../onboarding/language.service.js';
import {
  NavigationMenuService,
  type NavigationAction,
} from '../onboarding/navigation-menu.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { NotificationSettingsService } from '../notifications/notification-settings.service.js';
import { ReceiptQueueService } from '../receipt/receipt-queue.service.js';
import type { ReceiptMimeType } from '../receipt/receipt-job.js';
import { BankBreakdownCommandService } from '../summaries/bank-breakdown-command.service.js';
import { DashboardRepository } from '../dashboard/dashboard.repository.js';
import { SummaryCommandService } from '../summaries/summary-command.service.js';
import type { SummaryPeriodKind } from '../summaries/summary-period.js';
import { UsersService } from '../users/users.service.js';
import { TextTransactionService } from '../transactions/text-transaction.service.js';
import { VoiceQueueService } from '../voice/voice-queue.service.js';
import { CategoryRepository } from '../categories/category.repository.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  FinancialEventKind,
  Prisma,
  TransactionSource,
  TransactionType,
} from '../generated/prisma/client.js';
import { smartMatchConfirmationPayloadSchema } from '../interactions/interaction-payload.schema.js';
import type { BankSmsDraftPayload } from '../customer-api/customer-transactions.controller.js';
import { SmsReviewNotificationService } from '../notifications/sms-review-notification.service.js';
import type { TelegramUpdate } from './telegram.types.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramTransport,
} from './transport/telegram-transport.interface.js';

const commandPattern = (command: string) =>
  new RegExp(`^/${command}(?:@[a-zA-Z0-9_]+)?(?:\\s|$)`, 'i');
const consentCallbackPattern =
  /^consent:accept:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const consentReviewCallbackPattern =
  /^consent:review:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const languageCallbackPattern = /^language:set:(am|en)$/;
const interactionCallbackPattern =
  /^ix:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(income|expense|confirm|cancel|undo|keep|work|gift|loan_in|loan_out|own_transfer|paid_someone|paid_me|refund|reimburse)$/i;
const smsCategoryCallbackPattern =
  /^sms_cat:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):([a-z0-9_ -]+)$/i;
const smsDismissCallbackPattern =
  /^sms_dismiss:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const summaryPeriodCallbackPattern = /^summary:period:(today|week|month|all)$/i;
const smartMatchLinkPattern = /^match:link:(\d+):([0-9a-f-]{36})$/i;
const smartMatchDismissPattern = /^match:(?:skip|dismiss):([0-9a-f-]{36})$/i;

@Injectable()
export class TelegramUpdateRouterService {
  constructor(
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ConsentService) private readonly consent: ConsentService,
    @Inject(ConsentGuard) private readonly consentGuard: ConsentGuard,
    @Inject(OnboardingService) private readonly onboarding: OnboardingService,
    @Inject(LanguageService) private readonly language: LanguageService,
    @Inject(NavigationMenuService) private readonly navigation: NavigationMenuService,
    @Inject(TextTransactionService) private readonly textTransactions: TextTransactionService,
    @Inject(VoiceQueueService) private readonly voiceQueue: VoiceQueueService,
    @Inject(ReceiptQueueService) private readonly receiptQueue: ReceiptQueueService,
    @Inject(SummaryCommandService) private readonly summaries: SummaryCommandService,
    @Inject(BankBreakdownCommandService)
    private readonly bankBreakdown: BankBreakdownCommandService,
    @Inject(DashboardRepository)
    private readonly dashboardRepository: DashboardRepository,
    @Inject(NotificationSettingsService)
    private readonly notificationSettings: NotificationSettingsService,
    @Inject(DeletionService) private readonly deletion: DeletionService,
    @Inject(AppCodeService) private readonly appCodeService: AppCodeService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CategoryRepository) private readonly categoryRepository: CategoryRepository,
    @Inject(SmsReviewNotificationService)
    private readonly smsReviewNotification: SmsReviewNotificationService,
  ) {}

  async route(update: TelegramUpdate): Promise<boolean> {
    if ('callback_query' in update) {
      await this.users
        .syncVerifiedTelegramProfile(update.callback_query.from.id, {
          firstName: update.callback_query.from.first_name,
          lastName: update.callback_query.from.last_name ?? null,
          username: update.callback_query.from.username ?? null,
        })
        .catch(() => undefined);
      return this.routeCallback(update);
    }
    if (!('message' in update)) return false;

    const telegramId = update.message.from?.id;
    if (telegramId === undefined) return false;
    const chatId = update.message.chat.id;
    const text = update.message.text?.trim();

    if (update.message.from) {
      await this.users
        .syncVerifiedTelegramProfile(telegramId, {
          firstName: update.message.from.first_name,
          lastName: update.message.from.last_name ?? null,
          username: update.message.from.username ?? null,
        })
        .catch(() => undefined);
    }

    if (update.message.chat.type !== 'private') {
      await this.transport.sendMessage(
        chatId,
        this.i18n.translate('privacy.private_only', await this.resolveLocale(telegramId)),
      );
      return false;
    }

    if (text && commandPattern('start').test(text)) {
      await this.onboarding.start(telegramId, chatId, update.update_id);
      return false;
    }
    if (text && commandPattern('language').test(text)) {
      await this.language.prompt(telegramId, chatId);
      return false;
    }
    if (text && commandPattern('help').test(text)) {
      await this.sendHelp(telegramId, chatId);
      return false;
    }
    if (text && commandPattern('mycode').test(text)) {
      await this.handleMyCode(telegramId, chatId);
      return false;
    }
    if (
      text &&
      (commandPattern('deletemydata').test(text) || commandPattern('deletemyaccount').test(text))
    ) {
      return this.deletion.request(telegramId, chatId);
    }

    if (text) {
      const userLocale = await this.resolveLocale(telegramId);
      const replyButtonAction = this.navigation.matchReplyButtonAction(text, userLocale);
      if (replyButtonAction) {
        return this.routeNavigation(replyButtonAction, telegramId, chatId);
      }
    }
    if (text && commandPattern('undo').test(text)) {
      const allowed = await this.consentGuard.canAccess(telegramId);
      if (allowed) await this.textTransactions.requestUndo(telegramId, chatId);
      else
        await this.transport.sendMessage(
          chatId,
          this.i18n.translate('consent.required', await this.resolveLocale(telegramId)),
        );
      return false;
    }
    if (text && commandPattern('settings').test(text)) {
      const allowed = await this.consentGuard.canAccess(telegramId);
      if (allowed) await this.notificationSettings.show(telegramId, chatId);
      else
        await this.transport.sendMessage(
          chatId,
          this.i18n.translate('consent.required', await this.resolveLocale(telegramId)),
        );
      return false;
    }
    if (text && (commandPattern('banks').test(text) || commandPattern('accounts').test(text))) {
      const allowed = await this.consentGuard.canAccess(telegramId);
      if (allowed) await this.bankBreakdown.send(telegramId, chatId, 'month');
      else
        await this.transport.sendMessage(
          chatId,
          this.i18n.translate('consent.required', await this.resolveLocale(telegramId)),
        );
      return false;
    }
    if (text && (commandPattern('pending').test(text) || commandPattern('review').test(text))) {
      const allowed = await this.consentGuard.canAccess(telegramId);
      const user = await this.users.findByTelegramId(telegramId);
      const locale = await this.resolveLocale(telegramId);
      if (allowed && user) {
        await this.smsReviewNotification.sendNextPromptOrSummary(user.id, telegramId, locale);
      } else {
        await this.transport.sendMessage(chatId, this.i18n.translate('consent.required', locale));
      }
      return false;
    }
    const summaryPeriod = this.summaryCommand(text);
    if (summaryPeriod) {
      const allowed = await this.consentGuard.canAccess(telegramId);
      if (allowed) await this.summaries.send(telegramId, chatId, summaryPeriod);
      else
        await this.transport.sendMessage(
          chatId,
          this.i18n.translate('consent.required', await this.resolveLocale(telegramId)),
        );
      return false;
    }

    const locale = await this.resolveLocale(telegramId);
    const allowed = await this.consentGuard.canAccess(telegramId);
    if (allowed) {
      const receipt = this.receiptImage(update.message);
      if (receipt) {
        return this.receiptQueue.enqueue({
          telegramId,
          chatId,
          updateId: update.update_id,
          messageId: update.message.message_id,
          messageAt: new Date(update.message.date * 1_000),
          ...receipt,
        });
      }
    }
    if (allowed && update.message.voice) {
      return this.voiceQueue.enqueue({
        telegramId,
        chatId,
        updateId: update.update_id,
        messageId: update.message.message_id,
        messageAt: new Date(update.message.date * 1_000),
        fileId: update.message.voice.file_id,
        durationSeconds: update.message.voice.duration,
        ...(update.message.voice.file_size === undefined
          ? {}
          : { declaredFileSize: update.message.voice.file_size }),
      });
    }
    if (allowed && text) {
      return this.textTransactions.log({
        telegramId,
        chatId,
        updateId: update.update_id,
        messageId: update.message.message_id,
        messageAt: new Date(update.message.date * 1_000),
        text,
      });
    }
    await this.transport.sendMessage(
      chatId,
      this.i18n.translate(allowed ? 'message.unsupported' : 'consent.required', locale),
    );
    return false;
  }

  private async routeCallback(update: TelegramUpdate): Promise<boolean> {
    if (!('callback_query' in update)) return false;
    const callback = update.callback_query;
    await this.transport.answerCallbackQuery(callback.id);
    const chatId = callback.message?.chat.id;
    if (chatId === undefined) return false;
    if (callback.message?.chat.type !== 'private') {
      await this.transport.sendMessage(
        chatId,
        this.i18n.translate('privacy.private_only', await this.resolveLocale(callback.from.id)),
      );
      return false;
    }

    const deletionAction = parseDeletionCallback(callback.data ?? '');
    if (deletionAction) {
      return this.deletion.handle(
        deletionAction.interactionId,
        deletionAction.action,
        callback.from.id,
        chatId,
        update.update_id,
      );
    }

    const settingsAction = NotificationSettingsService.parseCallback(callback.data ?? '');
    if (settingsAction) {
      const allowed = await this.consentGuard.canAccess(callback.from.id);
      if (allowed) await this.notificationSettings.apply(callback.from.id, chatId, settingsAction);
      else
        await this.transport.sendMessage(
          chatId,
          this.i18n.translate('consent.required', await this.resolveLocale(callback.from.id)),
        );
      return false;
    }

    const consentMatch = consentCallbackPattern.exec(callback.data ?? '');
    if (consentMatch?.[1]) {
      await this.onboarding.accept(consentMatch[1], callback.from.id, chatId);
      return false;
    }

    const consentReviewMatch = consentReviewCallbackPattern.exec(callback.data ?? '');
    if (consentReviewMatch?.[1]) {
      await this.onboarding.reviewConsent(consentReviewMatch[1], callback.from.id, chatId);
      return false;
    }

    const languageMatch = languageCallbackPattern.exec(callback.data ?? '');
    if (languageMatch?.[1] === 'am' || languageMatch?.[1] === 'en') {
      await this.language.change(callback.from.id, chatId, languageMatch[1]);
      return false;
    }

    const navigationAction = NavigationMenuService.parseCallback(callback.data ?? '');
    if (navigationAction) {
      return this.routeNavigation(navigationAction, callback.from.id, chatId);
    }

    const interactionMatch = interactionCallbackPattern.exec(callback.data ?? '');
    if (interactionMatch?.[1] && interactionMatch[2]) {
      return this.textTransactions.handleCallback({
        telegramId: callback.from.id,
        chatId,
        updateId: update.update_id,
        interactionId: interactionMatch[1],
        action: interactionMatch[2].toLowerCase() as
          | 'income'
          | 'expense'
          | 'confirm'
          | 'cancel'
          | 'undo'
          | 'keep'
          | 'work'
          | 'gift'
          | 'loan_in'
          | 'loan_out'
          | 'own_transfer'
          | 'paid_someone'
          | 'paid_me'
          | 'refund'
          | 'reimburse',
      });
    }

    const smsCatMatch = smsCategoryCallbackPattern.exec(callback.data ?? '');
    if (smsCatMatch?.[1] && smsCatMatch[2]) {
      return this.handleSmsCategoryCallback(
        smsCatMatch[1],
        smsCatMatch[2].toLowerCase(),
        callback.from.id,
        chatId,
      );
    }

    const smsDismissMatch = smsDismissCallbackPattern.exec(callback.data ?? '');
    if (smsDismissMatch?.[1]) {
      return this.handleSmsDismissCallback(smsDismissMatch[1], callback.from.id, chatId);
    }

    const summaryPeriodMatch = summaryPeriodCallbackPattern.exec(callback.data ?? '');
    if (summaryPeriodMatch?.[1]) {
      const allowed = await this.consentGuard.canAccess(callback.from.id);
      const user = await this.users.findByTelegramId(callback.from.id);
      if (allowed && user && callback.message?.message_id) {
        await this.summaries.editByUserId(
          user.id,
          chatId,
          callback.message.message_id,
          summaryPeriodMatch[1].toLowerCase() as SummaryPeriodKind,
        );
      } else if (allowed && user) {
        await this.summaries.sendByUserId(
          user.id,
          chatId,
          summaryPeriodMatch[1].toLowerCase() as SummaryPeriodKind,
        );
      }
      return false;
    }

    const matchLink = smartMatchLinkPattern.exec(callback.data ?? '');
    if (matchLink?.[1] && matchLink[2]) {
      return this.handleSmartMatchLink(matchLink[1], matchLink[2], callback.from.id, chatId);
    }

    const matchDismiss = smartMatchDismissPattern.exec(callback.data ?? '');
    if (matchDismiss?.[1]) {
      return this.handleSmartMatchDismiss(matchDismiss[1], callback.from.id, chatId);
    }

    if (callback.data === 'mycode:confirm') {
      const user = await this.users.findByTelegramId(callback.from.id);
      const locale = await this.resolveLocale(callback.from.id);
      if (!user || !this.consent.isActive(user)) {
        await this.transport.sendMessage(chatId, this.i18n.translate('mycode.not_active', locale));
        return false;
      }
      const code = await this.appCodeService.regenerateForUser(user.id);
      const deepLinkBase = this.config.get('FLUTTER_DEEP_LINK_BASE', { infer: true });
      const deepLinkUrl = `${deepLinkBase.replace(/\/$/, '')}/auth?code=${encodeURIComponent(code)}`;
      await this.transport.sendMessage(
        chatId,
        this.i18n.translate('mycode.regenerated', locale, { code }),
        {
          parseMode: 'HTML',
          inlineKeyboard: [[{ text: '🚀 Open Muday App', url: deepLinkUrl }]],
        },
      );
      return false;
    }

    if (callback.data === 'mycode:cancel') {
      const locale = await this.resolveLocale(callback.from.id);
      await this.transport.sendMessage(chatId, this.i18n.translate('mycode.cancelled', locale));
      return false;
    }

    const locale = await this.resolveLocale(callback.from.id);
    await this.transport.sendMessage(chatId, this.i18n.translate('callback.invalid', locale));
    return false;
  }

  private async handleMyCode(telegramId: number, chatId: number): Promise<void> {
    const user = await this.users.findByTelegramId(telegramId);
    const locale = await this.resolveLocale(telegramId);
    if (!user || !this.consent.isActive(user)) {
      await this.transport.sendMessage(chatId, this.i18n.translate('mycode.not_active', locale));
      return;
    }

    await this.transport.sendMessage(chatId, this.i18n.translate('mycode.prompt', locale), {
      inlineKeyboard: [
        [
          {
            text: locale === 'am' ? 'አዎ፣ አዲስ ኮድ አፍልቅ' : 'Yes, generate new code',
            callbackData: 'mycode:confirm',
          },
        ],
        [
          {
            text: locale === 'am' ? 'ይቅር' : 'Cancel',
            callbackData: 'mycode:cancel',
          },
        ],
      ],
    });
  }

  private async sendHelp(telegramId: number, chatId: number): Promise<void> {
    const user = await this.users.findByTelegramId(telegramId);
    const locale = user?.language === 'EN' ? 'en' : 'am';
    const active = this.consent.isActive(user);
    await this.transport.sendMessage(
      chatId,
      this.i18n.translate(active ? 'help.active' : 'help.pending', locale),
      active
        ? {
            replyKeyboard: this.navigation.replyKeyboard(locale),
          }
        : undefined,
    );
  }

  private async routeNavigation(
    action: NavigationAction,
    telegramId: number,
    chatId: number,
  ): Promise<boolean> {
    if (action === 'language') {
      await this.language.prompt(telegramId, chatId);
      return false;
    }
    if (action === 'help') {
      await this.sendHelp(telegramId, chatId);
      return false;
    }

    const allowed = await this.consentGuard.canAccess(telegramId);
    if (!allowed) {
      await this.transport.sendMessage(
        chatId,
        this.i18n.translate('consent.required', await this.resolveLocale(telegramId)),
      );
      return false;
    }

    if (action === 'today' || action === 'week' || action === 'month') {
      await this.summaries.send(telegramId, chatId, action);
    } else if (action === 'settings') {
      await this.notificationSettings.show(telegramId, chatId);
    } else if (action === 'undo') {
      await this.textTransactions.requestUndo(telegramId, chatId);
    }
    return false;
  }

  private async resolveLocale(telegramId: number): Promise<Locale> {
    const user = await this.users.findByTelegramId(telegramId);
    return user?.language === 'EN' ? 'en' : 'am';
  }

  private summaryCommand(text?: string): SummaryPeriodKind | null {
    if (!text) return null;
    if (commandPattern('today').test(text)) return 'today';
    if (commandPattern('week').test(text)) return 'week';
    if (commandPattern('month').test(text)) return 'month';
    if (commandPattern('summary').test(text)) return 'month';
    if (commandPattern('all').test(text)) return 'all';
    return null;
  }

  private receiptImage(message: Message): {
    fileId: string;
    mimeType: ReceiptMimeType;
    declaredFileSize?: number;
  } | null {
    const photo = message.photo?.at(-1);
    if (photo) {
      return {
        fileId: photo.file_id,
        mimeType: 'image/jpeg',
        ...(photo.file_size === undefined ? {} : { declaredFileSize: photo.file_size }),
      };
    }
    const document = message.document;
    if (!document) return null;
    const mimeType = document.mime_type;
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') {
      return null;
    }
    return {
      fileId: document.file_id,
      mimeType,
      ...(document.file_size === undefined ? {} : { declaredFileSize: document.file_size }),
    };
  }

  private async handleSmsCategoryCallback(
    draftId: string,
    category: string,
    telegramUserId: number,
    chatId: number,
  ): Promise<boolean> {
    const user = await this.users.findByTelegramId(telegramUserId);
    const locale = await this.resolveLocale(telegramUserId);
    if (!user || !this.consent.isActive(user)) {
      await this.transport.sendMessage(chatId, this.i18n.translate('consent.required', locale));
      return false;
    }

    const interaction = await this.prisma.pendingInteraction.findFirst({
      where: { id: draftId, userId: user.id },
    });

    if (!interaction) {
      await this.transport.sendMessage(
        chatId,
        locale === 'am' ? 'ይህ ረቂቅ አልተገኘም ወይም ተሰርዟል።' : 'This draft was not found or deleted.',
      );
      return false;
    }

    if (interaction.state !== 'PENDING') {
      // Scenario 4: Already categorized on mobile app!
      await this.transport.sendMessage(
        chatId,
        locale === 'am'
          ? 'ይህ ግብይት አስቀድሞ በሞባይል መተግበሪያ ተመድቧል 👍'
          : 'This transaction was already categorized on the mobile app 👍',
      );
      await this.smsReviewNotification.sendNextPromptOrSummary(user.id, telegramUserId, locale);
      return false;
    }

    const payload = interaction.payload as unknown as BankSmsDraftPayload;
    const rawAmount = Number(payload?.amount || 0);
    const type =
      (payload?.type || 'expense').toUpperCase() === 'INCOME'
        ? TransactionType.INCOME
        : TransactionType.EXPENSE;
    const kind =
      type === TransactionType.INCOME ? FinancialEventKind.INCOME : FinancialEventKind.EXPENSE;
    const occurredAt = payload?.occurredAt ? new Date(payload.occurredAt) : interaction.createdAt;
    const note = payload?.note || (payload?.bankSource ? `From ${payload.bankSource} SMS` : null);

    const telegramMessageId = BigInt(Math.floor(Date.now() * 1000 + Math.random() * 1000));
    const telegramUpdateId = BigInt(0);

    await this.prisma.$transaction(async (db) => {
      const claimed = await db.pendingInteraction.updateMany({
        where: { id: draftId, state: 'PENDING' },
        data: { state: 'RESOLVED', resolvedAt: new Date() },
      });

      if (claimed.count !== 1) {
        throw new Error('Draft already resolved');
      }

      const group = await db.transactionGroup.create({
        data: {
          userId: user.id,
          telegramUpdateId,
          telegramMessageId,
          source: TransactionSource.TEXT,
          messageAt: occurredAt,
          rawTranscript: payload?.smsId
            ? `SMS:${payload?.bankSource || 'BANK'}:${payload?.smsId}`
            : `BANK_SMS:${payload?.bankSource || 'BANK'}`,
          extractionModel: 'BANK_SMS_PARSER',
          promptVersion: '1.0',
        },
      });

      await db.transaction.create({
        data: {
          groupId: group.id,
          userId: user.id,
          type,
          kind,
          amountEtb: new Prisma.Decimal(rawAmount.toFixed(2)),
          category,
          note: note ? note.slice(0, 500) : null,
          occurredAt,
        },
      });
    });

    // Upsert and increment category usage
    await this.categoryRepository.upsertAndIncrement(user.id, category, type.toLowerCase());

    const catLabel = category.charAt(0).toUpperCase() + category.slice(1);
    const ack =
      locale === 'am'
        ? `✅ ${rawAmount.toFixed(2)} ብር ወደ "${catLabel}" ተመድቧል።`
        : `✅ ${rawAmount.toFixed(2)} ETB saved under "${catLabel}".`;
    await this.transport.sendMessage(chatId, ack);

    // Prompt next draft or send completion summary
    await this.smsReviewNotification.sendNextPromptOrSummary(user.id, telegramUserId, locale);
    return true;
  }

  private async handleSmsDismissCallback(
    draftId: string,
    telegramUserId: number,
    chatId: number,
  ): Promise<boolean> {
    const user = await this.users.findByTelegramId(telegramUserId);
    const locale = await this.resolveLocale(telegramUserId);
    if (!user || !this.consent.isActive(user)) {
      await this.transport.sendMessage(chatId, this.i18n.translate('consent.required', locale));
      return false;
    }

    await this.prisma.pendingInteraction.updateMany({
      where: { id: draftId, userId: user.id, state: 'PENDING' },
      data: { state: 'CANCELLED', resolvedAt: new Date() },
    });

    const ack = locale === 'am' ? '🗑️ ረቂቁ ተዘሏል/ተሰርዟል።' : '🗑️ Draft dismissed.';
    await this.transport.sendMessage(chatId, ack);

    await this.smsReviewNotification.sendNextPromptOrSummary(user.id, telegramUserId, locale);
    return true;
  }

  private async handleSmartMatchLink(
    candidateIndexStr: string,
    interactionId: string,
    telegramUserId: number,
    chatId: number,
  ): Promise<boolean> {
    const candidateIndex = parseInt(candidateIndexStr, 10) || 0;
    const user = await this.users.findByTelegramId(telegramUserId);
    const locale = await this.resolveLocale(telegramUserId);
    if (!user || !this.consent.isActive(user)) {
      await this.transport.sendMessage(chatId, this.i18n.translate('consent.required', locale));
      return false;
    }

    const interaction = await this.prisma.pendingInteraction.findFirst({
      where: { id: interactionId, userId: user.id, state: 'PENDING' },
    });

    if (!interaction) {
      await this.transport.sendMessage(
        chatId,
        locale === 'am' ? 'ይህ ግብይት ቀደም ሲል ተፈጽሟል።' : 'This transaction has already been resolved.',
      );
      return false;
    }

    const parsed = smartMatchConfirmationPayloadSchema.safeParse(interaction.payload);
    if (!parsed.success) {
      return false;
    }

    const targetCandidate = parsed.data.candidates[candidateIndex] ?? parsed.data.candidates[0];
    if (!targetCandidate) {
      return false;
    }

    const tx = parsed.data.transactions[0];
    const category = tx?.category || 'other';
    const note = tx?.note ?? null;
    const type: 'expense' | 'income' =
      tx && 'type' in tx && tx.type === 'income' ? 'income' : 'expense';

    const linked = await this.dashboardRepository.linkCandidate(user.id, {
      targetId: targetCandidate.id,
      targetType: targetCandidate.targetType,
      category,
      type,
      ...(note ? { note } : {}),
    });

    await this.prisma.pendingInteraction.update({
      where: { id: interactionId },
      data: { state: 'RESOLVED', resolvedAt: new Date() },
    });

    if (!linked) {
      await this.transport.sendMessage(
        chatId,
        locale === 'am' ? 'ይህ ግብይት ቀደም ሲል ተፈጽሟል።' : 'This transaction has already been resolved.',
      );
      return false;
    }

    const bank = targetCandidate.bankSource ?? 'Bank';
    await this.transport.sendMessage(
      chatId,
      this.i18n.translate('smart_match.linked', locale, { bank }),
    );
    return true;
  }

  private async handleSmartMatchDismiss(
    interactionId: string,
    telegramUserId: number,
    chatId: number,
  ): Promise<boolean> {
    const user = await this.users.findByTelegramId(telegramUserId);
    const locale = await this.resolveLocale(telegramUserId);
    if (!user || !this.consent.isActive(user)) {
      await this.transport.sendMessage(chatId, this.i18n.translate('consent.required', locale));
      return false;
    }

    const saved = await this.textTransactions.persistConfirmedSmartMatch(
      telegramUserId,
      chatId,
      0,
      interactionId,
    );

    if (!saved) {
      await this.transport.sendMessage(
        chatId,
        this.i18n.translate('smart_match.dismissed', locale),
      );
    }
    return true;
  }
}
