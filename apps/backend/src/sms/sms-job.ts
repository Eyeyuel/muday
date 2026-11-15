export const SMS_JOB_NAME = 'process-sms-batch';

export interface SmsBatchMessageItem {
  amount: number;
  type?: string | undefined;
  category?: string | undefined;
  bankSource?: string | undefined;
  occurredAt?: string | undefined;
  note?: string | undefined;
  smsId?: string | undefined;
  rawText?: string | undefined;
}

export interface SmsBatchJobData {
  userId: string;
  messages: SmsBatchMessageItem[];
  enqueuedAt: string;
}

export interface SmsBatchProcessResult {
  processed: number;
  saved: number;
  drafts: number;
  duplicates: number;
}
