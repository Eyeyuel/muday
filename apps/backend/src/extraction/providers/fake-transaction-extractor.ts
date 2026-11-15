import { Injectable } from '@nestjs/common';
import type { TransactionType } from '@mezgeb/contracts';

import { ExtractionError } from '../extraction.error.js';
import { extractionResultSchema } from '../extraction-result.schema.js';
import type { ExtractionInput, TransactionExtractor } from '../transaction-extractor.interface.js';

@Injectable()
export class FakeTransactionExtractor implements TransactionExtractor {
  readonly model = 'fake-v1';
  readonly promptVersion = 'phase3-fake-v1';

  extract(input: ExtractionInput) {
    const match = /^fixture:(income|expense):([a-z_]+):(\d+(?:\.\d{1,2})?)$/i.exec(
      input.text.trim(),
    );
    if (!match?.[1] || !match[2] || !match[3]) throw new ExtractionError('invalid_output');
    return Promise.resolve(
      extractionResultSchema.parse({
        transactions: [
          {
            type: match[1].toLowerCase() as TransactionType,
            amount: match[3],
            currency: 'ETB',
            category: match[2].toLowerCase(),
            confidence: 1,
          },
        ],
      }),
    );
  }
}
