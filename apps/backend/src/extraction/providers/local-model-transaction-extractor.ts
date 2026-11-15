import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../config/environment.js';
import { ExtractionError } from '../extraction.error.js';
import { extractionResultSchema } from '../extraction-result.schema.js';
import type { ExtractionInput, TransactionExtractor } from '../transaction-extractor.interface.js';

@Injectable()
export class LocalModelTransactionExtractor implements TransactionExtractor {
  readonly model: string;
  readonly promptVersion: string;
  private readonly baseUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.model = config.get('EXTRACTION_MODEL', { infer: true });
    this.promptVersion = config.get('EXTRACTION_PROMPT_VERSION', { infer: true });
    this.baseUrl = config.get('EXTRACTION_LOCAL_BASE_URL', { infer: true }).replace(/\/$/, '');
  }

  async extract(input: ExtractionInput) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Extract one ETB transaction. Return strict JSON: {"transactions":[{"type":"income|expense","amount":"decimal","currency":"ETB","category":"fixed_category","note":"optional","confidence":0..1}]}. Ignore dates.',
            },
            { role: 'user', content: input.text.slice(0, 2_000) },
          ],
        }),
      });
      if (!response.ok) throw new ExtractionError('invalid_output');
      const envelope = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = envelope.choices?.[0]?.message?.content;
      if (!content || content.length > 20_000) throw new ExtractionError('invalid_output');
      return extractionResultSchema.parse(JSON.parse(content) as unknown);
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      throw new ExtractionError('invalid_output');
    } finally {
      clearTimeout(timeout);
    }
  }
}
