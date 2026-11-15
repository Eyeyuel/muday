import { describe, expect, it } from 'vitest';

import { amCatalog } from '../src/i18n/catalogs/am.js';
import { enCatalog } from '../src/i18n/catalogs/en.js';
import { I18nService } from '../src/i18n/i18n.service.js';

describe('I18nService', () => {
  const i18n = new I18nService();

  it('keeps Amharic and English catalogs in exact parity', () => {
    expect(Object.keys(amCatalog).sort()).toEqual(Object.keys(enCatalog).sort());
  });

  it('defaults to Amharic and selects English explicitly', () => {
    expect(i18n.translate('welcome')).toBe(amCatalog.welcome);
    expect(i18n.translate('welcome', 'en')).toBe(enCatalog.welcome);
  });

  it('leaves missing interpolation parameters visible and deterministic', () => {
    expect(i18n.translate('welcome', 'en', { appName: 'Muday' })).toBe('Welcome to Muday.');
    expect(i18n.translate('welcome', 'en')).toBe('Welcome to {appName}.');
  });

  it('falls back safely for an invalid runtime key or locale', () => {
    expect(i18n.translate('missing.key' as never, 'invalid' as never)).toBe(
      amCatalog['error.generic'],
    );
  });
});
