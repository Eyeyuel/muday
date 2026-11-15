export type SttErrorCode = 'authentication' | 'quota' | 'timeout' | 'invalid_response' | 'failed';

export class SttError extends Error {
  constructor(
    readonly code: SttErrorCode,
    readonly retryable = false,
  ) {
    super(code);
  }
}
