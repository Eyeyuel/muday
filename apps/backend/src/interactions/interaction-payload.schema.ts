import { z } from 'zod';

const candidateSchema = z
  .object({
    type: z.enum(['income', 'expense']),
    amount: z.string(),
    currency: z.literal('ETB'),
    category: z.string(),
    note: z.string().max(500).optional(),
    platform: z.string().max(50).optional(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const financialCandidateSchema = z
  .object({
    kind: z.enum([
      'income',
      'expense',
      'loan_received',
      'loan_repayment',
      'refund',
      'reimbursement',
    ]),
    direction: z.enum(['inflow', 'outflow']),
    type: z.enum(['income', 'expense']),
    amount: z.string(),
    currency: z.literal('ETB'),
    category: z.string(),
    note: z.string().max(500).optional(),
    platform: z.string().max(50).optional(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const persistableCandidateSchema = z.union([candidateSchema, financialCandidateSchema]);

const sourceSchema = z
  .object({
    sourceUpdateId: z.number().int().nonnegative(),
    sourceMessageId: z.number().int().positive(),
    messageAt: z.string().datetime(),
    model: z.string().min(1).max(100),
    promptVersion: z.string().min(1).max(30),
    source: z.enum(['text', 'voice', 'receipt']).default('text'),
    rawTranscript: z.string().optional(),
    telegramFileId: z.string().optional(),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
    sttProvider: z.string().min(1).max(50).optional(),
    sttModel: z.string().min(1).max(100).optional(),
  })
  .strict();

const unclearFinancialEventSchema = z
  .object({
    amount: z.string(),
    currency: z.literal('ETB'),
    note: z.string().max(500).optional(),
    confidence: z.number().min(0).max(1),
    clarificationReason: z.enum([
      'amount_missing',
      'money_direction',
      'ownership',
      'purpose',
      'principal_interest_split',
    ]),
  })
  .strict();

export const financialClarificationPayloadSchema = sourceSchema.extend({
  kind: z.literal('clarify_financial'),
  event: unclearFinancialEventSchema,
  readyTransactions: z.array(financialCandidateSchema).max(9),
  ignoredTransferCount: z.number().int().min(0).max(10),
  clarificationCount: z.literal(1),
});

export const amountClarificationPayloadSchema = sourceSchema.extend({
  kind: z.literal('clarify_amount'),
  type: z.enum(['income', 'expense']),
  category: z.string(),
  note: z.string().max(500).optional(),
  clarificationCount: z.literal(1),
});

export const typeClarificationPayloadSchema = sourceSchema.extend({
  kind: z.literal('clarify_type'),
  incomeCandidate: candidateSchema,
  expenseCandidate: candidateSchema,
  clarificationCount: z.literal(1),
});

export const largeAmountPayloadSchema = sourceSchema.extend({
  kind: z.literal('confirm_large_amount'),
  transactions: z.array(persistableCandidateSchema).min(1).max(10),
});

export const financialConfirmationPayloadSchema = sourceSchema.extend({
  kind: z.literal('confirm_financial'),
  transactions: z.array(financialCandidateSchema).min(1).max(10),
  clarificationResolved: z.literal(true),
});

export const receiptConfirmationPayloadSchema = sourceSchema.extend({
  kind: z.literal('confirm_receipt'),
  transactions: z.array(persistableCandidateSchema).length(1),
});

export const smartMatchConfirmationPayloadSchema = sourceSchema.extend({
  kind: z.literal('confirm_smart_match'),
  transactions: z.array(persistableCandidateSchema).min(1).max(10),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        targetType: z.enum(['transaction', 'pending_interaction']),
        bankSource: z.string().nullable().optional(),
        amountEtb: z.string(),
        occurredAt: z.string(),
      }),
    )
    .min(1)
    .max(10),
});

export const undoPayloadSchema = z
  .object({ kind: z.literal('confirm_undo'), groupId: z.string().uuid() })
  .strict();

export const interactionPayloadSchema = z.discriminatedUnion('kind', [
  amountClarificationPayloadSchema,
  typeClarificationPayloadSchema,
  financialClarificationPayloadSchema,
  financialConfirmationPayloadSchema,
  largeAmountPayloadSchema,
  receiptConfirmationPayloadSchema,
  undoPayloadSchema,
  smartMatchConfirmationPayloadSchema,
]);

export type InteractionPayload = z.infer<typeof interactionPayloadSchema>;
export type InteractionPayloadInput = z.input<typeof interactionPayloadSchema>;
export type TransactionCandidate = z.infer<typeof candidateSchema>;

export interface PendingDraftPayload {
  amount?: string | number;
  type?: string;
  bankSource?: string;
  bank?: string;
  platform?: string;
  note?: string | null;
  rawSms?: string | null;
  rawText?: string | null;
  smsId?: string;
  occurredAt?: string;
  messageAt?: string;
  event?: {
    amount?: string | number;
    note?: string | null;
    platform?: string;
  };
  readyTransactions?: Array<{
    amount?: string | number;
    note?: string | null;
    platform?: string;
  }>;
}
