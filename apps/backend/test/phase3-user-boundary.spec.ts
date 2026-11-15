import { describe, expect, it, vi } from 'vitest';

import type { ConfigService } from '@nestjs/config';

import type { ConsentRepository } from '../src/consent/consent.repository.js';
import { ConsentService } from '../src/consent/consent.service.js';
import type { Environment } from '../src/config/environment.js';
import type { I18nService } from '../src/i18n/i18n.service.js';
import type { TelegramIdentityResolver } from '../src/identity/telegram-identity-resolver.service.js';
import type { NotificationSettingsRepository } from '../src/notifications/notification-settings.repository.js';
import { NotificationSettingsService } from '../src/notifications/notification-settings.service.js';
import type { SummaryRepository } from '../src/summaries/summary.repository.js';
import { SummaryService } from '../src/summaries/summary.service.js';
import type { TelegramTransport } from '../src/telegram/transport/telegram-transport.interface.js';
import type { UserRepository } from '../src/users/user.repository.js';
import { UsersService } from '../src/users/users.service.js';

describe('Phase 3 User-ID Boundary and Ownership Tests', () => {
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'CONSENT_VERSION') return 'v1';
      return undefined;
    }),
  } as unknown as ConfigService<Environment, true>;

  describe('ConsentService boundary', () => {
    it('scopes isActive consent checks strictly by user consentAt and version', () => {
      const mockRepo = {} as unknown as ConsentRepository;
      const service = new ConsentService(mockRepo, config);

      const activeUser = { status: 'ACTIVE', consentVersion: 'v1', consentAt: new Date() };
      const nonConsentedUser = { status: 'ACTIVE', consentVersion: null, consentAt: null };

      expect(service.isActive(activeUser)).toBe(true);
      expect(service.isActive(nonConsentedUser)).toBe(false);
    });

    it('records consent acceptances by userId', async () => {
      const acceptFn = vi.fn(() => Promise.resolve('accepted' as const));
      const mockRepo = {
        acceptByUserId: acceptFn,
      } as unknown as ConsentRepository;

      const service = new ConsentService(mockRepo, config);
      const record = await service.acceptByUserId('interaction-1', 'user-a');

      expect(record).toBe('accepted');
      expect(acceptFn).toHaveBeenCalledWith('interaction-1', 'user-a', 'v1');
      expect(acceptFn).not.toHaveBeenCalledWith('interaction-1', 'user-b', 'v1');
    });
  });

  describe('NotificationSettingsService boundary', () => {
    it('scopes showByUserId and applyByUserId strictly by userId', async () => {
      const mockUserA = {
        id: 'user-a',
        status: 'ACTIVE',
        language: 'AM',
        morningEnabled: true,
        morningTime: new Date('2026-08-20T08:00:00Z'),
        nightEnabled: true,
        nightTime: new Date('2026-08-20T20:00:00Z'),
      };
      const findByIdFn = vi.fn((userId: string) =>
        Promise.resolve(userId === 'user-a' ? mockUserA : null),
      );
      const mockUsersService = {
        findById: findByIdFn,
      } as unknown as UsersService;

      const mockRepo = {} as unknown as NotificationSettingsRepository;
      const mockI18n = { translate: vi.fn(() => 'settings text') } as unknown as I18nService;
      const sendMessageFn = vi.fn(() => Promise.resolve());
      const mockTransport = { sendMessage: sendMessageFn } as unknown as TelegramTransport;

      const service = new NotificationSettingsService(
        mockUsersService,
        mockRepo,
        mockI18n,
        mockTransport,
      );

      await service.showByUserId('user-a', 1001);
      expect(sendMessageFn).toHaveBeenCalledWith(1001, expect.any(String), expect.anything());

      await service.showByUserId('user-b', 1001);
      expect(findByIdFn).toHaveBeenCalledWith('user-b');
    });
  });

  describe('SummaryService boundary', () => {
    it('calculates summaries strictly for the specified userId', async () => {
      const mockRepo = {
        listActiveTransactions: (userId: string) =>
          Promise.resolve(
            userId === 'user-a'
              ? [
                  { kind: 'income', amount: '1000.00', category: 'OTHER_EXPENSE' },
                  { kind: 'expense', amount: '250.00', category: 'OTHER_EXPENSE' },
                ]
              : [],
          ),
      } as unknown as SummaryRepository;

      const service = new SummaryService(mockRepo);

      const summaryA = await service.get('user-a', 'today');
      expect(summaryA.incomeCents).toBe(100000n);
      expect(summaryA.expenseCents).toBe(25000n);

      const summaryB = await service.get('user-b', 'today');
      expect(summaryB.incomeCents).toBe(0n);
      expect(summaryB.expenseCents).toBe(0n);
    });
  });

  describe('UsersService boundary', () => {
    it('updates language preference strictly by userId', async () => {
      const setLanguageFn = vi.fn((userId: string, language: 'AM' | 'EN') =>
        Promise.resolve({
          id: userId,
          language,
        }),
      );
      const mockUserRepo = {
        setLanguage: setLanguageFn,
      } as unknown as UserRepository;

      const mockResolver = {} as unknown as TelegramIdentityResolver;
      const usersService = new UsersService(mockUserRepo, mockResolver);
      const updated = await usersService.changeLanguageByUserId('user-a', 'en');

      expect(updated.id).toBe('user-a');
      expect(updated.language).toBe('EN');
      expect(setLanguageFn).toHaveBeenCalledWith('user-a', 'EN');
      expect(setLanguageFn).not.toHaveBeenCalledWith('user-b', 'EN');
    });
  });
});
