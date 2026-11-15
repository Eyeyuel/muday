import { describe, expect, it } from 'vitest';

import { financialEventClassificationSchema } from '../src/extraction/financial-event-classification.schema.js';

const event = {
  status: 'ready',
  kind: 'income',
  direction: 'inflow',
  amount: '5000.00',
  currency: 'ETB',
  category: 'salary',
  confidence: 0.95,
  clarificationReason: null,
} as const;

describe('financialEventClassificationSchema', () => {
  it('accepts ordinary and special events with compatible directions and categories', () => {
    expect(
      financialEventClassificationSchema.parse({
        transactions: [
          event,
          {
            ...event,
            kind: 'loan_received',
            category: 'borrowed_money',
            note: 'From Hana',
          },
          {
            ...event,
            kind: 'loan_repayment',
            direction: 'outflow',
            category: 'debt_repayment',
          },
          { ...event, kind: 'refund', category: 'refund' },
          { ...event, kind: 'reimbursement', category: 'reimbursement' },
        ],
      }).transactions,
    ).toHaveLength(5);
  });

  it('accepts unsupported transfers without assigning a category', () => {
    expect(
      financialEventClassificationSchema.parse({
        transactions: [
          {
            ...event,
            status: 'unsupported',
            kind: 'transfer',
            direction: 'internal',
            category: null,
          },
        ],
      }).transactions[0],
    ).toMatchObject({ kind: 'transfer', category: null });
  });

  it('accepts a structured clarification without guessing kind or category', () => {
    expect(
      financialEventClassificationSchema.parse({
        transactions: [
          {
            ...event,
            status: 'needs_clarification',
            kind: 'unclear',
            direction: 'unclear',
            category: null,
            confidence: 0.5,
            clarificationReason: 'purpose',
          },
        ],
      }).transactions[0],
    ).toMatchObject({ kind: 'unclear', clarificationReason: 'purpose' });
  });

  it('represents a missing amount as null without forcing the model to guess', () => {
    expect(
      financialEventClassificationSchema.parse({
        transactions: [
          {
            ...event,
            status: 'needs_clarification',
            kind: 'unclear',
            direction: 'unclear',
            amount: null,
            category: null,
            confidence: 0.4,
            clarificationReason: 'amount_missing',
          },
        ],
      }).transactions[0],
    ).toMatchObject({ amount: null, clarificationReason: 'amount_missing' });
  });

  it.each([
    {
      name: 'direction mismatch',
      value: { ...event, direction: 'outflow' },
    },
    {
      name: 'unsupported ordinary income',
      value: { ...event, status: 'unsupported' },
    },
    {
      name: 'missing clarification reason',
      value: { ...event, status: 'needs_clarification', confidence: 0.5 },
    },
    {
      name: 'low-confidence ready event',
      value: { ...event, confidence: 0.79 },
    },
    {
      name: 'invalid decimal amount',
      value: { ...event, amount: '-5000' },
    },
    {
      name: 'missing amount on a ready event',
      value: { ...event, amount: null },
    },
    {
      name: 'guessed amount marked as missing',
      value: {
        ...event,
        status: 'needs_clarification',
        confidence: 0.5,
        clarificationReason: 'amount_missing',
      },
    },
  ])('rejects $name', ({ value }) => {
    expect(() => financialEventClassificationSchema.parse({ transactions: [value] })).toThrow();
  });

  it('removes a category-only note instead of rejecting an otherwise valid event', () => {
    expect(
      financialEventClassificationSchema.parse({
        transactions: [{ ...event, note: 'Salary' }],
      }).transactions[0],
    ).toEqual({ ...event, note: undefined });
  });

  it('accepts a mixed message containing an ignored transfer and valid expenses', () => {
    expect(
      financialEventClassificationSchema.parse({
        transactions: [
          {
            ...event,
            status: 'unsupported',
            kind: 'transfer',
            direction: 'internal',
            amount: '5000',
            category: null,
          },
          {
            ...event,
            kind: 'expense',
            direction: 'outflow',
            amount: '20',
            category: 'fees_taxes',
            note: 'ATM fee',
          },
          {
            ...event,
            kind: 'expense',
            direction: 'outflow',
            amount: '300',
            category: 'food_groceries',
            note: 'Lunch',
          },
        ],
      }).transactions,
    ).toHaveLength(3);
  });
});
