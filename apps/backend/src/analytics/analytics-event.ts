import { z } from 'zod';

export const AllowedEventType = {
  SIGNUP: 'signup',
  CONSENT_COMPLETED: 'consent_completed',
  TRANSACTION_LOGGED: 'transaction_logged',
  CLARIFICATION_REQUESTED: 'clarification_requested',
  CLARIFICATION_RESOLVED: 'clarification_resolved',
  CLARIFICATION_FAILED: 'clarification_failed',
  LARGE_AMOUNT_CONFIRMATION_REQUESTED: 'large_amount_confirmation_requested',
  TRANSACTION_GROUP_UNDONE: 'transaction_group_undone',
  VOICE_PROCESSING_COMPLETED: 'voice_processing_completed',
  VOICE_PROCESSING_FAILED: 'voice_processing_failed',
  NOTIFICATION_OPTED_OUT: 'notification_opted_out',
  DASHBOARD_OPENED: 'dashboard_opened',
  TRANSFER_REJECTED: 'transfer_rejected',
  CONFIRMATION_CANCELLED: 'confirmation_cancelled',
  EXTRACTION_INVALID_OUTPUT: 'extraction_invalid_output',
} as const;

export type AllowedEventType = (typeof AllowedEventType)[keyof typeof AllowedEventType];

const source = z.enum(['text', 'voice', 'receipt']);
const noMetadata = z.undefined();
const schemas: Record<AllowedEventType, z.ZodType> = {
  signup: noMetadata,
  consent_completed: noMetadata,
  transaction_logged: z
    .object({
      source,
      transactionCount: z.number().int().min(1).max(50),
      kindCounts: z.record(z.string(), z.number().int().min(0).max(50)).optional(),
      otherCount: z.number().int().min(0).max(50).optional(),
    })
    .strict(),
  clarification_requested: z
    .object({
      source,
      reason: z.enum(['clarify_amount', 'clarify_type', 'clarify_financial']),
    })
    .strict(),
  clarification_resolved: z.object({ source }).strict(),
  clarification_failed: z.object({ source }).strict(),
  large_amount_confirmation_requested: z.object({ source }).strict(),
  transaction_group_undone: noMetadata,
  voice_processing_completed: z
    .object({
      source: z.literal('voice'),
      provider: z.string().min(1).max(50),
      model: z.string().min(1).max(100),
      sttLatencyMs: z.number().nonnegative().finite(),
      totalLatencyMs: z.number().int().nonnegative(),
    })
    .strict(),
  voice_processing_failed: z
    .object({
      source: z.literal('voice'),
      failureCode: z.string().regex(/^[A-Z0-9_]{1,80}$/),
    })
    .strict(),
  notification_opted_out: z.object({ notification: z.enum(['morning', 'night']) }).strict(),
  dashboard_opened: z
    .object({ period: z.enum(['today', 'week', 'month', 'all', 'custom']) })
    .strict(),
  transfer_rejected: z.object({ source, count: z.number().int().min(1).max(10) }).strict(),
  confirmation_cancelled: z
    .object({ source, confirmation: z.enum(['financial', 'large_amount', 'receipt']) })
    .strict(),
  extraction_invalid_output: z.object({ source, provider: z.literal('gemini') }).strict(),
};

export function analyticsEventData(
  eventType: AllowedEventType,
  metadata?: unknown,
): { eventType: AllowedEventType; metadata?: object } {
  const schema = schemas[eventType];
  if (!schema) throw new Error('Unsupported analytics event type');
  const parsed = schema.safeParse(metadata);
  if (!parsed.success) throw new Error('Unsupported analytics event metadata');
  return {
    eventType,
    ...(parsed.data === undefined ? {} : { metadata: parsed.data as object }),
  };
}
