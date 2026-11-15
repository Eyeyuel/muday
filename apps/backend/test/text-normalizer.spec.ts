import { describe, expect, it } from 'vitest';

import { TextNormalizerService } from '../src/extraction/text-normalizer.service.js';

describe('TextNormalizerService', () => {
  const normalizer = new TextNormalizerService();

  it('normalizes whitespace, punctuation, case, and Arabic-Indic digits', () => {
    expect(normalizer.normalize('  LUNCH،  ٢٥٠   Birr! ')).toBe('lunch 250 birr');
  });

  it('preserves Amharic words used by extraction', () => {
    expect(normalizer.normalize('ለምሳ  250 ብር አወጣሁ።')).toBe('ለምሳ 250 ብር አወጣሁ');
  });
});
