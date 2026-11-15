import { describe, expect, it } from 'vitest';

import { Money } from '../src/money/money.js';

describe('Money', () => {
  it.each([
    ['250', '250.00'],
    ['250.5', '250.50'],
    ['0.01', '0.01'],
    ['999999.99', '999999.99'],
  ])('parses %s safely', (input, expected) => {
    expect(Money.parse(input).toDecimalString()).toBe(expected);
  });

  it.each(['0', '-1', '1000000', '1e3', '12.999', '01', '1,000', '9999999'])(
    'rejects invalid amount %s',
    (input) => expect(() => Money.parse(input)).toThrow(),
  );

  it('identifies values above the Phase 3 high-value threshold', () => {
    expect(Money.parse('100000').isHighValue()).toBe(false);
    expect(Money.parse('100000.01').isHighValue()).toBe(true);
  });
});
