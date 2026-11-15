export type ReceiptErrorCode =
  'too_large' | 'unsupported_type' | 'download_failed' | 'processing_failed';

export class ReceiptError extends Error {
  constructor(readonly code: ReceiptErrorCode) {
    super(code);
  }
}
