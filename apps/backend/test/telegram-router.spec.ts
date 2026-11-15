import { describe, expect, it, vi } from 'vitest';

import type { ConsentGuard } from '../src/consent/consent.guard.js';
import type { ConsentService } from '../src/consent/consent.service.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import type { LanguageService } from '../src/onboarding/language.service.js';
import { NavigationMenuService } from '../src/onboarding/navigation-menu.service.js';
import type { OnboardingService } from '../src/onboarding/onboarding.service.js';
import type { TextTransactionService } from '../src/transactions/text-transaction.service.js';
import { TelegramUpdateRouterService } from '../src/telegram/telegram-update-router.service.js';
import type { TelegramUpdate } from '../src/telegram/telegram.types.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import type { UsersService } from '../src/users/users.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import type { CategoryRepository } from '../src/categories/category.repository.js';
import type { SmsReviewNotificationService } from '../src/notifications/sms-review-notification.service.js';

const messageUpdate = (text: string): TelegramUpdate => ({
  update_id: 1,
  message: {
    message_id: 10,
    date: 1_700_000_000,
    chat: { id: 200, type: 'private', first_name: 'Test' },
    from: { id: 100, is_bot: false, first_name: 'Test' },
    text,
  },
});

const voiceUpdate = (): TelegramUpdate => ({
  update_id: 4,
  message: {
    message_id: 13,
    date: 1_700_000_000,
    chat: { id: 200, type: 'private', first_name: 'Test' },
    from: { id: 100, is_bot: false, first_name: 'Test' },
    voice: {
      file_id: 'opaque-file-id',
      file_unique_id: 'opaque-unique-id',
      duration: 8,
      file_size: 1024,
    },
  },
});

const receiptUpdate = (): TelegramUpdate => ({
  update_id: 6,
  message: {
    message_id: 15,
    date: 1_700_000_000,
    chat: { id: 200, type: 'private', first_name: 'Test' },
    from: { id: 100, is_bot: false, first_name: 'Test' },
    photo: [
      {
        file_id: 'small-photo',
        file_unique_id: 'small-unique',
        width: 90,
        height: 90,
        file_size: 100,
      },
      {
        file_id: 'large-photo',
        file_unique_id: 'large-unique',
        width: 1280,
        height: 720,
        file_size: 2_000,
      },
    ],
  },
});

const groupMessageUpdate = (): TelegramUpdate => ({
  update_id: 5,
  message: {
    message_id: 14,
    date: 1_700_000_000,
    chat: { id: -200, type: 'group', title: 'Test Group' },
    from: { id: 100, is_bot: false, first_name: 'Test' },
    text: '/today',
  },
});

