import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../config/environment.js';
import type { SpeechToTextProvider, SpeechToTextResult } from '../speech-to-text.interface.js';

@Injectable()
export class FakeSpeechToTextProvider implements SpeechToTextProvider {
  readonly provider = 'fake';
  readonly model = 'fake-stt-v1';
  private readonly transcript: string;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.transcript = config.get('FAKE_STT_TRANSCRIPT', { infer: true });
  }

  async transcribe(): Promise<SpeechToTextResult> {
    await Promise.resolve();
    return {
      transcript: this.transcript,
      provider: this.provider,
      model: this.model,
      latencyMs: 0,
    };
  }
}
