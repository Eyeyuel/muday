import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { FakeTransactionExtractor } from './providers/fake-transaction-extractor.js';
import { GeminiTransactionExtractor } from './providers/gemini-transaction-extractor.js';
import { LocalModelTransactionExtractor } from './providers/local-model-transaction-extractor.js';
import { RemoteTransactionExtractor } from './providers/remote-transaction-extractor.js';
import { RuleBasedTransactionExtractor } from './providers/rule-based-transaction-extractor.js';
import { TextNormalizerService } from './text-normalizer.service.js';
import {
  TRANSACTION_EXTRACTOR,
  type TransactionExtractor,
} from './transaction-extractor.interface.js';
import { CategoriesModule } from '../categories/categories.module.js';

@Module({
  imports: [CategoriesModule],
  providers: [
    TextNormalizerService,
    FakeTransactionExtractor,
    RuleBasedTransactionExtractor,
    LocalModelTransactionExtractor,
    RemoteTransactionExtractor,
    GeminiTransactionExtractor,
    {
      provide: TRANSACTION_EXTRACTOR,
      inject: [
        ConfigService,
        FakeTransactionExtractor,
        RuleBasedTransactionExtractor,
        LocalModelTransactionExtractor,
        RemoteTransactionExtractor,
        GeminiTransactionExtractor,
      ],
      useFactory: (
        config: ConfigService<Environment, true>,
        fake: FakeTransactionExtractor,
        rule: RuleBasedTransactionExtractor,
        local: LocalModelTransactionExtractor,
        remote: RemoteTransactionExtractor,
        gemini: GeminiTransactionExtractor,
      ): TransactionExtractor => {
        const provider = config.get('EXTRACTION_PROVIDER', { infer: true });
        return { fake, rule, local, remote, gemini }[provider];
      },
    },
  ],
  exports: [TRANSACTION_EXTRACTOR, TextNormalizerService],
})
export class ExtractionModule {}
