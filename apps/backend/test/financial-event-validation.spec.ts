import { describe, expect, it } from 'vitest';

import type { FinancialEventClassification } from '../src/extraction/financial-event-classification.schema.js';
import { FinancialEventValidationService } from '../src/transactions/financial-event-validation.service.js';

const ready = (overrides: Record<string, unknown> = {}) =>
  ({
    status: 'ready',
    kind: 'income',
    direction: 'inflow',
    amount: '5000',
    currency: 'ETB',
    category: 'salary',
    confidence: 0.95,
    clarificationReason: null,
    ...overrides,
  }) as FinancialEventClassification['transactions'][number];

describe('FinancialEventValidationService', () => {
  const service = new FinancialEventValidationService();

  it('normalizes supported events and derives the compatibility direction type', () => {
    const result = service.validate({
      transactions: [
        ready({ kind: 'loan_received', category: 'borrowed_money', note: 'From Hana' }),
        ready({
          kind: 'loan_repayment',
          direction: 'outflow',
          category: 'debt_repayment',
          amount: '1000.5',
        }),
      ],
    });
    expect(result.ready).toEqual([
      expect.objectContaining({ kind: 'loan_received', type: 'income', amount: '5000.00' }),
      expect.objectContaining({ kind: 'loan_repayment', type: 'expense', amount: '1000.50' }),
    ]);
  });

  it('removes internal transfers while preserving supported events', () => {
    const result = service.validate({
      transactions: [
        ready({
          status: 'unsupported',
          kind: 'transfer',
          direction: 'internal',
          category: null,
        }),
        ready({ kind: 'expense', direction: 'outflow', category: 'fees_taxes', amount: '20' }),
      ],
    });
    expect(result.transfers).toBe(1);
    expect(result.ready).toHaveLength(1);
  });

  it('does not persist unclear events', () => {
    const result = service.validate({
      transactions: [
        ready({
          status: 'needs_clarification',
          kind: 'unclear',
          direction: 'unclear',
          category: null,
          clarificationReason: 'purpose',
          confidence: 0.5,
        }),
      ],
    });
    expect(result).toEqual({ ready: [], transfers: 0, needsClarification: true });
  });

  it('does not persist an amount-missing event with a null amount', () => {
    const result = service.validate({
      transactions: [
        ready({
          status: 'needs_clarification',
          kind: 'unclear',
          direction: 'unclear',
          amount: null,
          category: null,
          clarificationReason: 'amount_missing',
          confidence: 0.4,
        }),
      ],
    });
    expect(result).toEqual({ ready: [], transfers: 0, needsClarification: true });
  });

  it('retains high-value confirmation enforcement', () => {
    expect(() => service.validate({ transactions: [ready({ amount: '100000.01' })] })).toThrow(
      'high_value',
    );
    expect(
      service.validate({ transactions: [ready({ amount: '100000.01' })] }, true).ready[0]?.amount,
    ).toBe('100000.01');
  });
});
