import { describe, expect, it, vi } from 'vitest';
import { SmsReviewNotificationService } from '../src/notifications/sms-review-notification.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import type { CategoryRepository } from '../src/categories/category.repository.js';
import type {
  TelegramSendOptions,
  TelegramTransport,
} from '../src/telegram/transport/telegram-transport.interface.js';
import {
  InteractionKind,
  InteractionState,
  type PendingInteraction,
} from '../src/generated/prisma/client.js';

describe('SmsReviewNotificationService', () => {
  const sampleDraft: PendingInteraction = {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'user-1',
    kind: InteractionKind.CLARIFY_FINANCIAL,
    state: InteractionState.PENDING,
    payload: {
      amount: 450,
      type: 'expense',
      bankSource: 'CBE',
      occurredAt: '2026-08-28T14:30:00.000Z',
      smsId: 'cbe-123',
    },
    sourceUpdateId: null,
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date('2026-08-28T14:30:00.000Z'),
    resolvedAt: null,
  };

  it('builds category keyboard with user top dynamic categories', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const transport = { sendMessage } as unknown as TelegramTransport;
    const prisma = {
      pendingInteraction: {
        findMany: vi.fn().mockResolvedValue([sampleDraft]),
      },
    } as unknown as PrismaService;
    const categoryRepository = {
      getUserCategories: vi.fn().mockResolvedValue([
        { label: 'custom_dinner', type: 'expense' },
        { label: 'food', type: 'expense' },
      ]),
    } as unknown as CategoryRepository;

    const service = new SmsReviewNotificationService(prisma, categoryRepository, transport);

    await service.sendReviewPrompt('user-1', 12345, 'en', sampleDraft, 1, 3);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [chatId, text, options] = sendMessage.mock.calls[0] as [
      number,
      string,
      TelegramSendOptions | undefined,
    ];
    expect(chatId).toBe(12345);
    expect(text).toContain('CBE Bank SMS (1 of 3)');
    expect(text).toContain('450.00 ETB (Expense)');
    expect(options?.inlineKeyboard).toBeDefined();

    // Check that custom_dinner and food appear in the inline keyboard buttons
    const flatButtons = options?.inlineKeyboard?.flat() ?? [];
    const customButton = flatButtons.find(
      (b) => 'callbackData' in b && b.callbackData === `sms_cat:${sampleDraft.id}:custom_dinner`,
    );
    expect(customButton).toBeDefined();
    expect(customButton?.text).toContain('Custom dinner');

    // Check dismiss button
    const dismissButton = flatButtons.find(
      (b) => 'callbackData' in b && b.callbackData === `sms_dismiss:${sampleDraft.id}`,
    );
    expect(dismissButton).toBeDefined();
  });

  it('formats messages in Amharic when locale is am', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const transport = { sendMessage } as unknown as TelegramTransport;
    const prisma = {} as unknown as PrismaService;
    const categoryRepository = {
      getUserCategories: vi.fn().mockResolvedValue([]),
    } as unknown as CategoryRepository;

    const service = new SmsReviewNotificationService(prisma, categoryRepository, transport);

    await service.sendReviewPrompt('user-1', 12345, 'am', sampleDraft, 1, 1);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [, text, options] = sendMessage.mock.calls[0] as [
      number,
      string,
      TelegramSendOptions | undefined,
    ];
    expect(text).toContain('CBE የባንክ መልዕክት');
    expect(text).toContain('450.00 ETB (ወጪ)');
    expect(text).toContain('ይህ ወጪ ለምን ነበር?');

    // Verify Amharic buttons
    const flatButtons = options?.inlineKeyboard?.flat() ?? [];
    const foodButton = flatButtons.find(
      (b) => 'callbackData' in b && b.callbackData === `sms_cat:${sampleDraft.id}:food`,
    );
    expect(foodButton).toBeDefined();
    expect(foodButton?.text).toContain('ምግብ');

    const dismissButton = flatButtons.find(
      (b) => 'callbackData' in b && b.callbackData === `sms_dismiss:${sampleDraft.id}`,
    );
    expect(dismissButton?.text).toContain('ሰርዝ');
  });

  it('sends completion message when all drafts are categorized', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const transport = { sendMessage } as unknown as TelegramTransport;
    const prisma = {
      pendingInteraction: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    const categoryRepository = {} as unknown as CategoryRepository;

    const service = new SmsReviewNotificationService(prisma, categoryRepository, transport);

    await service.sendNextPromptOrSummary('user-1', 12345, 'en');

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [, text] = sendMessage.mock.calls[0] as [number, string, TelegramSendOptions | undefined];
    expect(text).toContain('All caught up!');
  });
});
