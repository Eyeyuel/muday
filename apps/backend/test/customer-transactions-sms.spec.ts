import { describe, expect, it, vi } from 'vitest';
import { CustomerTransactionsController } from '../src/customer-api/customer-transactions.controller.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import type { CategoryRepository } from '../src/categories/category.repository.js';
import type { TextTransactionService } from '../src/transactions/text-transaction.service.js';
import type { IdempotencyService } from '../src/idempotency/idempotency.service.js';
import type { CustomerJwtPayload } from '../src/customer-auth/customer-session-types.js';
import type { SmsQueueService } from '../src/sms/sms-queue.service.js';
import { SmsProcessingService } from '../src/sms/sms-processing.service.js';
import { InteractionKind, InteractionState } from '../src/generated/prisma/client.js';
import type { StructuredLogger } from '../src/observability/structured-logger.service.js';

describe('CustomerTransactionsController - Bank SMS Sync', () => {
  const customer: CustomerJwtPayload = {
    sub: 'user-uuid-1',
    sid: 'session-uuid-1',
    role: 'customer',
    iss: 'muday-api',
    aud: 'muday-customer',
    iat: 1_700_000_000,
    exp: 1_700_001_000,
  };

  it('enqueues SMS batch to background queue via SmsQueueService', async () => {
    const enqueueBatchMock = vi.fn().mockResolvedValue({
      success: true,
      jobId: 'job-123',
      count: 3,
    });
    const smsQueueService = {
      enqueueBatch: enqueueBatchMock,
    } as unknown as SmsQueueService;

    const controller = new CustomerTransactionsController(
      {} as unknown as PrismaService,
      {} as unknown as TextTransactionService,
      {} as unknown as IdempotencyService,
      {} as unknown as CategoryRepository,
      smsQueueService,
    );

    const result = await controller.saveBankSms(customer, {
      messages: [
        {
          amount: 500,
          category: 'food',
          bankSource: 'CBE',
          smsId: 'msg-1',
        },
        {
          amount: 250,
          category: 'uncategorized',
          bankSource: 'Telebirr',
          smsId: 'msg-2',
        },
        {
          amount: 100,
          bankSource: 'Awash',
          smsId: 'msg-3',
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.processed).toBe(3);
    expect(result.status).toBe('queued');
    expect(result.jobId).toBe('job-123');
    expect(enqueueBatchMock).toHaveBeenCalledWith(
      customer.sub,
      expect.arrayContaining([
        expect.objectContaining({ amount: 500, bankSource: 'CBE' }),
        expect.objectContaining({ amount: 250, bankSource: 'Telebirr' }),
        expect.objectContaining({ amount: 100, bankSource: 'Awash' }),
      ]),
    );
  });
});

describe('SmsProcessingService - Background Batch Processing', () => {
  const logger = { log: vi.fn(), error: vi.fn() } as unknown as StructuredLogger;

  it('saves categorized SMS directly to ledger and uncategorized SMS as pending drafts', async () => {
    const createdOperations: Array<{ type: string; data: unknown }> = [];
    const prisma = {
      transactionGroup: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation((data: unknown) => {
          createdOperations.push({ type: 'GROUP', data });
          return data;
        }),
      },
      pendingInteraction: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation((data: unknown) => {
          createdOperations.push({ type: 'DRAFT', data });
          return data;
        }),
      },
      $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;

    const processing = new SmsProcessingService(prisma, logger);

    const result = await processing.processBatch({
      userId: 'user-uuid-1',
      enqueuedAt: new Date().toISOString(),
      messages: [
        {
          amount: 500,
          category: 'food', // Categorized
          bankSource: 'CBE',
          smsId: 'msg-1',
        },
        {
          amount: 250,
          category: 'uncategorized', // Uncategorized
          bankSource: 'Telebirr',
          smsId: 'msg-2',
        },
        {
          amount: 100, // No category provided
          bankSource: 'Awash',
          smsId: 'msg-3',
        },
      ],
    });

    expect(result.processed).toBe(3);
    expect(result.saved).toBe(1); // 1 direct transaction
    expect(result.drafts).toBe(2); // 2 pending drafts
    expect(result.duplicates).toBe(0);

    // Verify operations
    expect(createdOperations).toHaveLength(3);
    expect(createdOperations[0]?.type).toBe('GROUP');
    expect(createdOperations[1]?.type).toBe('DRAFT');
    const draft1 = createdOperations[1]?.data as {
      data: { kind: InteractionKind; state: InteractionState };
    };
    expect(draft1.data.kind).toBe(InteractionKind.CLARIFY_FINANCIAL);
    expect(draft1.data.state).toBe(InteractionState.PENDING);
    expect(createdOperations[2]?.type).toBe('DRAFT');
  });

  it('deduplicates incoming SMS against existing groups and pending drafts', async () => {
    const prisma = {
      transactionGroup: {
        findMany: vi.fn().mockResolvedValue([{ rawTranscript: 'SMS:CBE:existing-sms-1' }]),
        create: vi.fn(),
      },
      pendingInteraction: {
        findMany: vi.fn().mockResolvedValue([{ payload: { smsId: 'existing-draft-2' } }]),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;

    const processing = new SmsProcessingService(prisma, logger);

    const result = await processing.processBatch({
      userId: 'user-uuid-1',
      enqueuedAt: new Date().toISOString(),
      messages: [
        { amount: 500, smsId: 'existing-sms-1' }, // Duplicate with ledger
        { amount: 250, smsId: 'existing-draft-2' }, // Duplicate with pending draft
        { amount: 100, smsId: 'new-sms-3' }, // Fresh SMS
        { amount: 100, smsId: 'new-sms-3' }, // Duplicate in same batch
      ],
    });

    expect(result.processed).toBe(4);
    expect(result.drafts).toBe(1);
    expect(result.duplicates).toBe(3);
  });
});
