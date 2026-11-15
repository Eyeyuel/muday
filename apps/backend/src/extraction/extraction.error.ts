export type ExtractionFailureCode =
  'amount_missing' | 'currency_unsupported' | 'category_unknown' | 'ambiguous' | 'invalid_output';

export class ExtractionError extends Error {
  constructor(readonly code: ExtractionFailureCode) {
    super(code);
  }
}
