import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExtractedTransaction, ExtractionResult } from '@mezgeb/contracts';

import type { Environment } from '../config/environment.js';
import { DashboardRepository } from '../dashboard/dashboard.repository.js';
import type { MatchCandidateItemDto } from '../dashboard/dashboard.dto.js';
import { ExtractionError } from '../extraction/extraction.error.js';
import type { FinancialEventClassification } from '../extraction/financial-event-classification.schema.js';
import {
  TRANSACTION_EXTRACTOR,
  type TransactionExtractor,
} from '../extraction/transaction-extractor.interface.js';
import { TextNormalizerService } from '../extraction/text-normalizer.service.js';
import { amCatalog } from '../i18n/catalogs/am.js';
import { enCatalog } from '../i18n/catalogs/en.js';
import { I18nService, type Locale } from '../i18n/i18n.service.js';
import type { MessageKey } from '../i18n/message-key.js';
import { InteractionRepository } from '../interactions/interaction.repository.js';
import type {
  InteractionPayload,
  TransactionCandidate,
} from '../interactions/interaction-payload.schema.js';
import { MoneyValidationError } from '../money/money.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';
import { TextLogRateLimiter } from '../rate-limit/text-log-rate-limiter.service.js';
import {
  TELEGRAM_TRANSPORT,
  type TelegramInlineButton,
  type TelegramTransport,
} from '../telegram/transport/telegram-transport.interface.js';
import { ReceiptMediaService } from '../receipt/receipt-media.service.js';
import { UsersService } from '../users/users.service.js';
import { ClarificationCandidateService } from './clarification-candidate.service.js';
import {
  FinancialEventValidationService,
  type ValidatedFinancialEvent,
} from './financial-event-validation.service.js';
import { TransactionRepository, type PersistableTransaction } from './transaction.repository.js';
import {
  TransactionValidationError,
  TransactionValidationService,
} from './transaction-validation.service.js';

export interface TextLogInput {
  telegramId: number;
  chatId: number;
  updateId: number;
  messageId: number;
  messageAt: Date;
  text: string;
  source?: 'text' | 'voice' | 'receipt';
  sttProvider?: string;
  sttModel?: string;
}

export interface DirectExtractionLogInput extends Omit<TextLogInput, 'text' | 'source'> {
  extractionModel: string;
  promptVersion: string;
  telegramFileId?: string;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  rawTranscript?: string;
}

export interface InteractionCallbackInput {
  telegramId: number;
  chatId: number;
  updateId: number;
  interactionId: string;
  action:
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
    | 'reimburse';
}

@Injectable()
export class TextTransactionService {
  private readonly maxCharacters: number;

  constructor(
    @Inject(TRANSACTION_EXTRACTOR) private readonly extractor: TransactionExtractor,
    @Inject(TransactionValidationService) private readonly validator: TransactionValidationService,
    @Inject(FinancialEventValidationService)
    private readonly financialValidator: FinancialEventValidationService,
    @Inject(TransactionRepository) private readonly transactions: TransactionRepository,
    @Inject(InteractionRepository) private readonly interactions: InteractionRepository,
    @Inject(ClarificationCandidateService)
    private readonly clarificationCandidates: ClarificationCandidateService,
    @Inject(TextNormalizerService) private readonly normalizer: TextNormalizerService,
    @Inject(TextLogRateLimiter) private readonly rateLimiter: TextLogRateLimiter,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(I18nService) private readonly i18n: I18nService,
    @Inject(TELEGRAM_TRANSPORT) private readonly transport: TelegramTransport,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Optional()
    @Inject(DashboardRepository)
    private readonly dashboardRepository?: DashboardRepository,
    @Optional()
    @Inject(ReceiptMediaService)
    private readonly receiptMedia?: ReceiptMediaService,
  ) {
    this.maxCharacters = config.get('MAX_MESSAGE_CHARACTERS', { infer: true });
  }

  async log(input: TextLogInput): Promise<boolean> {
    return this.logInternal(input, false);
  }

  logVoiceTranscript(input: TextLogInput): Promise<boolean> {
    return this.logInternal({ ...input, source: 'voice' }, true);
  }

  async logDirectVoiceExtraction(
    input: DirectExtractionLogInput,
    extracted: ExtractionResult,
  ): Promise<boolean> {
    const context = await this.userContext(input.telegramId);
    if (!context) {
      await this.send(input.chatId, 'consent.required', 'am');
      return false;
    }
    const voiceInput: TextLogInput = {
      telegramId: input.telegramId,
      chatId: input.chatId,
      updateId: input.updateId,
      messageId: input.messageId,
      messageAt: input.messageAt,
      text: '',
      source: 'voice',
      sttProvider: 'gemini-direct',
      sttModel: input.extractionModel,
    };
    try {
      try {
        const transactions = this.validator.validate(extracted);
        return await this.persistAndConfirm(
          voiceInput,
          context,
          transactions,
          undefined,
          input.updateId,
          false,
          input.extractionModel,
          input.promptVersion,
        );
      } catch (error) {
        if (error instanceof TransactionValidationError && error.code === 'high_value') {
          const transactions = this.validator.validate(extracted, true);
          await this.requestLargeConfirmation(voiceInput, context, transactions);
          return false;
        }
        throw error;
      }
    } catch (error) {
      const key = this.errorMessageKey(error);
      if (key) {
        if (error instanceof ExtractionError && error.code === 'invalid_output') {
          await this.interactions.recordInvalidOutput(context.userId, 'voice');
        }
        await this.send(input.chatId, key, context.locale);
        return false;
      }
      throw error;
    }
  }