function createRouter(overrides: { active?: boolean; language?: 'AM' | 'EN' } = {}) {
  const transport = new RecordingTelegramTransport();
  const syncVerifiedTelegramProfile = vi.fn().mockResolvedValue({});
  const users = {
    findByTelegramId: vi.fn().mockResolvedValue(
      overrides.language
        ? {
            id: 'user-100',
            language: overrides.language,
            status: overrides.active ? 'ACTIVE' : 'PENDING_CONSENT',
            consentVersion: overrides.active ? 'test-v1' : null,
            consentAt: overrides.active ? new Date() : null,
          }
        : null,
    ),
    syncVerifiedTelegramProfile,
  } as unknown as UsersService;
  const consent = {
    isActive: vi.fn().mockReturnValue(Boolean(overrides.active)),
  } as unknown as ConsentService;
  const guard = {
    canAccess: vi.fn().mockResolvedValue(Boolean(overrides.active)),
  } as unknown as ConsentGuard;
  const start = vi.fn();
  const accept = vi.fn();
  const reviewConsent = vi.fn();
  const prompt = vi.fn();
  const change = vi.fn();
  const onboarding = { start, accept, reviewConsent } as unknown as OnboardingService;
  const language = { prompt, change } as unknown as LanguageService;
  const navigation = new NavigationMenuService(
    { get: vi.fn().mockReturnValue('https://miniapp.test') } as never,
    new I18nService(),
  );
  const log = vi.fn().mockResolvedValue(true);
  const requestUndo = vi.fn();
  const handleCallback = vi.fn().mockResolvedValue(true);
  const textTransactions = {
    log,
    requestUndo,
    handleCallback,
  } as unknown as TextTransactionService;
  const enqueue = vi.fn().mockResolvedValue(true);
  const enqueueReceipt = vi.fn().mockResolvedValue(true);
  const sendSummary = vi.fn();
  const showSettings = vi.fn();
  const applySettings = vi.fn();
  const requestDeletion = vi.fn();
  const handleDeletion = vi.fn().mockResolvedValue(true);
  const regenerateForUser = vi.fn().mockResolvedValue('newCd9');

  const findFirstInteraction = vi.fn();
  const updateManyInteraction = vi.fn().mockResolvedValue({ count: 1 });
  const upsertAndIncrementCategory = vi.fn();
  const sendNextPromptOrSummary = vi.fn();

  const mockPrisma = {
    pendingInteraction: {
      findFirst: findFirstInteraction,
      updateMany: updateManyInteraction,
      update: vi.fn().mockResolvedValue({}),
    },
    transactionGroup: { create: vi.fn().mockResolvedValue({ id: 'g-1' }) },
    transaction: { create: vi.fn().mockResolvedValue({ id: 't-1' }) },
    $transaction: vi.fn((cb: unknown) =>
      typeof cb === 'function'
        ? (cb as (db: unknown) => Promise<unknown>)({
            pendingInteraction: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
            transactionGroup: { create: vi.fn().mockResolvedValue({ id: 'g-1' }) },
            transaction: { create: vi.fn().mockResolvedValue({ id: 't-1' }) },
          })
        : Promise.all(cb as Promise<unknown>[]),
    ),
  } as unknown as PrismaService;

  const mockCategoryRepo = {
    upsertAndIncrement: upsertAndIncrementCategory,
    getUserCategories: vi.fn().mockResolvedValue([]),
  } as unknown as CategoryRepository;

  const mockSmsReview = {
    sendNextPromptOrSummary,
    sendReviewPrompt: vi.fn(),
    getPendingDrafts: vi.fn().mockResolvedValue([]),
  } as unknown as SmsReviewNotificationService;

  const mockBankBreakdown = {
    send: vi.fn(),
    sendByUserId: vi.fn(),
  };

  const mockDashboardRepo = {
    searchCandidates: vi.fn().mockResolvedValue([]),
    linkCandidate: vi.fn().mockResolvedValue({}),
    getBankBreakdown: vi.fn().mockResolvedValue({
      banks: [],
      other: { count: 0, totalEtb: 0 },
      totalCount: 0,
      totalEtb: 0,
    }),
  };

  const router = new TelegramUpdateRouterService(
    transport,
    new I18nService(),
    users,
    consent,
    guard,
    onboarding,
    language,
    navigation,
    textTransactions,
    { enqueue } as never,
    { enqueue: enqueueReceipt } as never,
    { send: sendSummary, editByUserId: vi.fn(), sendByUserId: vi.fn() } as never,
    mockBankBreakdown as never,
    mockDashboardRepo as never,
    { show: showSettings, apply: applySettings } as never,
    { request: requestDeletion, handle: handleDeletion } as never,
    { regenerateForUser } as never,
    { get: vi.fn().mockReturnValue('https://app.muday.et') } as never,
    mockPrisma,
    mockCategoryRepo,
    mockSmsReview,
  );
  return {
    router,
    transport,
    mockBankBreakdown,
    mockDashboardRepo,
    mockSmsReview,
    mockPrisma,
    start,
    reviewConsent,
    prompt,
    change,
    log,
    requestUndo,
    handleCallback,
    enqueue,
    enqueueReceipt,
    sendSummary,
    showSettings,
    applySettings,
    requestDeletion,
    handleDeletion,
    findFirstInteraction,
    updateManyInteraction,
    upsertAndIncrementCategory,
    sendNextPromptOrSummary,
    regenerateForUser,
    syncProfileMetadata: syncVerifiedTelegramProfile,
  };
}

