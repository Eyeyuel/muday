import { Inject, Injectable } from '@nestjs/common';
import type { TransactionType } from '@mezgeb/contracts';

import { ExtractionError } from '../extraction.error.js';
import { extractionResultSchema } from '../extraction-result.schema.js';
import { TextNormalizerService } from '../text-normalizer.service.js';
import {
  categoryKeywordLexicon,
  containsKeyword,
  expenseKeywords,
  incomeKeywords,
} from '../transaction-keyword.lexicon.js';
import type { ExtractionInput, TransactionExtractor } from '../transaction-extractor.interface.js';

@Injectable()
export class RuleBasedTransactionExtractor implements TransactionExtractor {
  readonly model = 'rule-based-v1';
  readonly promptVersion = 'phase4-v1';

  constructor(@Inject(TextNormalizerService) private readonly normalizer: TextNormalizerService) {}

  async extract(input: ExtractionInput) {
    await Promise.resolve();
    const text = this.normalizer.normalize(input.text);
    if (/\b(?:usd|dollar|eur|euro|gbp|pound)\b|[$€£]/i.test(text)) {
      throw new ExtractionError('currency_unsupported');
    }
    const segments = input.text
      .split(/(?:\r?\n)+|\s+(?:and|እና)\s+|[,;፣።،]+/i)
      .map((segment) => this.normalizer.normalize(segment))
      .filter(Boolean);
    return extractionResultSchema.parse({
      transactions: segments.map((segment) => this.extractOne(segment, text)),
    });
  }

  private extractOne(segment: string, fullText: string) {
    const amount = /(?:^|\s)(\d+(?:\.\d{1,2})?)(?=\s|$)/.exec(segment)?.[1];
    if (!amount) throw new ExtractionError('amount_missing');
    const match = categoryKeywordLexicon.find(({ keywords }) =>
      keywords.some((keyword) => containsKeyword(segment, keyword)),
    );
    if (!match) throw new ExtractionError('category_unknown');
    const { category, keywords } = match;
    const type = this.resolveType(segment, category, fullText);
    const note = keywords.find((keyword) => containsKeyword(segment, keyword));
    return {
      type,
      amount,
      currency: 'ETB' as const,
      category,
      ...(note ? { note } : {}),
      confidence: 0.95,
    };
  }

  private resolveType(text: string, category: string, fallbackText: string): TransactionType {
    const income = incomeKeywords.some((word) => containsKeyword(text, word));
    const expense = expenseKeywords.some((word) => containsKeyword(text, word));
    const fallbackIncome = incomeKeywords.some((word) => containsKeyword(fallbackText, word));
    const fallbackExpense = expenseKeywords.some((word) => containsKeyword(fallbackText, word));
    const incomeCategory = ['salary', 'business', 'remittance', 'other_income'].includes(category);
    if ((income && expense) || (incomeCategory && expense) || (!incomeCategory && income)) {
      throw new ExtractionError('ambiguous');
    }
    if (
      !income &&
      !expense &&
      ((incomeCategory && fallbackExpense) || (!incomeCategory && fallbackIncome))
    ) {
      throw new ExtractionError('ambiguous');
    }
    return incomeCategory ? 'income' : 'expense';
  }
}
