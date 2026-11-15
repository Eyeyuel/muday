export type VoiceErrorCode =
  'too_long' | 'too_large' | 'download_failed' | 'conversion_failed' | 'processing_failed';

export class VoiceError extends Error {
  constructor(readonly code: VoiceErrorCode) {
    super(code);
  }
}
