import { describe, expect, it } from 'vitest';

import { TransactionValidationService } from '../src/transactions/transaction-validation.service.js';

describe('TransactionValidationService', () => {
  const validator = new TransactionValidationService();
  const transaction = {
    type: 'expense' as const,
    amount: '250',
    currency: 'ETB' as const,
    category: 'food' as const,
    confidence: 0.95,
  };

  it('normalizes a valid amount', () => {
    expect(validator.validate({ transactions: [transaction] })[0]?.amount).toBe('250.00');
  });

  it('accepts multiple candidates and rejects low-confidence and high-value candidates', () => {
    expect(validator.validate({ transactions: [transaction, transaction] })).toHaveLength(2);
    expect(() =>
      validator.validate({ transactions: [{ ...transaction, confidence: 0.2 }] }),
    ).toThrow('low_confidence');
    expect(() =>
      validator.validate({ transactions: [{ ...transaction, amount: '100000.01' }] }),
    ).toThrow('high_value');
  });
});