  async logDirectVoiceClassification(
    input: DirectExtractionLogInput,
    classification: FinancialEventClassification,
  ): Promise<boolean> {
    const context = await this.userContext(input.telegramId);
    if (!context) {
      await this.send(input.chatId, 'consent.required', 'am');
      return false;
    }
    return this.handleClassification(
      {
        telegramId: input.telegramId,
        chatId: input.chatId,
        updateId: input.updateId,
        messageId: input.messageId,
        messageAt: input.messageAt,
        text: '',
        source: 'voice',
        sttProvider: 'gemini-direct',
        sttModel: input.extractionModel,
      },
      context,
      classification,
      input.extractionModel,
      input.promptVersion,
    );
  }

  async requestReceiptConfirmation(
    input: DirectExtractionLogInput,
    extracted: ExtractionResult,
  ): Promise<boolean> {
    const context = await this.userContext(input.telegramId);
    if (!context) return false;
    try {
      if (extracted.transactions.length !== 1) {
        await this.send(input.chatId, 'receipt.unclear', context.locale);
        return false;
      }
      const transactions = this.validator.validate(extracted, true);
      if (transactions[0]?.type !== 'expense') {
        await this.send(input.chatId, 'receipt.unclear', context.locale);
        return false;
      }
      const interaction = await this.interactions.create(context.userId, 'CONFIRM_RECEIPT', {
        kind: 'confirm_receipt',
        sourceUpdateId: input.updateId,
        sourceMessageId: input.messageId,
        messageAt: input.messageAt.toISOString(),
        model: input.extractionModel,
        promptVersion: input.promptVersion,
        source: 'receipt',
        ...(input.telegramFileId ? { telegramFileId: input.telegramFileId } : {}),
        ...(input.mimeType ? { mimeType: input.mimeType } : {}),
        rawTranscript: this.formatLines(transactions, context.locale),
        transactions,
      });
      await this.transport.sendMessage(
        input.chatId,
        this.i18n.translate('receipt.confirm', context.locale, {
          transactions: this.formatLines(transactions, context.locale),
        }),
        { inlineKeyboard: this.buttons(interaction.id, context.locale, 'confirm') },
      );
      return false;
    } catch (error) {
      if (error instanceof TransactionValidationError || error instanceof MoneyValidationError) {
        await this.send(input.chatId, 'receipt.unclear', context.locale);
        return false;
      }
      throw error;
    }
  }

  async requestReceiptClassification(
    input: DirectExtractionLogInput,
    classification: FinancialEventClassification,
  ): Promise<boolean> {
    const context = await this.userContext(input.telegramId);
    if (!context) return false;
    const validated = this.financialValidator.validate(classification, true);
    if (
      validated.needsClarification ||
      validated.transfers > 0 ||
      validated.ready.length !== 1 ||
      !['expense', 'refund'].includes(validated.ready[0]?.kind ?? '')
    ) {
      await this.send(input.chatId, 'receipt.unclear', context.locale);
      return false;
    }
    const interaction = await this.interactions.create(context.userId, 'CONFIRM_RECEIPT', {
      kind: 'confirm_receipt',
      sourceUpdateId: input.updateId,
      sourceMessageId: input.messageId,
      messageAt: input.messageAt.toISOString(),
      model: input.extractionModel,
      promptVersion: input.promptVersion,
      source: 'receipt',
      ...(input.telegramFileId ? { telegramFileId: input.telegramFileId } : {}),
      ...(input.mimeType ? { mimeType: input.mimeType } : {}),
      rawTranscript: this.formatLines(validated.ready, context.locale),
      transactions: validated.ready,
    });
    await this.transport.sendMessage(
      input.chatId,
      this.i18n.translate('receipt.confirm', context.locale, {
        transactions: this.formatLines(validated.ready, context.locale),
      }),
      { inlineKeyboard: this.buttons(interaction.id, context.locale, 'confirm') },
    );
    return false;
  }

  private async logInternal(input: TextLogInput, skipRateLimit: boolean): Promise<boolean> {
    const context = await this.userContext(input.telegramId);
    if (!context) {
      await this.send(input.chatId, 'consent.required', 'am');
      return false;
    }
    if (input.text.length > this.maxCharacters) {
      await this.send(input.chatId, 'transaction.input_too_long', context.locale);
      return false;
    }
    if (!skipRateLimit && !(await this.rateLimiter.allowed(context.userId))) {
      await this.send(input.chatId, 'transaction.rate_limited', context.locale);
      return false;
    }

    const pending = await this.interactions.findPendingForUser(context.userId);
    if (pending?.payload.kind === 'clarify_amount') {
      return this.resolveAmount(input, context, pending.id, pending.payload);
    }

    try {
      if (this.extractor.classify) {
        const classification = await this.extractor.classify(
          { text: input.text, locale: context.locale },
          context.userId,
        );
        return await this.handleClassification(input, context, classification);
      }
      const extracted = await this.extractor.extract({ text: input.text, locale: context.locale });
      try {
        const transactions = this.validator.validate(extracted);
        return await this.persistAndConfirm(input, context, transactions);
      } catch (error) {
        if (error instanceof TransactionValidationError && error.code === 'high_value') {
          const transactions = this.validator.validate(extracted, true);
          await this.requestLargeConfirmation(input, context, transactions);
          return false;
        }
        throw error;
      }
    } catch (error) {
      if (
        error instanceof ExtractionError &&
        (error.code === 'amount_missing' || error.code === 'ambiguous')
      ) {
        const requested = await this.requestClarification(input, context, error.code);
        if (requested) return false;
      }
      const key = this.errorMessageKey(error);
      if (key) {
        if (error instanceof ExtractionError && error.code === 'invalid_output') {
          await this.interactions.recordInvalidOutput(context.userId, input.source ?? 'text');
        }
        await this.send(input.chatId, key, context.locale);
        return false;
      }
      throw error;
    }
  }

