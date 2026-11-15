import { describe, expect, it } from 'vitest';

import { I18nService } from '../src/i18n/i18n.service.js';

describe('voice provider consent disclosure', () => {
  const i18n = new I18nService();

  it('names Hasab transcription and Gemini extraction in English', () => {
    const consent = i18n.translate('consent.text', 'en', { consentVersion: 'test-version' });

    expect(consent).toContain('Hasab AI for speech-to-text transcription');
    expect(consent).toContain('transcript is then sent to Google Gemini');
    expect(consent).toContain('does not intentionally retain transcripts');
    expect(consent).toContain('provider-retention and privacy/legal review');
  });

  it('names both providers and the transcript handoff in draft Amharic copy', () => {
    const consent = i18n.translate('consent.text', 'am', { consentVersion: 'test-version' });

    expect(consent).toContain('Hasab AI');
    expect(consent).toContain('Google Gemini');
    expect(consent).toContain('ከHasab AI የተመለሰው ጽሑፍ');
    expect(consent).toContain('የግላዊነት/ሕግ ግምገማ');
  });
});
