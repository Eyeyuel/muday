import type { TelegramUpdate } from '../telegram.types.js';

export type TelegramUpdateHandler = (update: TelegramUpdate) => Promise<void>;

export type TelegramInlineButton =
  | { text: string; callbackData: string }
  | { text: string; webAppUrl: string }
  | { text: string; url: string };

export type TelegramReplyButton = { text: string; webAppUrl?: string };

export interface TelegramSendOptions {
  inlineKeyboard?: TelegramInlineButton[][];
  replyKeyboard?: TelegramReplyButton[][];
  persistentReplyKeyboard?: boolean;
  resizeKeyboard?: boolean;
  inputFieldPlaceholder?: string;
  removeReplyKeyboard?: boolean;
  parseMode?: 'HTML' | 'MarkdownV2';
}

export interface TelegramTransport {
  setUpdateHandler(handler: TelegramUpdateHandler): void;
  sendMessage(chatId: number, text: string, options?: TelegramSendOptions): Promise<void>;
  editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options?: TelegramSendOptions,
  ): Promise<void>;
  answerCallbackQuery(callbackQueryId: string): Promise<void>;
  getFile(fileId: string): Promise<{ filePath: string; fileSize?: number }>;
  getUserProfilePhotos(
    telegramId: number,
  ): Promise<{ totalCount: number; photos: Array<Array<{ fileId: string }>> }>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export const TELEGRAM_TRANSPORT = Symbol('TELEGRAM_TRANSPORT');