  private async handleClassification(
    input: TextLogInput,
    context: UserContext,
    classification: FinancialEventClassification,
    model = this.extractor.model,
    promptVersion = this.extractor.promptVersion,
  ): Promise<boolean> {
    try {
      const validated = this.financialValidator.validate(classification);
      if (validated.needsClarification) {
        await this.requestFinancialClarification(input, context, classification, validated.ready);
        return false;
      }
      if (validated.transfers > 0) {
        await this.interactions.recordTransferRejected(
          context.userId,
          input.source ?? 'text',
          validated.transfers,
        );
        await this.send(input.chatId, 'transaction.transfer_ignored', context.locale);
      }
      if (validated.ready.length === 0) return false;
      return this.persistAndConfirm(
        input,
        context,
        validated.ready,
        undefined,
        input.updateId,
        false,
        model,
        promptVersion,
      );
    } catch (error) {
      if (error instanceof TransactionValidationError && error.code === 'high_value') {
        const validated = this.financialValidator.validate(classification, true);
        if (validated.needsClarification) {
          await this.requestFinancialClarification(input, context, classification, validated.ready);
          return false;
        }
        if (validated.transfers > 0) {
          await this.interactions.recordTransferRejected(
            context.userId,
            input.source ?? 'text',
            validated.transfers,
          );
          await this.send(input.chatId, 'transaction.transfer_ignored', context.locale);
        }
        if (validated.ready.length > 0) {
          await this.requestLargeConfirmation(input, context, validated.ready);
        }
        return false;
      }
      throw error;
    }
  }

  async requestUndo(telegramId: number, chatId: number): Promise<void> {
    const context = await this.userContext(telegramId);
    if (!context) {
      await this.send(chatId, 'consent.required', 'am');
      return;
    }
    const latest = await this.transactions.latestActiveGroup(context.userId);
    if (!latest) {
      await this.send(chatId, 'undo.none', context.locale);
      return;
    }
    const interaction = await this.interactions.create(
      context.userId,
      'CONFIRM_UNDO',
      { kind: 'confirm_undo', groupId: latest.groupId },
      10,
    );
    await this.transport.sendMessage(
      chatId,
      this.i18n.translate('undo.preview', context.locale, {
        transactions: this.formatLines(latest.transactions, context.locale),
      }),
      { inlineKeyboard: this.buttons(interaction.id, context.locale, 'undo') },
    );
  }

  async handleCallback(input: InteractionCallbackInput): Promise<boolean> {
    const context = await this.userContext(input.telegramId);
    if (!context) return false;
    const interaction = await this.interactions.findPending(input.interactionId, context.userId);
    if (!interaction) {
      await this.send(input.chatId, 'interaction.expired_or_used', context.locale);
      return false;
    }
    if (input.action === 'cancel' || input.action === 'keep') {
      await this.interactions.cancel(interaction.id, context.userId);
      if (input.action === 'cancel' && 'source' in interaction.payload) {
        const confirmation =
          interaction.payload.kind === 'confirm_receipt'
            ? 'receipt'
            : interaction.payload.kind === 'confirm_large_amount'
              ? 'large_amount'
              : interaction.payload.kind === 'confirm_financial'
                ? 'financial'
                : null;
        if (confirmation) {
          await this.interactions.recordConfirmationCancelled(
            context.userId,
            interaction.payload.source,
            confirmation,
          );
        }
      }
      await this.send(input.chatId, 'interaction.cancelled', context.locale);
      return false;
    }

    if (
      (interaction.payload.kind === 'confirm_large_amount' ||
        interaction.payload.kind === 'confirm_financial' ||
        interaction.payload.kind === 'confirm_receipt') &&
      input.action === 'confirm'
    ) {
      const transactions = this.validateStoredCandidates(interaction.payload.transactions);
      return this.persistStored(input, context, interaction.id, interaction.payload, transactions);
    }
    if (interaction.payload.kind === 'clarify_financial') {
      return this.resolveFinancialClarification(
        input,
        context,
        interaction.id,
        interaction.payload,
      );
    }
    if (
      interaction.payload.kind === 'clarify_type' &&
      (input.action === 'income' || input.action === 'expense')
    ) {
      const candidate =
        input.action === 'income'
          ? interaction.payload.incomeCandidate
          : interaction.payload.expenseCandidate;
      const transactions = this.validator.validate({ transactions: [candidate] });
      return this.persistStored(
        input,
        context,
        interaction.id,
        interaction.payload,
        transactions,
        true,
      );
    }
    if (interaction.payload.kind === 'confirm_undo' && input.action === 'undo') {
      try {
        await this.transactions.undo(
          context.userId,
          interaction.payload.groupId,
          interaction.id,
          input.updateId,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          ['INTERACTION_NOT_PENDING', 'GROUP_NOT_ACTIVE'].includes(error.message)
        ) {
          await this.send(input.chatId, 'interaction.expired_or_used', context.locale);
          return false;
        }
        throw error;
      }
      await this.send(input.chatId, 'undo.completed', context.locale);
      return true;
    }
    await this.send(input.chatId, 'callback.invalid', context.locale);
    return false;
  }

