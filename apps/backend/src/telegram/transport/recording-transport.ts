import type { TelegramUpdate } from '../telegram.types.js';
import type {
  TelegramSendOptions,
  TelegramTransport,
  TelegramUpdateHandler,
} from './telegram-transport.interface.js';

export interface RecordedMessage {
  chatId: number;
  text: string;
  options?: TelegramSendOptions;
}

export interface RecordedEditedMessage {
  chatId: number;
  messageId: number;
  text: string;
  options?: TelegramSendOptions;
}

export class RecordingTelegramTransport implements TelegramTransport {
  readonly messages: RecordedMessage[] = [];
  readonly editedMessages: RecordedEditedMessage[] = [];
  readonly answeredCallbackQueryIds: string[] = [];
  resolvedFile = { filePath: 'voice/file.oga', fileSize: 128 };
  private handler?: TelegramUpdateHandler;

  setUpdateHandler(handler: TelegramUpdateHandler): void {
    this.handler = handler;
  }

  async receive(update: TelegramUpdate): Promise<void> {
    if (!this.handler) throw new Error('Telegram update handler is not registered');
    await this.handler(update);
  }

  sendMessage(chatId: number, text: string, options?: TelegramSendOptions): Promise<void> {
    this.messages.push({ chatId, text, ...(options ? { options } : {}) });
    return Promise.resolve();
  }

  editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    options?: TelegramSendOptions,
  ): Promise<void> {
    this.editedMessages.push({ chatId, messageId, text, ...(options ? { options } : {}) });
    return Promise.resolve();
  }

  answerCallbackQuery(callbackQueryId: string): Promise<void> {
    this.answeredCallbackQueryIds.push(callbackQueryId);
    return Promise.resolve();
  }

  getFile(): Promise<{ filePath: string; fileSize?: number }> {
    return Promise.resolve(this.resolvedFile);
  }

  getUserProfilePhotos(): Promise<{
    totalCount: number;
    photos: Array<Array<{ fileId: string }>>;
  }> {
    return Promise.resolve({ totalCount: 0, photos: [] });
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}
