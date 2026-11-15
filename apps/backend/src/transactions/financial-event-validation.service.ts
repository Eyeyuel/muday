import { Injectable } from '@nestjs/common';
import type { FinancialEventDirection, FinancialEventKind } from '@mezgeb/contracts';

import type { FinancialEventClassification } from '../extraction/financial-event-classification.schema.js';
import { Money } from '../money/money.js';
import { TransactionValidationError } from './transaction-validation.service.js';

export interface ValidatedFinancialEvent {
  kind: Exclude<FinancialEventKind, 'transfer' | 'unclear'>;
  direction: Extract<FinancialEventDirection, 'inflow' | 'outflow'>;
  type: 'income' | 'expense';
  amount: string;
  currency: 'ETB';
  category: string;
  note?: string | undefined;
  platform?: string | undefined;
  confidence: number;
}

export interface ValidatedClassification {
  ready: ValidatedFinancialEvent[];
  transfers: number;
  needsClarification: boolean;
}

@Injectable()
export class FinancialEventValidationService {
  validate(result: FinancialEventClassification, allowHighValue = false): ValidatedClassification {
    const ready: ValidatedFinancialEvent[] = [];
    let transfers = 0;
    let needsClarification = false;
    for (const event of result.transactions) {
      if (event.status === 'unsupported') {
        transfers += 1;
        continue;
      }
      if (event.status === 'needs_clarification') {
        needsClarification = true;
        continue;
      }
      if (
        event.kind === 'transfer' ||
        event.kind === 'unclear' ||
        event.amount === null ||
        event.category === null ||
        (event.direction !== 'inflow' && event.direction !== 'outflow')
      ) {
        throw new TransactionValidationError('invalid');
      }
      const money = Money.parse(event.amount);
      if (!allowHighValue && money.isHighValue()) {
        throw new TransactionValidationError('high_value');
      }
      ready.push({
        kind: event.kind,
        direction: event.direction,
        type: event.direction === 'inflow' ? 'income' : 'expense',
        amount: money.toDecimalString(),
        currency: 'ETB',
        category: event.category,
        ...(event.note ? { note: event.note } : {}),
        ...(event.platform ? { platform: event.platform } : {}),
        confidence: event.confidence,
      });
    }
    return { ready, transfers, needsClarification };
  }
}