  private async requestClarification(
    input: TextLogInput,
    context: UserContext,
    code: 'amount_missing' | 'ambiguous',
  ): Promise<boolean> {
    const inferred = this.clarificationCandidates.infer(input.text);
    if (!inferred) return false;
    const source = this.sourcePayload(input);
    if (code === 'amount_missing') {
      const interaction = await this.interactions.create(context.userId, 'CLARIFY_AMOUNT', {
        kind: 'clarify_amount',
        ...source,
        type: inferred.type,
        category: inferred.category,
        ...(inferred.note ? { note: inferred.note } : {}),
        clarificationCount: 1,
      });
      await this.transport.sendMessage(
        input.chatId,
        this.i18n.translate('clarification.amount', context.locale, {
          category: this.category(inferred.category),
        }),
        { inlineKeyboard: this.buttons(interaction.id, context.locale, 'cancel') },
      );
      return true;
    }
    if (!inferred.amount) return false;
    const base = {
      amount: inferred.amount,
      currency: 'ETB' as const,
      note: inferred.note,
      confidence: 0.95,
    };
    const incomeCandidate: TransactionCandidate = {
      ...base,
      type: 'income',
      category: ['salary', 'business', 'remittance', 'other_income'].includes(inferred.category)
        ? inferred.category
        : 'other_income',
    };
    const expenseCandidate: TransactionCandidate = {
      ...base,
      type: 'expense',
      category: ['salary', 'business', 'remittance', 'other_income'].includes(inferred.category)
        ? 'other'
        : inferred.category,
    };
    const interaction = await this.interactions.create(context.userId, 'CLARIFY_TYPE', {
      kind: 'clarify_type',
      ...source,
      incomeCandidate,
      expenseCandidate,
      clarificationCount: 1,
    });
    await this.transport.sendMessage(
      input.chatId,
      this.i18n.translate('clarification.type', context.locale),
      { inlineKeyboard: this.buttons(interaction.id, context.locale, 'type') },
    );
    return true;
  }

  private async requestFinancialClarification(
    input: TextLogInput,
    context: UserContext,
    classification: FinancialEventClassification,
    readyTransactions: ValidatedFinancialEvent[],
  ): Promise<void> {
    const unclear = classification.transactions.find(
      (event) => event.status === 'needs_clarification',
    );
    if (!unclear || unclear.clarificationReason === null) {
      await this.send(input.chatId, 'transaction.classification_clarification', context.locale);
      return;
    }
    if (
      unclear.clarificationReason === 'amount_missing' ||
      unclear.clarificationReason === 'principal_interest_split'
    ) {
      await this.send(
        input.chatId,
        unclear.clarificationReason === 'amount_missing'
          ? 'transaction.amount_missing'
          : 'clarification.principal_interest',
        context.locale,
      );
      return;
    }
    if (unclear.amount === null) {
      await this.send(input.chatId, 'transaction.classification_clarification', context.locale);
      return;
    }
    const interaction = await this.interactions.create(context.userId, 'CLARIFY_FINANCIAL', {
      kind: 'clarify_financial',
      ...this.sourcePayload(input),
      event: {
        amount: unclear.amount,
        currency: 'ETB',
        ...(unclear.note ? { note: unclear.note } : {}),
        confidence: unclear.confidence,
        clarificationReason: unclear.clarificationReason,
      },
      readyTransactions,
      ignoredTransferCount: classification.transactions.filter(
        (event) => event.status === 'unsupported',
      ).length,
      clarificationCount: 1,
    });
    const questionKey =
      unclear.clarificationReason === 'ownership' ||
      unclear.clarificationReason === 'money_direction'
        ? 'clarification.financial_ownership'
        : 'clarification.financial_purpose';
    await this.transport.sendMessage(
      input.chatId,
      this.i18n.translate(questionKey, context.locale),
      {
        inlineKeyboard: this.financialClarificationButtons(
          interaction.id,
          context.locale,
          unclear.clarificationReason,
        ),
      },
    );
  }

  private async resolveFinancialClarification(
    input: InteractionCallbackInput,
    context: UserContext,
    interactionId: string,
    payload: Extract<InteractionPayload, { kind: 'clarify_financial' }>,
  ): Promise<boolean> {
    if (input.action === 'cancel') {
      await this.interactions.cancel(interactionId, context.userId);
      await this.send(input.chatId, 'interaction.cancelled', context.locale);
      return false;
    }
    if (input.action === 'own_transfer') {
      await this.send(input.chatId, 'transaction.transfer_ignored', context.locale);
      if (payload.readyTransactions.length === 0) {
        await this.interactions.cancel(interactionId, context.userId);
        return false;
      }
      const checked = this.validateFinancialCandidates(payload.readyTransactions, true);
      await this.interactions.cancel(interactionId, context.userId);
      await this.requestFinancialConfirmation(payload, input.chatId, context, checked);
      return false;
    }
    const candidate = this.financialCandidateFromAction(payload.event, input.action);
    if (!candidate) {
      await this.send(input.chatId, 'callback.invalid', context.locale);
      return false;
    }
    const transactions = [...payload.readyTransactions, candidate];
    try {
      const checked = this.validateFinancialCandidates(transactions);
      if (payload.ignoredTransferCount > 0) {
        await this.send(input.chatId, 'transaction.transfer_ignored', context.locale);
      }
      await this.interactions.cancel(interactionId, context.userId);
      await this.requestFinancialConfirmation(payload, input.chatId, context, checked);
      return false;
    } catch (error) {
      if (error instanceof TransactionValidationError && error.code === 'high_value') {
        await this.interactions.cancel(interactionId, context.userId);
        const checked = this.validateFinancialCandidates(transactions, true);
        await this.requestLargeConfirmation(
          {
            telegramId: input.telegramId,
            chatId: input.chatId,
            updateId: payload.sourceUpdateId,
            messageId: payload.sourceMessageId,
            messageAt: new Date(payload.messageAt),
            text: '',
            source: payload.source,
          },
          context,
          checked,
        );
        return false;
      }
      throw error;
    }
  }