describe('TelegramUpdateRouterService', () => {
  it('routes /start to onboarding', async () => {
    const { router, start, syncProfileMetadata } = createRouter();
    await router.route(messageUpdate('/start'));
    expect(start).toHaveBeenCalledWith(100, 200, 1);
    expect(syncProfileMetadata).toHaveBeenCalledWith(100, {
      firstName: 'Test',
      lastName: null,
      username: null,
    });
  });

  it('routes the highest-resolution receipt photo to the receipt queue', async () => {
    const { router, enqueueReceipt } = createRouter({ active: true, language: 'EN' });
    await router.route(receiptUpdate());
    expect(enqueueReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'large-photo',
        mimeType: 'image/jpeg',
        declaredFileSize: 2_000,
      }),
    );
  });

  it('routes /language before consent', async () => {
    const { router, prompt } = createRouter();
    await router.route(messageUpdate('/language'));
    expect(prompt).toHaveBeenCalledWith(100, 200);
  });

  it('returns pending help in Amharic for an unknown user', async () => {
    const { router, transport } = createRouter();
    await router.route(messageUpdate('/help'));
    expect(transport.messages[0]?.text).toContain('/start');
    expect(transport.messages[0]?.text).toContain('ሙዳይ');
  });

  it('blocks normal messages before consent', async () => {
    const { router, transport } = createRouter();
    await router.route(messageUpdate('private financial message'));
    expect(transport.messages[0]?.text).toContain('/start');
  });

  it('routes normal text to transaction logging after consent', async () => {
    const { router, log } = createRouter({ active: true, language: 'EN' });
    await expect(router.route(messageUpdate('I spent 250 birr on lunch'))).resolves.toBe(true);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ telegramId: 100, chatId: 200, updateId: 1, messageId: 10 }),
    );
  });

  it('queues a voice note after consent', async () => {
    const { router, enqueue } = createRouter({ active: true, language: 'EN' });
    await expect(router.route(voiceUpdate())).resolves.toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramId: 100,
        chatId: 200,
        updateId: 4,
        messageId: 13,
        fileId: 'opaque-file-id',
        durationSeconds: 8,
        declaredFileSize: 1024,
      }),
    );
  });

  it('routes /undo only for an active user', async () => {
    const { router, requestUndo } = createRouter({ active: true, language: 'EN' });
    await router.route(messageUpdate('/undo'));
    expect(requestUndo).toHaveBeenCalledWith(100, 200);
  });

  it.each([
    ['/today', 'today'],
    ['/week@MudayBot', 'week'],
    ['/month', 'month'],
  ] as const)('routes %s to the requested summary', async (command, period) => {
    const { router, sendSummary, log } = createRouter({ active: true, language: 'EN' });
    await router.route(messageUpdate(command));
    expect(sendSummary).toHaveBeenCalledWith(100, 200, period);
    expect(log).not.toHaveBeenCalled();
  });

  it('blocks summary commands before consent', async () => {
    const { router, sendSummary, transport } = createRouter();
    await router.route(messageUpdate('/today'));
    expect(sendSummary).not.toHaveBeenCalled();
    expect(transport.messages[0]?.text).toContain('/start');
  });

  it('opens settings for an active user', async () => {
    const { router, showSettings } = createRouter({ active: true, language: 'EN' });
    await router.route(messageUpdate('/settings'));
    expect(showSettings).toHaveBeenCalledWith(100, 200);
  });

  it('routes data deletion before consent', async () => {
    const { router, requestDeletion } = createRouter({ language: 'AM' });
    await router.route(messageUpdate('/deletemydata'));
    expect(requestDeletion).toHaveBeenCalledWith(100, 200);
  });

  it('rejects financial commands in group chats', async () => {
    const { router, transport, sendSummary } = createRouter({ active: true, language: 'EN' });
    await router.route(groupMessageUpdate());
    expect(sendSummary).not.toHaveBeenCalled();
    expect(transport.messages[0]?.text).toContain('private chat');
  });

  it('routes valid settings callbacks', async () => {
    const { router, applySettings, syncProfileMetadata } = createRouter({
      active: true,
      language: 'EN',
    });
    await router.route({
      update_id: 6,
      callback_query: {
        id: 'settings-callback',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'settings:morning:time:8',
        message: {
          message_id: 15,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    });
    expect(applySettings).toHaveBeenCalledWith(100, 200, {
      kind: 'time',
      target: 'morning',
      hour: 8,
    });
    expect(syncProfileMetadata).toHaveBeenCalledWith(100, {
      firstName: 'Test',
      lastName: null,
      username: null,
    });
  });

  it.each([
    ['nav:today', 'summary', 'today'],
    ['nav:week', 'summary', 'week'],
    ['nav:month', 'summary', 'month'],
    ['nav:settings', 'settings', undefined],
    ['nav:undo', 'undo', undefined],
  ] as const)('routes navigation callback %s', async (data, target, period) => {
    const { router, sendSummary, showSettings, requestUndo } = createRouter({
      active: true,
      language: 'EN',
    });
    await router.route({
      update_id: 8,
      callback_query: {
        id: `callback-${data}`,
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data,
        message: {
          message_id: 17,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    });

    if (target === 'summary') expect(sendSummary).toHaveBeenCalledWith(100, 200, period);
    if (target === 'settings') expect(showSettings).toHaveBeenCalledWith(100, 200);
    if (target === 'undo') expect(requestUndo).toHaveBeenCalledWith(100, 200);
  });

  it('keeps protected navigation buttons consent-gated', async () => {
    const { router, sendSummary, transport } = createRouter({ language: 'EN' });
    await router.route({
      update_id: 9,
      callback_query: {
        id: 'callback-nav-today',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'nav:today',
        message: {
          message_id: 18,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    });
    expect(sendSummary).not.toHaveBeenCalled();
    expect(transport.messages[0]?.text).toContain('/start');
  });

  it('answers and strictly routes language callbacks', async () => {
    const { router, transport, change } = createRouter();
    const update = {
      update_id: 2,
      callback_query: {
        id: 'callback-1',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'language:set:en',
        message: {
          message_id: 11,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    } as TelegramUpdate;
    await router.route(update);
    expect(transport.answeredCallbackQueryIds).toEqual(['callback-1']);
    expect(change).toHaveBeenCalledWith(100, 200, 'en');
  });

  it('routes the opaque consent review callback before acceptance', async () => {
    const { router, reviewConsent } = createRouter();
    await router.route({
      update_id: 10,
      callback_query: {
        id: 'callback-consent-review',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'consent:review:123e4567-e89b-42d3-a456-426614174000',
        message: {
          message_id: 19,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    });
    expect(reviewConsent).toHaveBeenCalledWith('123e4567-e89b-42d3-a456-426614174000', 100, 200);
  });

  it('answers and routes opaque Phase 4 callbacks', async () => {
    const { router, transport, handleCallback } = createRouter({ active: true, language: 'EN' });
    const update = {
      update_id: 3,
      callback_query: {
        id: 'callback-2',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'ix:123e4567-e89b-42d3-a456-426614174000:confirm',
        message: {
          message_id: 12,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    } as TelegramUpdate;
    await expect(router.route(update)).resolves.toBe(true);
    expect(transport.answeredCallbackQueryIds).toContain('callback-2');
    expect(handleCallback).toHaveBeenCalledWith(
      expect.objectContaining({ interactionId: '123e4567-e89b-42d3-a456-426614174000' }),
    );
  });

  it('answers and routes opaque deletion callbacks', async () => {
    const { router, transport, handleDeletion } = createRouter({ active: true, language: 'EN' });
    const update = {
      update_id: 7,
      callback_query: {
        id: 'delete-callback',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'delete:123e4567-e89b-42d3-a456-426614174000:permanent',
        message: {
          message_id: 16,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    } as TelegramUpdate;
    await expect(router.route(update)).resolves.toBe(true);
    expect(transport.answeredCallbackQueryIds).toContain('delete-callback');
    expect(handleDeletion).toHaveBeenCalledWith(
      '123e4567-e89b-42d3-a456-426614174000',
      'permanent',
      100,
      200,
      7,
    );
  });

  it('routes persistent reply keyboard button text presses in English', async () => {
    const { router, sendSummary } = createRouter({ active: true, language: 'EN' });
    await expect(router.route(messageUpdate('📊 Today'))).resolves.toBe(false);
    expect(sendSummary).toHaveBeenCalledWith(100, 200, 'today');
  });

  it('routes persistent reply keyboard button text presses in Amharic', async () => {
    const { router, sendSummary } = createRouter({ active: true, language: 'AM' });
    await expect(router.route(messageUpdate('📊 ዛሬ'))).resolves.toBe(false);
    expect(sendSummary).toHaveBeenCalledWith(100, 200, 'today');
  });

  it('routes /mycode command to confirmation prompt for active user', async () => {
    const { router, transport } = createRouter({ active: true, language: 'EN' });
    await expect(router.route(messageUpdate('/mycode'))).resolves.toBe(false);
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.text).toContain('sign you out of all mobile app sessions');
    expect(transport.messages[0]?.options?.inlineKeyboard?.[0]?.[0]).toMatchObject({
      callbackData: 'mycode:confirm',
    });
  });

  it('blocks /mycode command if user is not active', async () => {
    const { router, transport } = createRouter({ active: false, language: 'EN' });
    await expect(router.route(messageUpdate('/mycode'))).resolves.toBe(false);
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.text).toContain('complete your registration');
  });

  it('handles mycode:confirm callback by regenerating code and sending it', async () => {
    const { router, transport, regenerateForUser } = createRouter({ active: true, language: 'EN' });
    const update = {
      update_id: 10,
      callback_query: {
        id: 'mycode-confirm-cb',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'mycode:confirm',
        message: {
          message_id: 17,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    } as TelegramUpdate;
    await expect(router.route(update)).resolves.toBe(false);
    expect(regenerateForUser).toHaveBeenCalledWith('user-100');
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.text).toContain('<code>newCd9</code>');
    expect(transport.messages[0]?.options?.parseMode).toBe('HTML');
    const btn = transport.messages[0]?.options?.inlineKeyboard?.[0]?.[0];
    expect(btn && 'url' in btn ? btn.url : undefined).toBe('https://app.muday.et/auth?code=newCd9');
  });

  it('handles mycode:cancel callback by sending cancelled message', async () => {
    const { router, transport } = createRouter({ active: true, language: 'EN' });
    const update = {
      update_id: 11,
      callback_query: {
        id: 'mycode-cancel-cb',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'mycode:cancel',
        message: {
          message_id: 18,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    } as TelegramUpdate;
    await expect(router.route(update)).resolves.toBe(false);
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.text).toContain('Cancelled');
  });

  it('handles sms_cat callback by categorizing draft and requesting next prompt', async () => {
    const {
      router,
      transport,
      findFirstInteraction,
      upsertAndIncrementCategory,
      sendNextPromptOrSummary,
    } = createRouter({
      active: true,
      language: 'EN',
    });
    findFirstInteraction.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      userId: 'user-100',
      state: 'PENDING',
      payload: { amount: 350, bankSource: 'CBE', type: 'expense' },
      createdAt: new Date(),
    });

    const update = {
      update_id: 12,
      callback_query: {
        id: 'sms-cat-cb',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'sms_cat:11111111-1111-4111-8111-111111111111:food',
        message: {
          message_id: 19,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    } as TelegramUpdate;

    await expect(router.route(update)).resolves.toBe(true);
    expect(upsertAndIncrementCategory).toHaveBeenCalledWith('user-100', 'food', 'expense');
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.text).toContain('350.00 ETB saved under "Food"');
    expect(sendNextPromptOrSummary).toHaveBeenCalledWith('user-100', 100, 'en');
  });

  it('handles sms_cat callback gracefully when already categorized on mobile app', async () => {
    const { router, transport, findFirstInteraction, sendNextPromptOrSummary } = createRouter({
      active: true,
      language: 'EN',
    });
    findFirstInteraction.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      userId: 'user-100',
      state: 'RESOLVED', // Already resolved on mobile!
      payload: { amount: 350, bankSource: 'CBE', type: 'expense' },
      createdAt: new Date(),
    });

    const update = {
      update_id: 13,
      callback_query: {
        id: 'sms-cat-cb-2',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'sms_cat:11111111-1111-4111-8111-111111111111:food',
        message: {
          message_id: 20,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    } as TelegramUpdate;

    await expect(router.route(update)).resolves.toBe(false);
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.text).toContain('already categorized on the mobile app');
    expect(sendNextPromptOrSummary).toHaveBeenCalledWith('user-100', 100, 'en');
  });

  it('handles sms_dismiss callback by cancelling draft', async () => {
    const {
      router,
      transport,
      findFirstInteraction,
      updateManyInteraction,
      sendNextPromptOrSummary,
    } = createRouter({
      active: true,
      language: 'EN',
    });
    findFirstInteraction.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      userId: 'user-100',
      state: 'PENDING',
    });

    const update = {
      update_id: 14,
      callback_query: {
        id: 'sms-dismiss-cb',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'sms_dismiss:11111111-1111-4111-8111-111111111111',
        message: {
          message_id: 21,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    } as TelegramUpdate;

    await expect(router.route(update)).resolves.toBe(true);
    expect(updateManyInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '11111111-1111-4111-8111-111111111111', userId: 'user-100', state: 'PENDING' },
      }),
    );
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.text).toContain('Draft dismissed');
    expect(sendNextPromptOrSummary).toHaveBeenCalledWith('user-100', 100, 'en');
  });

  it('routes /banks command to bankBreakdown service', async () => {
    const { router, mockBankBreakdown } = createRouter({
      active: true,
      language: 'EN',
    });

    await expect(router.route(messageUpdate('/banks'))).resolves.toBe(false);
    expect(mockBankBreakdown.send).toHaveBeenCalledWith(100, 200, 'month');
  });

  it('routes /pending command to smsReviewNotification service', async () => {
    const { router, sendNextPromptOrSummary } = createRouter({
      active: true,
      language: 'EN',
    });

    await expect(router.route(messageUpdate('/pending'))).resolves.toBe(false);
    expect(sendNextPromptOrSummary).toHaveBeenCalledWith('user-100', 100, 'en');
  });

  it('routes /summary command to summaries service with month period', async () => {
    const { router, sendSummary } = createRouter({
      active: true,
      language: 'EN',
    });

    await expect(router.route(messageUpdate('/summary'))).resolves.toBe(false);
    expect(sendSummary).toHaveBeenCalledWith(100, 200, 'month');
  });

  it('routes summary:period:today callback to summaries.editByUserId', async () => {
    const { router } = createRouter({
      active: true,
      language: 'EN',
    });

    const update = {
      update_id: 15,
      callback_query: {
        id: 'summary-period-cb',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'summary:period:today',
        message: {
          message_id: 50,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    } as TelegramUpdate;

    await expect(router.route(update)).resolves.toBe(false);
  });

  it('handles match:link callback by linking candidate', async () => {
    const { router, mockDashboardRepo, transport, findFirstInteraction } = createRouter({
      active: true,
      language: 'EN',
    });

    findFirstInteraction.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      userId: 'user-100',
      state: 'PENDING',
      payload: {
        kind: 'confirm_smart_match',
        sourceUpdateId: 10,
        sourceMessageId: 20,
        messageAt: '2026-08-31T10:00:00.000Z',
        model: 'test-model',
        promptVersion: '1.0',
        source: 'text',
        transactions: [
          {
            kind: 'expense',
            direction: 'outflow',
            type: 'expense',
            amount: '350.00',
            currency: 'ETB',
            category: 'food_dining',
            note: 'Lunch',
            confidence: 0.95,
          },
        ],
        candidates: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            targetType: 'transaction',
            bankSource: 'Telebirr',
            amountEtb: '350.00',
            occurredAt: '2026-08-31T10:00:00.000Z',
          },
        ],
      },
    });

    const update = {
      update_id: 16,
      callback_query: {
        id: 'match-link-cb',
        chat_instance: 'instance',
        from: { id: 100, is_bot: false, first_name: 'Test' },
        data: 'match:link:0:22222222-2222-4222-8222-222222222222',
        message: {
          message_id: 55,
          date: 1_700_000_000,
          chat: { id: 200, type: 'private', first_name: 'Test' },
        },
      },
    } as TelegramUpdate;

    await expect(router.route(update)).resolves.toBe(true);
    expect(mockDashboardRepo.linkCandidate).toHaveBeenCalledWith('user-100', {
      targetId: '11111111-1111-4111-8111-111111111111',
      targetType: 'transaction',
      category: 'food_dining',
      note: 'Lunch',
      type: 'expense',
    });
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]?.text).toContain('Linked successfully');
  });
});
