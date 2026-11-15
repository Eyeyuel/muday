import { Injectable } from '@nestjs/common';

import { ExtractionError } from '../extraction.error.js';
import type { TransactionExtractor } from '../transaction-extractor.interface.js';

@Injectable()
export class RemoteTransactionExtractor implements TransactionExtractor {
  readonly model = 'remote-disabled';
  readonly promptVersion = 'disabled';

  extract(): never {
    throw new ExtractionError('invalid_output');
  }
}
