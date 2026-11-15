import { type ExtractionResult } from '@mezgeb/contracts';
import { z } from 'zod';

const transactionSchema = z
  .object({
    type: z.enum(['income', 'expense']),
    amount: z.string(),
    currency: z.literal('ETB'),
    category: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9 _/-]+$/, 'Category must be lowercase alphanumeric'),
    note: z.string().trim().min(1).max(500).optional(),
    platform: z.string().trim().toLowerCase().min(1).max(50).optional().nullable(),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .transform((val) => {
    return {
      ...val,
      platform: val.platform === 'none' || !val.platform ? undefined : val.platform,
    };
  });

export const extractionResultSchema: z.ZodType<ExtractionResult> = z
  .object({ transactions: z.array(transactionSchema).min(1).max(10) })
  .strict();
