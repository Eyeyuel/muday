import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove } from 'grammy/types';

import type { Environment } from '../../config/environment.js';
import { StructuredLogger } from '../../observability/structured-logger.service.js';
export {
  TELEGRAM_COMMANDS,
  TELEGRAM_COMMANDS_AM,
  TELEGRAM_PROFILE,
} from './telegram-profile.constants.js';
import { TelegramProfileSyncService } from './telegram-profile-sync.service.js';
import type {
  TelegramSendOptions,
  TelegramTransport,
  TelegramUpdateHandler,
} from './telegram-transport.interface.js';

@Injectable()
export class GrammyTelegramTransport implements TelegramTransport {
  private bot: Bot | null = null;
  private updateHandler: TelegramUpdateHandler | null = null;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(TelegramProfileSyncService) private readonly profileSync: TelegramProfileSyncService,
  ) {
    const token = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    if (token) {
      this.bot = new Bot(token);
      this.bot.use(async (context) => this.updateHandler?.(context.update));
      this.bot.catch((error) => {
        this.logger.error('Telegram update processing failed', {
          updateId: error.ctx.update.update_id,
          exceptionType: error.error instanceof Error ? error.error.name : typeof error.error,
        });
      });
    }
  }

  setUpdateHandler(handler: TelegramUpdateHandler): void {
    this.updateHandler = handler;
  }

  async handleWebhookUpdate(update: object): Promise<void> {
    if (!this.bot) throw new Error('TELEGRAM_BOT_TOKEN is required for webhook processing');
    await this.bot.handleUpdate(update as never);
  }

  async sendMessage(chatId: number, text: string, options?: TelegramSendOptions): Promise<void> {
    if (!this.bot) throw new Error('TELEGRAM_BOT_TOKEN is required to send Telegram messages');

    let reply_markup: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | undefined =
      undefined;

    if (options?.inlineKeyboard) {
      reply_markup = {
        inline_keyboard: options.inlineKeyboard.map((row) =>
          row.map((button) => {
            if ('callbackData' in button) {
              return { text: button.text, callback_data: button.callbackData };
            }
            if ('webAppUrl' in button) {
              return { text: button.text, web_app: { url: button.webAppUrl } };
            }
            return { text: button.text, url: button.url };
          }),
        ),
      };
    } else if (options?.replyKeyboard) {
      reply_markup = {
        keyboard: options.replyKeyboard.map((row) =>
          row.map((button) =>
            button.webAppUrl
              ? { text: button.text, web_app: { url: button.webAppUrl } }
              : { text: button.text },
          ),
        ),
        resize_keyboard: options.resizeKeyboard ?? true,
        is_persistent: options.persistentReplyKeyboard ?? true,
        ...(options.inputFieldPlaceholder
          ? { input_field_placeholder: options.inputFieldPlaceholder }
          : {}),
      };
    } else if (options?.removeReplyKeyboard) {
      reply_markup = { remove_keyboard: true };
    }

    await this.bot.api.sendMessage(chatId, text, {
      ...(reply_markup ? { reply_markup } : {}),
      ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
    });
  }

  async editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options?: TelegramSendOptions,
  ): Promise<void> {
    if (!this.bot) throw new Error('TELEGRAM_BOT_TOKEN is required to edit Telegram messages');

    let reply_markup: InlineKeyboardMarkup | undefined = undefined;

    if (options?.inlineKeyboard) {
      reply_markup = {
        inline_keyboard: options.inlineKeyboard.map((row) =>
          row.map((button) => {
            if ('callbackData' in button) {
              return { text: button.text, callback_data: button.callbackData };
            }
            if ('webAppUrl' in button) {
              return { text: button.text, web_app: { url: button.webAppUrl } };
            }
            return { text: button.text, url: button.url };
          }),
        ),
      };
    }

    try {
      await this.bot.api.editMessageText(chatId, messageId, text, {
        ...(reply_markup ? { reply_markup } : {}),
        ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
      });
    } catch (error: unknown) {
      // Ignore Telegram error when message content is identical
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('message is not modified')) {
        return;
      }
      throw error;
    }
  }

  async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    if (!this.bot) throw new Error('TELEGRAM_BOT_TOKEN is required to answer callback queries');
    await this.bot.api.answerCallbackQuery(callbackQueryId);
  }

  async getFile(fileId: string): Promise<{ filePath: string; fileSize?: number }> {
    if (!this.bot) throw new Error('TELEGRAM_BOT_TOKEN is required to resolve Telegram files');
    const file = await this.bot.api.getFile(fileId);
    if (!file.file_path) throw new Error('TELEGRAM_FILE_PATH_MISSING');
    return {
      filePath: file.file_path,
      ...(file.file_size === undefined ? {} : { fileSize: file.file_size }),
    };
  }

  async getUserProfilePhotos(
    telegramId: number,
  ): Promise<{ totalCount: number; photos: Array<Array<{ fileId: string }>> }> {
    if (!this.bot) throw new Error('TELEGRAM_BOT_TOKEN is required to fetch profile photos');
    const result = await this.bot.api.getUserProfilePhotos(telegramId, { limit: 1 });
    return {
      totalCount: result.total_count,
      photos: result.photos.map((row) => row.map((photo) => ({ fileId: photo.file_id }))),
    };
  }

  async start(): Promise<void> {
    if (!this.bot) throw new Error('TELEGRAM_BOT_TOKEN is missing from .env');
    await this.profileSync.sync();
    await this.bot.start({ onStart: () => this.logger.log('Telegram long polling started') });
  }

  async stop(): Promise<void> {
    if (this.bot?.isRunning()) await this.bot.stop();
  }
}
