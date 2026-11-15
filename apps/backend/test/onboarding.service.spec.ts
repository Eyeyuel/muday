import { describe, expect, it, vi } from 'vitest';

import type { ConsentService } from '../src/consent/consent.service.js';
import type { AppCodeService } from '../src/customer-auth/app-code.service.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import { OnboardingService } from '../src/onboarding/onboarding.service.js';
import { NavigationMenuService } from '../src/onboarding/navigation-menu.service.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import type { UsersService } from '../src/users/users.service.js';

describe('OnboardingService', () => {
  const navigation = new NavigationMenuService(
    { get: vi.fn().mockReturnValue('') } as never,
    new I18nService(),
  );

  const mockAppCodeService = {
    generateForUser: vi.fn().mockResolvedValue('aB3kX9'),
  } as unknown as AppCodeService;

  const mockConfig = {
    get: vi.fn().mockReturnValue('https://app.muday.et'),
  } as never;

  it('shows language choice prompt immediately to a new pending user', async () => {
    const transport = new RecordingTelegramTransport();
    const users = {
      findOrCreate: vi.fn().mockResolvedValue({
        user: { id: 'user-id', language: 'AM', status: 'PENDING_CONSENT' },
        created: true,
      }),
    } as unknown as UsersService;
    const consent = {
      isActive: vi.fn().mockReturnValue(false),
    } as unknown as ConsentService;
    const service = new OnboardingService(
      users,
      consent,
      new I18nService(),
      transport,
      navigation,
      mockAppCodeService,
      mockConfig,
    );

    await service.start(100, 200, 300);

    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.text).toContain('Welcome to Muday!');
    expect(transport.messages[0]?.options?.inlineKeyboard?.[0]).toHaveLength(2);
    const btn1 = transport.messages[0]?.options?.inlineKeyboard?.[0]?.[0];
    const btn2 = transport.messages[0]?.options?.inlineKeyboard?.[0]?.[1];
    expect(btn1 && 'callbackData' in btn1 ? btn1.callbackData : undefined).toBe('language:set:am');
    expect(btn2 && 'callbackData' in btn2 ? btn2.callbackData : undefined).toBe('language:set:en');
  });

  it('does not repeat consent for an active user on the current version', async () => {
    const transport = new RecordingTelegramTransport();
    const users = {
      findOrCreate: vi.fn().mockResolvedValue({
        user: { id: 'user-id', language: 'EN', status: 'ACTIVE' },
        created: false,
      }),
    } as unknown as UsersService;
    const createInteraction = vi.fn();
    const consent = {
      isActive: vi.fn().mockReturnValue(true),
      createInteraction,
    } as unknown as ConsentService;
    const service = new OnboardingService(
      users,
      consent,
      new I18nService(),
      transport,
      navigation,
      mockAppCodeService,
      mockConfig,
    );

    await service.start(100, 200, 300);

    expect(createInteraction).not.toHaveBeenCalled();
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.text).toContain('Welcome back');
    expect(transport.messages[0]?.text).toContain('receipt photo');
    const button = transport.messages[0]?.options?.replyKeyboard?.[0]?.[0];
    expect(button && 'text' in button ? button.text : undefined).toBe('📊 Today');
  });

  it('shows the versioned consent only after the user requests to review it', async () => {
    const transport = new RecordingTelegramTransport();
    const users = {
      findByTelegramId: vi.fn().mockResolvedValue({ language: 'EN' }),
    } as unknown as UsersService;
    const consent = { version: 'test-v1' } as ConsentService;
    const service = new OnboardingService(
      users,
      consent,
      new I18nService(),
      transport,
      navigation,
      mockAppCodeService,
      mockConfig,
    );
    await service.reviewConsent('123e4567-e89b-42d3-a456-426614174000', 100, 200);
    expect(transport.messages[0]?.text).toContain('version test-v1');
    const button = transport.messages[0]?.options?.inlineKeyboard?.[0]?.[0];
    expect(button && 'callbackData' in button ? button.callbackData : undefined).toContain(
      'consent:accept:',
    );
  });

  it('generates pairing code and sends it in follow-up message when onboarding is accepted', async () => {
    const transport = new RecordingTelegramTransport();
    const users = {
      findById: vi.fn().mockResolvedValue({ id: 'user-id-123', language: 'EN', status: 'ACTIVE' }),
    } as unknown as UsersService;
    const consent = {
      acceptByUserId: vi.fn().mockResolvedValue('accepted'),
    } as unknown as ConsentService;
    const generateForUser = vi.fn().mockResolvedValue('Xy79K2');
    const appCodeService = { generateForUser } as unknown as AppCodeService;

    const service = new OnboardingService(
      users,
      consent,
      new I18nService(),
      transport,
      navigation,
      appCodeService,
      mockConfig,
    );

    await service.acceptByUserId('interaction-1', 'user-id-123', 200);

    expect(generateForUser).toHaveBeenCalledWith('user-id-123');
    expect(transport.messages).toHaveLength(2);
    expect(transport.messages[0]?.text).toContain('<code>Xy79K2</code>');
    expect(transport.messages[0]?.options?.parseMode).toBe('HTML');
    const btn = transport.messages[0]?.options?.inlineKeyboard?.[0]?.[0];
    expect(btn && 'url' in btn ? btn.url : undefined).toBe('https://app.muday.et/auth?code=Xy79K2');
    expect(transport.messages[1]?.text).toContain('ready to use Muday');
  });

  it('encodes special characters in the code when constructing the deep link URL', async () => {
    const transport = new RecordingTelegramTransport();
    const users = {
      findById: vi.fn().mockResolvedValue({ id: 'user-id-123', language: 'EN', status: 'ACTIVE' }),
    } as unknown as UsersService;
    const consent = {
      acceptByUserId: vi.fn().mockResolvedValue('accepted'),
    } as unknown as ConsentService;
    const generateForUser = vi.fn().mockResolvedValue('a+B/9=');
    const appCodeService = { generateForUser } as unknown as AppCodeService;

    const service = new OnboardingService(
      users,
      consent,
      new I18nService(),
      transport,
      navigation,
      appCodeService,
      mockConfig,
    );

    await service.acceptByUserId('interaction-1', 'user-id-123', 200);

    expect(transport.messages).toHaveLength(2);
    const btn = transport.messages[0]?.options?.inlineKeyboard?.[0]?.[0];
    expect(btn && 'url' in btn ? btn.url : undefined).toBe(
      'https://app.muday.et/auth?code=a%2BB%2F9%3D',
    );
  });
});
