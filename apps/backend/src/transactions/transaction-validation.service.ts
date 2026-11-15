import { Injectable } from '@nestjs/common';
import type { ExtractedTransaction, ExtractionResult } from '@mezgeb/contracts';

import { Money } from '../money/money.js';

export type TransactionValidationCode = 'invalid' | 'low_confidence' | 'high_value';

export class TransactionValidationError extends Error {
  constructor(readonly code: TransactionValidationCode) {
    super(code);
  }
}

export interface ValidatedTransaction extends ExtractedTransaction {
  amount: string;
}

@Injectable()
export class TransactionValidationService {
  validate(result: ExtractionResult, allowHighValue = false): ValidatedTransaction[] {
    return result.transactions.map((transaction) => {
      if (transaction.currency !== 'ETB') throw new TransactionValidationError('invalid');
      if (transaction.confidence < 0.8) throw new TransactionValidationError('low_confidence');
      const money = Money.parse(transaction.amount);
      if (!allowHighValue && money.isHighValue()) {
        throw new TransactionValidationError('high_value');
      }
      return { ...transaction, amount: money.toDecimalString() };
    });
  }
}
