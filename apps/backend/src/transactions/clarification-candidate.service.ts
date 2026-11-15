import { Inject, Injectable } from '@nestjs/common';

import { TextNormalizerService } from '../extraction/text-normalizer.service.js';

const keywords: Array<[string, string[]]> = [
  ['salary', ['salary', 'wage', 'ደመወዝ']],
  ['business', ['business', 'sales', 'ንግድ', 'ሽያጭ']],
  ['remittance', ['remittance', 'money transfer', 'ከውጭ', 'ሐዋላ']],
  ['food', ['lunch', 'dinner', 'breakfast', 'food', 'meal', 'ምሳ', 'እራት', 'ምግብ']],
  ['transport', ['taxi', 'bus', 'transport', 'fuel', 'ታክሲ', 'ትራንስፖርት', 'ነዳጅ']],
  ['rent', ['rent', 'ኪራይ']],
  ['utilities', ['electricity', 'water', 'utility', 'መብራት', 'ውሃ']],
  ['airtime_data', ['airtime', 'data', 'internet', 'ካርድ', 'ኢንተርኔት']],
  ['health', ['doctor', 'medicine', 'health', 'ሐኪም', 'መድሃኒት', 'ጤና']],
  ['education', ['school', 'book', 'education', 'ትምህርት', 'መጽሐፍ']],
  ['family_support', ['family support', 'family', 'ቤተሰብ']],
  ['entertainment', ['movie', 'entertainment', 'cinema', 'መዝናኛ', 'ፊልም']],
  ['clothing', ['clothes', 'clothing', 'shirt', 'ልብስ']],
  ['church_charity', ['church', 'charity', 'donation', 'ቤተክርስቲያን', 'ምጽዋት', 'ልገሳ']],
];

@Injectable()
export class ClarificationCandidateService {
  constructor(@Inject(TextNormalizerService) private readonly normalizer: TextNormalizerService) {}

  infer(text: string) {
    const normalized = this.normalizer.normalize(text);
    const match = keywords.find(([, words]) => words.some((word) => normalized.includes(word)));
    if (!match) return null;
    const [category, words] = match;
    const note = words.find((word) => normalized.includes(word));
    const incomeCategory = ['salary', 'business', 'remittance', 'other_income'].includes(category);
    return {
      category,
      type: incomeCategory ? ('income' as const) : ('expense' as const),
      ...(note ? { note } : {}),
      amount: /(?:^|\s)(\d+(?:\.\d{1,2})?)(?=\s|$)/.exec(normalized)?.[1],
    };
  }
}
