import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { DisabledSpeechToTextProvider } from './providers/disabled-speech-to-text.provider.js';
import { FakeSpeechToTextProvider } from './providers/fake-speech-to-text.provider.js';
import { HasabSpeechToTextProvider } from './providers/hasab-speech-to-text.provider.js';
import { AddisAiSpeechToTextProvider } from './providers/addisai-speech-to-text.provider.js';
import { SPEECH_TO_TEXT_PROVIDER, type SpeechToTextProvider } from './speech-to-text.interface.js';

@Module({
  providers: [
    FakeSpeechToTextProvider,
    HasabSpeechToTextProvider,
    AddisAiSpeechToTextProvider,
    DisabledSpeechToTextProvider,
    {
      provide: SPEECH_TO_TEXT_PROVIDER,
      inject: [
        ConfigService,
        FakeSpeechToTextProvider,
        HasabSpeechToTextProvider,
        AddisAiSpeechToTextProvider,
        DisabledSpeechToTextProvider,
      ],
      useFactory: (
        config: ConfigService<Environment, true>,
        fake: FakeSpeechToTextProvider,
        hasab: HasabSpeechToTextProvider,
        addisai: AddisAiSpeechToTextProvider,
        disabled: DisabledSpeechToTextProvider,
      ): SpeechToTextProvider => {
        const provider = config.get('STT_PROVIDER', { infer: true });
        return provider === 'fake'
          ? fake
          : provider === 'hasab'
            ? hasab
            : provider === 'addisai'
              ? addisai
              : disabled;
      },
    },
  ],
  exports: [SPEECH_TO_TEXT_PROVIDER],
})
export class SttModule {}
