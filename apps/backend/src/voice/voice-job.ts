export const VOICE_JOB_NAME = 'transcribe-voice';

export interface VoiceJobDeliveryEnvelope {
  telegramId: number;
  chatId: number;
  updateId: number;
  messageId: number;
}

export interface VoiceJobData {
  userId: string;
  fileId: string;
  messageAt: string;
  locale: 'am' | 'en';
  telegramId?: number;
  chatId?: number;
  updateId?: number;
  messageId?: number;
  delivery?: VoiceJobDeliveryEnvelope;
}
