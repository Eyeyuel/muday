import { describe, expect, it } from 'vitest';

import { RuleBasedTransactionExtractor } from '../src/extraction/providers/rule-based-transaction-extractor.js';
import { TextNormalizerService } from '../src/extraction/text-normalizer.service.js';
import { categoryKeywordLexicon } from '../src/extraction/transaction-keyword.lexicon.js';

describe('RuleBasedTransactionExtractor', () => {
  const extractor = new RuleBasedTransactionExtractor(new TextNormalizerService());

  it.each([
    ['I spent 250 birr on lunch', 'expense', 'food', '250'],
    ['ለምሳ 250 ብር አወጣሁ', 'expense', 'food', '250'],
    ['taxi 300 ብር ከፈልኩ', 'expense', 'transport', '300'],
    ['salary 15000 ብር ገባ', 'income', 'salary', '15000'],
    ['I paid 300 birr for utilities', 'expense', 'utilities', '300'],
    ['ለመብራት 300 ብር ከፈልኩ', 'expense', 'utilities', '300'],
  ])('extracts %s', async (text, type, category, amount) => {
    const result = await extractor.extract({ text, locale: 'en' });
    expect(result.transactions[0]).toMatchObject({ type, category, amount, currency: 'ETB' });
  });

  it('rejects non-ETB currency', async () => {
    await expect(
      extractor.extract({ text: 'I spent 20 USD on lunch', locale: 'en' }),
    ).rejects.toMatchObject({ code: 'currency_unsupported' });
  });

  it('rejects missing amount or category without guessing', async () => {
    await expect(
      extractor.extract({ text: 'I paid for lunch', locale: 'en' }),
    ).rejects.toMatchObject({
      code: 'amount_missing',
    });
    await expect(
      extractor.extract({ text: 'I spent 250 birr', locale: 'en' }),
    ).rejects.toMatchObject({
      code: 'category_unknown',
    });
  });

  it('extracts multiple English transactions', async () => {
    const result = await extractor.extract({
      text: 'I spent 200 birr on lunch and 100 birr on taxi',
      locale: 'en',
    });
    expect(result.transactions.map(({ amount, category }) => ({ amount, category }))).toEqual([
      { amount: '200', category: 'food' },
      { amount: '100', category: 'transport' },
    ]);
  });

  it.each([
    ['I paid 300 birr for utilities\nI spent 250 birr on lunch', 'newline'],
    ['I paid 300 birr for utilities, I spent 250 birr on lunch', 'comma'],
    ['I paid 300 birr for utilities; I spent 250 birr on lunch', 'semicolon'],
  ])('pairs each amount with its own category across an English %s boundary', async (text) => {
    const result = await extractor.extract({ text, locale: 'en' });
    expect(result.transactions.map(({ amount, category }) => ({ amount, category }))).toEqual([
      { amount: '300', category: 'utilities' },
      { amount: '250', category: 'food' },
    ]);
  });

  it('extracts multiple Amharic transactions', async () => {
    const result = await extractor.extract({
      text: 'ለምሳ 200 ብር እና ለታክሲ 100 ብር አወጣሁ',
      locale: 'am',
    });
    expect(result.transactions.map(({ amount, category }) => ({ amount, category }))).toEqual([
      { amount: '200', category: 'food' },
      { amount: '100', category: 'transport' },
    ]);
  });

  it('extracts newline-separated Amharic transactions independently', async () => {
    const result = await extractor.extract({
      text: 'ለመብራት 300 ብር ከፈልኩ\nለምሳ 250 ብር አወጣሁ',
      locale: 'am',
    });
    expect(result.transactions.map(({ amount, category }) => ({ amount, category }))).toEqual([
      { amount: '300', category: 'utilities' },
      { amount: '250', category: 'food' },
    ]);
  });

  it('maps every documented category keyword to its fixed category', async () => {
    for (const entry of categoryKeywordLexicon) {
      for (const keyword of entry.keywords) {
        const result = await extractor.extract({ text: `100 ${keyword}`, locale: 'en' });
        expect(result.transactions[0]?.category, keyword).toBe(entry.category);
      }
    }
  });

  it('does not match English keywords inside unrelated words', async () => {
    await expect(
      extractor.extract({ text: 'I paid 100 birr for a current account', locale: 'en' }),
    ).rejects.toMatchObject({ code: 'category_unknown' });
  });
});
