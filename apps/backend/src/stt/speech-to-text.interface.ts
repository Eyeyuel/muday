export interface SpeechToTextInput {
  wavPath: string;
  locale: 'am' | 'en';
}

export interface SpeechToTextResult {
  transcript: string;
  provider: string;
  model: string;
  latencyMs: number;
}

export interface SpeechToTextProvider {
  readonly provider: string;
  readonly model: string;
  transcribe(input: SpeechToTextInput): Promise<SpeechToTextResult>;
}

export const SPEECH_TO_TEXT_PROVIDER = Symbol('SPEECH_TO_TEXT_PROVIDER');
