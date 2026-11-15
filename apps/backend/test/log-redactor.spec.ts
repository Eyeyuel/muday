import { describe, expect, it } from 'vitest';

import { redactText, redactValue } from '../src/observability/log-redactor.js';

describe('log redaction', () => {
  it('redacts sensitive fields recursively', () => {
    expect(
      redactValue({
        safe: 'kept',
        telegramBotToken: '123456:secret',
        nested: {
          raw_transcript: 'private words',
          amount_etb: '250.00',
          category: 'food',
        },
      }),
    ).toEqual({
      safe: 'kept',
      telegramBotToken: '[REDACTED]',
      nested: {
        raw_transcript: '[REDACTED]',
        amount_etb: '[REDACTED]',
        category: 'food',
      },
    });
  });

  it('redacts token-shaped and key-value secrets from text', () => {
    const result = redactText(
      'token=abc authorization=BearerSecret 123456789:abcdefghijklmnopqrstuvwxyz123456',
    );

    expect(result).not.toContain('abc');
    expect(result).not.toContain('BearerSecret');
    expect(result).not.toContain('abcdefghijklmnopqrstuvwxyz');
  });

  it('does not serialize error messages that may contain secrets', () => {
    expect(redactValue(new Error('password=secret'))).toEqual({
      name: 'Error',
    });
  });
});
