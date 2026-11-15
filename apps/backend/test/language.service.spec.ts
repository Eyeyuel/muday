import { describe, expect, it, vi } from 'vitest';

import type { ConsentService } from '../src/consent/consent.service.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import { LanguageService } from '../src/onboarding/language.service.js';
import type { NavigationMenuService } from '../src/onboarding/navigation-menu.service.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import type { UsersService } from '../src/users/users.service.js';

describe('LanguageService', () => {
  it('offers both languages before consent and confirms in the selected language', async () => {
    const transport = new RecordingTelegramTransport();
    const changeLanguage = vi.fn().mockResolvedValue({
      language: 'EN',
      status: 'PENDING_CONSENT',
      consentVersion: null,
      consentAt: null,
    });
    const users = {
      findOrCreate: vi.fn().mockResolvedValue({
        user: { id: 'user-id', language: 'AM', status: 'PENDING_CONSENT' },
        created: true,
      }),
      changeLanguage,
      changeLanguageByUserId: changeLanguage,
    } as unknown as UsersService;
    const navigation = {
      keyboard: vi.fn().mockReturnValue([[{ text: '📊 Today', callbackData: 'nav:today' }]]),
    } as unknown as NavigationMenuService;
    const consent = {
      isActive: vi.fn().mockReturnValue(false),
      createInteraction: vi.fn().mockResolvedValue({ id: 'interaction-123' }),
      version: 'v1.0',
    } as unknown as ConsentService;
    const service = new LanguageService(users, new I18nService(), transport, navigation, consent);

    await service.prompt(100, 200);
    await service.change(100, 200, 'en');

    expect(transport.messages[0]?.options?.inlineKeyboard?.[0]).toHaveLength(2);
    expect(changeLanguage).toHaveBeenCalledWith('user-id', 'en');
    expect(transport.messages[1]?.text).toContain('Privacy');
    const button = transport.messages[1]?.options?.inlineKeyboard?.[0]?.[0];
    expect(button && 'callbackData' in button ? button.callbackData : undefined).toBe(
      'consent:accept:interaction-123',
    );
  });
});