  private async resolveAmount(
    input: TextLogInput,
    context: UserContext,
    interactionId: string,
    payload: Extract<InteractionPayload, { kind: 'clarify_amount' }>,
  ): Promise<boolean> {
    const normalized = this.normalizer.normalize(input.text);
    if (/\b(?:usd|dollar|eur|euro|gbp|pound)\b|[$€£]/i.test(normalized)) {
      await this.interactions.failClarification(interactionId, context.userId);
      await this.send(input.chatId, 'clarification.failed', context.locale);
      return false;
    }
    const amount = /(?:^|\s)(\d+(?:\.\d{1,2})?)(?=\s|$)/.exec(normalized)?.[1];
    if (!amount) {
      await this.interactions.failClarification(interactionId, context.userId);
      await this.send(input.chatId, 'clarification.failed', context.locale);
      return false;
    }
    const candidate: ExtractedTransaction = {
      type: payload.type,
      amount,
      currency: 'ETB',
      category: payload.category,
      ...(payload.note ? { note: payload.note } : {}),
      confidence: 0.95,
    };
    try {
      const transactions = this.validator.validate({ transactions: [candidate] });
      return this.persistStored(input, context, interactionId, payload, transactions, true);
    } catch (error) {
      if (error instanceof TransactionValidationError && error.code === 'high_value') {
        await this.interactions.cancel(interactionId, context.userId);
        await this.requestLargeConfirmation(
          {
            ...input,
            updateId: payload.sourceUpdateId,
            messageId: payload.sourceMessageId,
            messageAt: new Date(payload.messageAt),
          },
          context,
          this.validator.validate({ transactions: [candidate] }, true),
        );
        return false;
      }
      await this.interactions.failClarification(interactionId, context.userId);
      await this.send(input.chatId, 'clarification.failed', context.locale);
      return false;
    }
  }

  private async requestLargeConfirmation(
    input: TextLogInput,
    context: UserContext,
    transactions: PersistableTransaction[],
  ): Promise<void> {
    const interaction = await this.interactions.create(context.userId, 'CONFIRM_LARGE_AMOUNT', {
      kind: 'confirm_large_amount',
      ...this.sourcePayload(input),
      transactions,
    });
    await this.transport.sendMessage(
      input.chatId,
      this.i18n.translate('transaction.high_value_confirm', context.locale, {
        transactions: this.formatLines(transactions, context.locale),
      }),
      { inlineKeyboard: this.buttons(interaction.id, context.locale, 'confirm') },
    );
  }

  private async requestFinancialConfirmation(
    source: Extract<InteractionPayload, { kind: 'clarify_financial' }>,
    chatId: number,
    context: UserContext,
    transactions: ValidatedFinancialEvent[],
  ): Promise<void> {
    const interaction = await this.interactions.create(context.userId, 'CONFIRM_FINANCIAL', {
      kind: 'confirm_financial',
      sourceUpdateId: source.sourceUpdateId,
      sourceMessageId: source.sourceMessageId,
      messageAt: source.messageAt,
      model: source.model,
      promptVersion: source.promptVersion,
      source: source.source,
      ...(source.sttProvider ? { sttProvider: source.sttProvider } : {}),
      ...(source.sttModel ? { sttModel: source.sttModel } : {}),
      transactions,
      clarificationResolved: true,
    });
    const effects = [...new Set(transactions.map(({ kind }) => kind))]
      .filter((kind) => !['income', 'expense'].includes(kind))
      .map((kind) =>
        this.i18n.translate(`transaction.effect.${kind}` as MessageKey, context.locale),
      )
      .join('\n');
    await this.transport.sendMessage(
      chatId,
      this.i18n.translate('transaction.financial_confirm', context.locale, {
        transactions: this.formatLines(transactions, context.locale),
        effects,
      }),
      { inlineKeyboard: this.buttons(interaction.id, context.locale, 'confirm') },
    );
  }

  private async persistStored(
    input: Pick<InteractionCallbackInput, 'chatId' | 'updateId'> | TextLogInput,
    context: UserContext,
    interactionId: string,
    payload: Extract<InteractionPayload, { sourceUpdateId: number }>,
    transactions: PersistableTransaction[],
    clarificationResolved = false,
  ): Promise<boolean> {
    let receiptImagePath: string | undefined;
    if (
      payload.source === 'receipt' &&
      'telegramFileId' in payload &&
      payload.telegramFileId &&
      this.receiptMedia
    ) {
      try {
        const mime = ('mimeType' in payload && payload.mimeType) || 'image/jpeg';
        const groupId = crypto.randomUUID();
        receiptImagePath = await this.receiptMedia.persistReceipt(
          payload.telegramFileId,
          mime,
          context.userId,
          groupId,
        );
      } catch (err) {
        this.logger.error('Failed to persist receipt image on confirmation', {
          exceptionType: err instanceof Error ? err.name : typeof err,
        });
      }
    }
    const rawTranscript =
      'rawTranscript' in payload && typeof payload.rawTranscript === 'string'
        ? payload.rawTranscript
        : '';

    return this.persistAndConfirm(
      {
        telegramId: 0,
        chatId: input.chatId,
        updateId: input.updateId,
        messageId: payload.sourceMessageId,
        messageAt: new Date(payload.messageAt),
        text: rawTranscript,
        source: payload.source,
        ...(payload.sttProvider ? { sttProvider: payload.sttProvider } : {}),
        ...(payload.sttModel ? { sttModel: payload.sttModel } : {}),
      },
      context,
      transactions,
      interactionId,
      payload.sourceUpdateId,
      clarificationResolved ||
        ('clarificationResolved' in payload && payload.clarificationResolved === true),
      payload.model,
      payload.promptVersion,
      receiptImagePath,
    );
  }

