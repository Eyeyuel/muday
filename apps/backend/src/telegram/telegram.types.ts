import type { Update } from 'grammy/types';

export type TelegramUpdate = Update;

export interface SafeUpdateMetadata {
  updateId: number;
  updateType: string;
  chatId?: number;
  messageId?: number;
  telegramUserId?: number;
}

export function getSafeUpdateMetadata(update: TelegramUpdate): SafeUpdateMetadata {
  if ('message' in update) {
    return {
      updateId: update.update_id,
      updateType: update.message.voice
        ? 'voice'
        : update.message.photo || update.message.document
          ? 'receipt_image'
          : update.message.text
            ? 'message'
            : 'unsupported_message',
      chatId: update.message.chat.id,
      messageId: update.message.message_id,
      telegramUserId: update.message.from?.id,
    };
  }

  if ('callback_query' in update) {
    const message = update.callback_query.message;
    return {
      updateId: update.update_id,
      updateType: 'callback_query',
      telegramUserId: update.callback_query.from.id,
      ...(message ? { chatId: message.chat.id, messageId: message.message_id } : {}),
    };
  }

  return { updateId: update.update_id, updateType: 'unsupported_update' };
}
