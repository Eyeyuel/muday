export const RECEIPT_JOB_NAME = 'extract-receipt';

export type ReceiptMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ReceiptJobDeliveryEnvelope {
  telegramId: number;
  chatId: number;
  updateId: number;
  messageId: number;
}

export interface ReceiptJobData {
  userId: string;
  fileId: string;
  mimeType: ReceiptMimeType;
  messageAt: string;
  locale: 'am' | 'en';
  telegramId?: number;
  chatId?: number;
  updateId?: number;
  messageId?: number;
  delivery?: ReceiptJobDeliveryEnvelope;
}