  private async persistAndConfirm(
    input: TextLogInput,
    context: UserContext,
    transactions: PersistableTransaction[],
    interactionId?: string,
    sourceUpdateId = input.updateId,
    clarificationResolved = false,
    model = this.extractor.model,
    promptVersion = this.extractor.promptVersion,
    receiptImagePath?: string,
  ): Promise<boolean> {
    if (!clarificationResolved && transactions.length === 1 && this.dashboardRepository) {
      const tx = transactions[0];
      if (tx) {
        const rawAmount = Number(tx.amount);
        if (!Number.isNaN(rawAmount) && rawAmount > 0) {
          const type =
            ('type' in tx && tx.type === 'income') || ('kind' in tx && tx.kind === 'income')
              ? 'income'
              : 'expense';
          const candidates = await this.dashboardRepository.findMatchCandidates(context.userId, {
            amountEtb: rawAmount.toFixed(2),
            type,
            occurredAt: input.messageAt.toISOString(),
          });
          if (candidates && candidates.length > 0) {
            return this.requestSmartMatchConfirmation(
              input,
              context,
              transactions,
              candidates,
              model,
              promptVersion,
            );
          }
        }
      }
    }

    const result = await this.transactions.logText({
      userId: context.userId,
      sourceUpdateId,
      sourceMessageId: input.messageId,
      processedUpdateId: input.updateId,
      messageAt: input.messageAt,
      model,
      promptVersion,
      transactions,
      source: input.source === 'voice' ? 'VOICE' : input.source === 'receipt' ? 'RECEIPT' : 'TEXT',
      ...(input.text ? { rawTranscript: input.text } : {}),
      ...(receiptImagePath ? { receiptImagePath } : {}),
      ...(input.sttProvider ? { sttProvider: input.sttProvider } : {}),
      ...(input.sttModel ? { sttModel: input.sttModel } : {}),
      ...(interactionId ? { interactionId } : {}),
      ...(clarificationResolved ? { clarificationResolved: true } : {}),
    });
    await this.deliver(input.chatId, 'transaction.group_confirmation', context.locale, {
      transactions: this.formatLines(transactions, context.locale),
    });
    for (const kind of new Set(
      transactions.map((transaction) => ('kind' in transaction ? transaction.kind : undefined)),
    )) {
      if (kind && !['income', 'expense'].includes(kind)) {
        await this.deliver(
          input.chatId,
          `transaction.effect.${kind}` as MessageKey,
          context.locale,
        );
      }
    }
    if (result.firstLog) await this.deliver(input.chatId, 'transaction.first_log', context.locale);
    return true;
  }

  private async requestSmartMatchConfirmation(
    input: TextLogInput,
    context: UserContext,
    transactions: PersistableTransaction[],
    candidates: MatchCandidateItemDto[],
    model: string,
    promptVersion: string,
  ): Promise<boolean> {
    const rawAmount = Number(transactions[0]?.amount || 0);
    const interaction = await this.interactions.create(context.userId, 'CONFIRM_FINANCIAL', {
      kind: 'confirm_smart_match',
      sourceUpdateId: input.updateId,
      sourceMessageId: input.messageId,
      messageAt: input.messageAt.toISOString(),
      model,
      promptVersion,
      source: input.source ?? 'text',
      ...(input.sttProvider ? { sttProvider: input.sttProvider } : {}),
      ...(input.sttModel ? { sttModel: input.sttModel } : {}),
      transactions,
      candidates: candidates.map((c) => ({
        id: c.id,
        targetType: c.targetType,
        bankSource: c.bankSource,
        amountEtb: c.amountEtb,
        occurredAt: c.occurredAt,
      })),
    });

    const formatTime = (iso: string) => {
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString(context.locale === 'am' ? 'am-ET' : 'en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      } catch {
        return '';
      }
    };

    const inlineKeyboard: TelegramInlineButton[][] = [];

    if (candidates.length === 1) {
      const c = candidates[0]!;
      const bank = c.bankSource || 'Bank';
      const timeStr = formatTime(c.occurredAt);

      inlineKeyboard.push([
        {
          text: this.i18n.translate('smart_match.link_btn', context.locale, { bank }),
          callbackData: `match:link:0:${interaction.id}`,
        },
      ]);
      inlineKeyboard.push([
        {
          text: this.i18n.translate('smart_match.dismiss_btn', context.locale),
          callbackData: `match:skip:${interaction.id}`,
        },
      ]);

      const promptText = this.i18n.translate('smart_match.prompt', context.locale, {
        bank,
        amount: rawAmount.toFixed(2),
        time: timeStr,
      });

      await this.transport.sendMessage(input.chatId, promptText, { inlineKeyboard });
      return false;
    }

    // Multiple candidates
    candidates.forEach((c, idx) => {
      const bank = c.bankSource || 'Bank';
      const timeStr = formatTime(c.occurredAt);
      inlineKeyboard.push([
        {
          text: this.i18n.translate('smart_match.link_item_btn', context.locale, {
            bank,
            time: timeStr ? `(${timeStr})` : '',
          }),
          callbackData: `match:link:${idx}:${interaction.id}`,
        },
      ]);
    });

    inlineKeyboard.push([
      {
        text: this.i18n.translate('smart_match.dismiss_btn', context.locale),
        callbackData: `match:skip:${interaction.id}`,
      },
    ]);

    const promptText = this.i18n.translate('smart_match.multi_prompt', context.locale, {
      count: candidates.length,
      amount: rawAmount.toFixed(2),
    });

    await this.transport.sendMessage(input.chatId, promptText, { inlineKeyboard });
    return false;
  }

