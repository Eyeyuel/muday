import { Injectable } from '@nestjs/common';

import type { SpeechToTextProvider } from '../speech-to-text.interface.js';
import { SttError } from '../stt.error.js';

@Injectable()
export class DisabledSpeechToTextProvider implements SpeechToTextProvider {
  readonly provider = 'disabled';
  readonly model = 'disabled';

  transcribe(): Promise<never> {
    return Promise.reject(new SttError('failed'));
  }
}
