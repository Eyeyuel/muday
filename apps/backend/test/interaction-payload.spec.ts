import { describe, expect, it } from 'vitest';

import {
  interactionPayloadSchema,
  largeAmountPayloadSchema,
  receiptConfirmationPayloadSchema,
} from '../src/interactions/interaction-payload.schema.js';

const source = {
  sourceUpdateId: 1,
  sourceMessageId: 2,
  messageAt: '2026-08-01T06:00:00.000Z',
  model: 'rule-based-v1',
  promptVersion: 'phase4-v1',
};

describe('Phase 4 interaction payloads', () => {
  it('accepts a strict large-amount candidate array', () => {
    expect(
      largeAmountPayloadSchema.parse({
        kind: 'confirm_large_amount',
        ...source,
        transactions: [
          {
            type: 'expense',
            amount: '120000.00',
            currency: 'ETB',
            category: 'rent',
            confidence: 0.95,
          },
        ],
      }).transactions,
    ).toHaveLength(1);
  });

  it('rejects malformed, extra, and non-opaque undo data', () => {
    expect(() =>
      interactionPayloadSchema.parse({
        kind: 'confirm_undo',
        groupId: 'not-a-uuid',
        amount: 'private-data',
      }),
    ).toThrow();
  });

  it('accepts exactly one receipt expense for confirmation', () => {
    expect(
      receiptConfirmationPayloadSchema.parse({
        kind: 'confirm_receipt',
        ...source,
        source: 'receipt',
        transactions: [
          {
            type: 'expense',
            amount: '350.00',
            currency: 'ETB',
            category: 'food',
            confidence: 0.96,
          },
        ],
      }).transactions,
    ).toHaveLength(1);
  });
});
