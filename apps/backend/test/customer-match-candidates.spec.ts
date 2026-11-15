import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CustomerTransactionsController } from '../src/customer-api/customer-transactions.controller.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import type { CategoryRepository } from '../src/categories/category.repository.js';
import type { TextTransactionService } from '../src/transactions/text-transaction.service.js';
import type { IdempotencyService } from '../src/idempotency/idempotency.service.js';
import type { CustomerJwtPayload } from '../src/customer-auth/customer-session-types.js';
import type { SmsQueueService } from '../src/sms/sms-queue.service.js';
import type { DashboardRepository } from '../src/dashboard/dashboard.repository.js';

describe('CustomerTransactionsController - Smart Match Candidates & Linkage', () => {
  const customer: CustomerJwtPayload = {
    sub: 'user-customer-123',
    sid: 'session-uuid-1',
    role: 'customer',
    iss: 'muday-api',
    aud: 'muday-customer',
    iat: 1_700_000_000,
    exp: 1_700_001_000,
  };

  it('delegates findMatchCandidates query to dashboard repository with authenticated userId', async () => {
    const mockFindMatchCandidates = vi.fn().mockResolvedValue([
      {
        id: 'draft-uuid-1',
        targetType: 'pending_interaction',
        amountEtb: '250.00',
        type: 'expense',
        category: 'uncategorized',
        note: null,
        bankSource: 'TELEBIRR',
        occurredAt: '2026-08-30T10:00:00.000Z',
      },
    ]);

    const dashboardRepository = {
      findMatchCandidates: mockFindMatchCandidates,
    } as unknown as DashboardRepository;

    const controller = new CustomerTransactionsController(
      {} as unknown as PrismaService,
      {} as unknown as TextTransactionService,
      {} as unknown as IdempotencyService,
      {} as unknown as CategoryRepository,
      {} as unknown as SmsQueueService,
      dashboardRepository,
    );

    const result = await controller.findMatchCandidates(customer, {
      amountEtb: '250.00',
      type: 'expense',
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.bankSource).toBe('TELEBIRR');
    expect(mockFindMatchCandidates).toHaveBeenCalledWith(customer.sub, {
      amountEtb: '250.00',
      type: 'expense',
    });
  });

  it('links a candidate successfully via dashboard repository', async () => {
    const mockLinkCandidate = vi.fn().mockResolvedValue({
      id: 'tx-uuid-1',
      amountEtb: '250.00',
      category: 'food_groceries',
      type: 'expense',
      note: 'Lunch at cafe',
      occurredAt: '2026-08-30T10:00:00.000Z',
      linked: true,
    });

    const dashboardRepository = {
      linkCandidate: mockLinkCandidate,
    } as unknown as DashboardRepository;

    const controller = new CustomerTransactionsController(
      {} as unknown as PrismaService,
      {} as unknown as TextTransactionService,
      {} as unknown as IdempotencyService,
      {} as unknown as CategoryRepository,
      {} as unknown as SmsQueueService,
      dashboardRepository,
    );

    const result = await controller.linkCandidate(customer, {
      targetId: 'draft-uuid-1',
      targetType: 'pending_interaction',
      category: 'food_groceries',
      note: 'Lunch at cafe',
      type: 'expense',
    });

    expect(result.linked).toBe(true);
    expect(result.category).toBe('food_groceries');
    expect(mockLinkCandidate).toHaveBeenCalledWith(customer.sub, {
      targetId: 'draft-uuid-1',
      targetType: 'pending_interaction',
      category: 'food_groceries',
      note: 'Lunch at cafe',
      type: 'expense',
    });
  });

  it('throws NotFoundException when candidate is not found or belongs to another user', async () => {
    const mockLinkCandidate = vi.fn().mockResolvedValue(null);

    const dashboardRepository = {
      linkCandidate: mockLinkCandidate,
    } as unknown as DashboardRepository;

    const controller = new CustomerTransactionsController(
      {} as unknown as PrismaService,
      {} as unknown as TextTransactionService,
      {} as unknown as IdempotencyService,
      {} as unknown as CategoryRepository,
      {} as unknown as SmsQueueService,
      dashboardRepository,
    );

    await expect(
      controller.linkCandidate(customer, {
        targetId: 'non-existent-id',
        targetType: 'pending_interaction',
        category: 'food_groceries',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
