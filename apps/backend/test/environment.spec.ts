import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../src/config/environment.js';

describe('environment validation', () => {
  it('uses free local defaults', () => {
    const environment = validateEnvironment({});

    expect(environment.STT_PROVIDER).toBe('fake');
    expect(environment.EXTRACTION_PROVIDER).toBe('rule');
    expect(environment.ALLOW_LOCAL_DEV_AUTH).toBe(false);
    expect(environment.FFPROBE_PATH).toBe('/usr/bin/ffprobe');
    expect(environment.GEMINI_MAX_INLINE_AUDIO_BYTES).toBe(12_000_000);
    expect(environment.HASAB_MAX_RETRIES).toBe(2);
    expect(environment.HASAB_RETRY_BASE_DELAY_MS).toBe(250);
    expect(environment.HASAB_MAX_RESPONSE_BYTES).toBe(1_000_000);
  });

  it('rejects local authentication in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        ALLOW_LOCAL_DEV_AUTH: 'true',
      }),
    ).toThrow();
  });

  it('requires an independent admin, customer, and app code secret in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        ADMIN_JWT_SECRET: 'a'.repeat(32),
        CUSTOMER_JWT_SECRET: 'c'.repeat(32),
        APP_CODE_PEPPER: 'p'.repeat(32),
      }),
    ).not.toThrow();
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow();
  });

  it('accepts only Telegram-supported webhook secret characters', () => {
    expect(() =>
      validateEnvironment({ TELEGRAM_WEBHOOK_SECRET: 'safe_secret-123456' }),
    ).not.toThrow();
    expect(() =>
      validateEnvironment({ TELEGRAM_WEBHOOK_SECRET: 'unsafe/secret+value=' }),
    ).toThrow();
  });

  it('requires a Gemini key and provider for direct voice extraction', () => {
    expect(() =>
      validateEnvironment({ VOICE_EXTRACTION_MODE: 'direct', EXTRACTION_PROVIDER: 'gemini' }),
    ).toThrow();
    expect(() =>
      validateEnvironment({
        VOICE_EXTRACTION_MODE: 'direct',
        EXTRACTION_PROVIDER: 'rule',
        GEMINI_API_KEY: 'test-key',
      }),
    ).toThrow();
    expect(
      validateEnvironment({
        VOICE_EXTRACTION_MODE: 'direct',
        EXTRACTION_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'test-key',
      }).GEMINI_MODEL,
    ).toBe('gemini-3.6-flash');
  });

  it('accepts the Hasab STT followed by Gemini extraction configuration', () => {
    const environment = validateEnvironment({
      VOICE_EXTRACTION_MODE: 'stt_then_extract',
      STT_PROVIDER: 'hasab',
      STT_MODEL: 'hasab-transcription-v1',
      HASAB_API_KEY: 'hasab-test-key',
      EXTRACTION_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'gemini-test-key',
    });

    expect(environment.VOICE_EXTRACTION_MODE).toBe('stt_then_extract');
    expect(environment.STT_PROVIDER).toBe('hasab');
    expect(environment.EXTRACTION_PROVIDER).toBe('gemini');
  });

  it('rejects the Hasab and Gemini pipeline when either required key is missing', () => {
    expect(() =>
      validateEnvironment({
        VOICE_EXTRACTION_MODE: 'stt_then_extract',
        STT_PROVIDER: 'hasab',
        EXTRACTION_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'gemini-test-key',
      }),
    ).toThrow();

    expect(() =>
      validateEnvironment({
        VOICE_EXTRACTION_MODE: 'stt_then_extract',
        STT_PROVIDER: 'hasab',
        HASAB_API_KEY: 'hasab-test-key',
        EXTRACTION_PROVIDER: 'gemini',
      }),
    ).toThrow();
  });
});