  async persistConfirmedSmartMatch(
    telegramUserId: number,
    chatId: number,
    updateId: number,
    interactionId: string,
  ): Promise<boolean> {
    const context = await this.userContext(telegramUserId);
    if (!context) return false;
    const interaction = await this.interactions.findPending(interactionId, context.userId);
    if (!interaction) {
      return false;
    }
    const payload = interaction.payload;
    if (
      !('transactions' in payload) ||
      !Array.isArray(payload.transactions) ||
      payload.transactions.length === 0
    ) {
      return false;
    }
    const transactions = payload.transactions as PersistableTransaction[];

    await this.interactions.cancel(interaction.id, context.userId);

    return this.persistAndConfirm(
      {
        telegramId: telegramUserId,
        chatId,
        updateId,
        messageId: Number('sourceMessageId' in payload ? payload.sourceMessageId : 0),
        messageAt: 'messageAt' in payload ? new Date(payload.messageAt) : new Date(),
        text: '',
        source: 'source' in payload ? payload.source : 'text',
        ...('sttProvider' in payload && typeof payload.sttProvider === 'string'
          ? { sttProvider: payload.sttProvider }
          : {}),
        ...('sttModel' in payload && typeof payload.sttModel === 'string'
          ? { sttModel: payload.sttModel }
          : {}),
      },
      context,
      transactions,
      interaction.id,
      Number('sourceUpdateId' in payload ? payload.sourceUpdateId : updateId),
      true,
      'model' in payload && typeof payload.model === 'string'
        ? payload.model
        : this.extractor.model,
      'promptVersion' in payload && typeof payload.promptVersion === 'string'
        ? payload.promptVersion
        : this.extractor.promptVersion,
    );
  }

  private sourcePayload(input: TextLogInput) {
    return {
      sourceUpdateId: input.updateId,
      sourceMessageId: input.messageId,
      messageAt: input.messageAt.toISOString(),
      model: this.extractor.model,
      promptVersion: this.extractor.promptVersion,
      source: input.source ?? 'text',
      ...(input.text ? { rawTranscript: input.text } : {}),
      ...(input.sttProvider ? { sttProvider: input.sttProvider } : {}),
      ...(input.sttModel ? { sttModel: input.sttModel } : {}),
    };
  }

  private formatLines(
    transactions: Array<
      Pick<PersistableTransaction, 'type' | 'amount' | 'category' | 'note'> & {
        kind?: ValidatedFinancialEvent['kind'] | undefined;
        platform?: string | undefined;
      }
    >,
    locale: Locale,
  ): string {
    return transactions
      .map((transaction, index) => {
        const typeLabel = this.i18n.translate(
          `transaction.type.${transaction.kind ?? transaction.type}` as MessageKey,
          locale,
        );
        const categoryLabel = this.category(transaction.category);
        const platformLabel = this.formatPlatform(transaction.platform, locale);
        const noteStr = transaction.note ? ` (${transaction.note})` : '';
        return `${index + 1}. ${typeLabel} - ${categoryLabel} - ${transaction.amount} ETB${platformLabel}${noteStr}`;
      })
      .join('\n');
  }

  private formatPlatform(platform: string | undefined, locale: Locale): string {
    if (!platform) return '';
    const key = `platform.${platform.toLowerCase()}` as MessageKey;
    const catalog = locale === 'en' ? enCatalog : amCatalog;
    const label = (catalog as Record<string, string>)[key] ?? platform;
    return ` [${label}]`;
  }

  private category(category: string): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private buttons(
    interactionId: string,
    locale: Locale,
    kind: 'type' | 'confirm' | 'undo' | 'cancel',
  ): TelegramInlineButton[][] {
    const button = (key: MessageKey, action: InteractionCallbackInput['action']) => ({
      text: this.i18n.translate(key, locale),
      callbackData: `ix:${interactionId}:${action}`,
    });
    if (kind === 'type') {
      return [
        [button('button.income', 'income'), button('button.expense', 'expense')],
        [button('button.cancel', 'cancel')],
      ];
    }
    if (kind === 'undo') return [[button('button.undo', 'undo'), button('button.keep', 'keep')]];
    if (kind === 'confirm')
      return [[button('button.confirm', 'confirm'), button('button.cancel', 'cancel')]];
    return [[button('button.cancel', 'cancel')]];
  }

  private financialClarificationButtons(
    interactionId: string,
    locale: Locale,
    reason: 'money_direction' | 'ownership' | 'purpose',
  ): TelegramInlineButton[][] {
    const button = (key: MessageKey, action: InteractionCallbackInput['action']) => ({
      text: this.i18n.translate(key, locale),
      callbackData: `ix:${interactionId}:${action}`,
    });
    if (reason === 'money_direction' || reason === 'ownership') {
      return [
        [button('button.own_transfer', 'own_transfer')],
        [button('button.paid_someone', 'paid_someone'), button('button.paid_me', 'paid_me')],
        [button('button.cancel', 'cancel')],
      ];
    }
    return [
      [button('button.work_payment', 'work'), button('button.gift_received', 'gift')],
      [button('button.loan_received', 'loan_in'), button('button.loan_repayment', 'loan_out')],
      [button('button.refund', 'refund'), button('button.reimbursement', 'reimburse')],
      [button('button.cancel', 'cancel')],
    ];
  }

  private financialCandidateFromAction(
    event: Extract<InteractionPayload, { kind: 'clarify_financial' }>['event'],
    action: InteractionCallbackInput['action'],
  ): ValidatedFinancialEvent | null {
    const values = {
      work: { kind: 'income', direction: 'inflow', category: 'freelance' },
      gift: { kind: 'income', direction: 'inflow', category: 'gift_received' },
      loan_in: { kind: 'loan_received', direction: 'inflow', category: 'borrowed_money' },
      loan_out: { kind: 'loan_repayment', direction: 'outflow', category: 'debt_repayment' },
      paid_someone: { kind: 'expense', direction: 'outflow', category: 'other_expense' },
      paid_me: { kind: 'income', direction: 'inflow', category: 'other_income' },
      refund: { kind: 'refund', direction: 'inflow', category: 'refund' },
      reimburse: { kind: 'reimbursement', direction: 'inflow', category: 'reimbursement' },
    } as const;
    if (!(action in values)) return null;
    const resolved = values[action as keyof typeof values];
    return {
      ...resolved,
      type: resolved.direction === 'inflow' ? 'income' : 'expense',
      amount: event.amount,
      currency: 'ETB',
      ...(event.note ? { note: event.note } : {}),
      confidence: 0.95,
    };
  }

