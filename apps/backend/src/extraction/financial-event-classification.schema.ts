import {
  clarificationReasons,
  classificationStatuses,
  financialEventDirections,
  financialEventKinds,
} from '@mezgeb/contracts';
import { z } from 'zod';

export {
  clarificationReasons,
  classificationStatuses,
  financialEventDirections,
  financialEventKinds,
};

const eventSchema = z
  .object({
    status: z.enum(classificationStatuses),
    kind: z.enum(financialEventKinds),
    direction: z.enum(financialEventDirections),
    amount: z
      .string()
      .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/)
      .refine((amount) => Number(amount) > 0, 'Amount must be positive')
      .nullable(),
    currency: z.literal('ETB'),
    category: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9 _/-]+$/, 'Category must be lowercase alphanumeric')
      .nullable(),
    note: z.string().trim().min(1).max(500).optional(),
    platform: z.string().trim().toLowerCase().min(1).max(50).optional().nullable(),
    confidence: z.number().min(0).max(1),
    clarificationReason: z.enum(clarificationReasons).nullable(),
  })
  .strict()
  .transform((val) => {
    let note = val.note;
    if (
      note &&
      val.category &&
      note.toLowerCase() === val.category.replace(/_/g, ' ').toLowerCase()
    ) {
      note = undefined;
    }
    const platform = val.platform === 'none' || !val.platform ? undefined : val.platform;
    return { ...val, note, platform };
  })
  .superRefine((value, context) => {
    if (
      value.amount === null &&
      !(value.status === 'needs_clarification' && value.clarificationReason === 'amount_missing')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Amount may be absent only when amount clarification is required',
      });
    }
    if (value.clarificationReason === 'amount_missing' && value.amount !== null) {
      context.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'An amount marked missing must not contain a guessed value',
      });
    }
    const expectedDirection = {
      income: 'inflow',
      expense: 'outflow',
      loan_received: 'inflow',
      loan_repayment: 'outflow',
      refund: 'inflow',
      reimbursement: 'inflow',
      transfer: 'internal',
      unclear: 'unclear',
    }[value.kind];
    if (value.direction !== expectedDirection) {
      context.addIssue({
        code: 'custom',
        path: ['direction'],
        message: 'Direction does not match financial-event kind',
      });
    }

    if (value.kind === 'transfer') {
      if (value.status !== 'unsupported' || value.category !== null) {
        context.addIssue({
          code: 'custom',
          path: ['status'],
          message: 'Internal transfers must be unsupported and uncategorized',
        });
      }
    } else if (value.kind === 'unclear') {
      if (value.status !== 'needs_clarification' || value.category !== null) {
        context.addIssue({
          code: 'custom',
          path: ['status'],
          message: 'Unclear events must request clarification and remain uncategorized',
        });
      }
    } else if (value.category === null) {
      context.addIssue({
        code: 'custom',
        path: ['category'],
        message: 'Category is required for this financial-event kind',
      });
    }

    if (value.status === 'unsupported' && value.kind !== 'transfer') {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Only internal transfers are unsupported in this classification version',
      });
    }

    if (value.status === 'needs_clarification' && value.clarificationReason === null) {
      context.addIssue({
        code: 'custom',
        path: ['clarificationReason'],
        message: 'Clarification reason is required',
      });
    }
    if (value.status !== 'needs_clarification' && value.clarificationReason !== null) {
      context.addIssue({
        code: 'custom',
        path: ['clarificationReason'],
        message: 'Clarification reason is allowed only when clarification is required',
      });
    }
    if (value.status === 'ready' && value.confidence < 0.8) {
      context.addIssue({
        code: 'custom',
        path: ['confidence'],
        message: 'Ready events must meet the reviewed confidence threshold',
      });
    }
  });

export const financialEventClassificationSchema = z
  .object({ transactions: z.array(eventSchema).min(1).max(10) })
  .strict();

export type FinancialEventClassification = z.infer<typeof financialEventClassificationSchema>;