  private validateFinancialCandidates(
    transactions: ValidatedFinancialEvent[],
    allowHighValue = false,
  ): ValidatedFinancialEvent[] {
    return this.financialValidator.validate(
      {
        transactions: transactions.map((transaction) => ({
          status: 'ready' as const,
          kind: transaction.kind,
          direction: transaction.direction,
          amount: transaction.amount,
          currency: 'ETB' as const,
          category: transaction.category,
          note: transaction.note ?? undefined,
          platform: transaction.platform ?? undefined,
          confidence: Math.max(transaction.confidence, 0.95),
          clarificationReason: null,
        })),
      },
      allowHighValue,
    ).ready;
  }

  async logTextForUser(input: {
    userId: string;
    text: string;
    messageAt: Date;
    source?: 'text' | 'voice' | 'receipt';
  }): Promise<{ success: boolean; groupId?: string; message: string }> {
    const user = await this.users.findById(input.userId);
    if (!user) return { success: false, message: 'User not found' };
    const locale: Locale = user.language === 'EN' ? 'en' : 'am';
    if (input.text.length > this.maxCharacters) {
      return { success: false, message: this.i18n.translate('transaction.input_too_long', locale) };
    }
    try {
      let ready: PersistableTransaction[] = [];
      if (this.extractor.classify) {
        const classification = await this.extractor.classify(
          { text: input.text, locale },
          input.userId,
        );
        const validated = this.financialValidator.validate(classification);
        if (validated.ready.length === 0) {
          return { success: false, message: this.i18n.translate('transaction.invalid', locale) };
        }
        ready = validated.ready;
      } else {
        const extracted = await this.extractor.extract({ text: input.text, locale });
        ready = this.validator.validate(extracted);
      }
      const result = await this.transactions.logText({
        userId: user.id,
        sourceUpdateId: 0,
        sourceMessageId: 0,
        processedUpdateId: 0,
        messageAt: input.messageAt,
        model: this.extractor.model,
        promptVersion: this.extractor.promptVersion,
        transactions: ready,
        source:
          input.source === 'voice' ? 'VOICE' : input.source === 'receipt' ? 'RECEIPT' : 'TEXT',
      });
      return {
        success: true,
        groupId: result.groupId,
        message: this.i18n.translate('transaction.group_confirmation', locale, {
          transactions: this.formatLines(ready, locale),
        }),
      };
    } catch (error) {
      const key = this.errorMessageKey(error) ?? 'transaction.invalid';
      return { success: false, message: this.i18n.translate(key, locale) };
    }
  }

  async undoLastTransactionForUser(
    userId: string,
  ): Promise<{ success: boolean; groupId?: string; message: string }> {
    const user = await this.users.findById(userId);
    if (!user) return { success: false, message: 'User not found' };
    const locale: Locale = user.language === 'EN' ? 'en' : 'am';

    const undone = await this.transactions.undoLatestForUser(userId);
    if (!undone) {
      return { success: false, message: this.i18n.translate('undo.nothing', locale) };
    }

    return {
      success: true,
      groupId: undone.groupId,
      message: this.i18n.translate('undo.success', locale, {
        transactions: this.formatLines(undone.transactions, locale),
      }),
    };
  }

  async userContextByUserId(userId: string): Promise<UserContext | null> {
    const user = await this.users.findById(userId);
    return user ? { userId: user.id, locale: user.language === 'EN' ? 'en' : 'am' } : null;
  }

  private async userContext(telegramId: number): Promise<UserContext | null> {
    const user = await this.users.findByTelegramId(telegramId);
    return user ? { userId: user.id, locale: user.language === 'EN' ? 'en' : 'am' } : null;
  }

  private errorMessageKey(error: unknown): MessageKey | undefined {
    if (error instanceof ExtractionError) {
      return {
        amount_missing: 'transaction.amount_missing',
        currency_unsupported: 'transaction.currency_unsupported',
        category_unknown: 'transaction.category_unknown',
        ambiguous: 'transaction.invalid',
        invalid_output: 'transaction.invalid',
      }[error.code] as MessageKey;
    }
    if (error instanceof TransactionValidationError) return 'transaction.invalid';
    if (error instanceof MoneyValidationError) return 'transaction.invalid_amount';
    return undefined;
  }

  private validateStoredCandidates(
    transactions: Array<ExtractedTransaction | ValidatedFinancialEvent>,
  ): PersistableTransaction[] {
    if (transactions.every((transaction) => 'kind' in transaction)) {
      return transactions;
    }
    if (transactions.some((transaction) => 'kind' in transaction)) {
      throw new TransactionValidationError('invalid');
    }
    return this.validator.validate({ transactions }, true);
  }

  private async deliver(
    chatId: number,
    key: MessageKey,
    locale: Locale,
    variables?: Record<string, string | number>,
  ): Promise<void> {
    try {
      await this.transport.sendMessage(chatId, this.i18n.translate(key, locale, variables));
    } catch (error) {
      this.logger.error('Transaction message delivery failed', {
        exceptionType: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  private send(chatId: number, key: MessageKey, locale: Locale): Promise<void> {
    return this.transport.sendMessage(chatId, this.i18n.translate(key, locale));
  }
}

interface UserContext {
  userId: string;
  locale: Locale;
}
