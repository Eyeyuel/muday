import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAiToolsService } from '../src/admin-ai/admin-ai-tools.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';

describe('AdminAiToolsService', () => {
  let service: AdminAiToolsService;
  let mockPrisma: {
    transaction: {
      groupBy: ReturnType<typeof vi.fn>;
      aggregate: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    transactionGroup: {
      groupBy: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      transaction: {
        groupBy: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
      },
      transactionGroup: {
        groupBy: vi.fn(),
      },
    };

    service = new AdminAiToolsService(mockPrisma as unknown as PrismaService);
  });

  describe('getSpendingHabits', () => {
    it('aggregates top expense categories and calculates percentage share correctly', async () => {
      mockPrisma.transaction.groupBy.mockResolvedValue([
        { category: 'FOOD_GROCERIES', _sum: { amountEtb: '6000' }, _count: { id: 10 } },
        { category: 'TRANSPORT', _sum: { amountEtb: '4000' }, _count: { id: 8 } },
      ]);
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amountEtb: '10000' },
        _count: { id: 18 },
      });

      const result = await service.getSpendingHabits({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        type: 'EXPENSE',
      });

      expect(result.totalVolume).toBe(10000);
      expect(result.totalCount).toBe(18);
      expect(result.categories).toHaveLength(2);
      expect(result.categories[0]).toEqual({
        category: 'Food & Groceries',
        totalVolume: 6000,
        formattedVolume: '6,000.00 ETB',
        transactionCount: 10,
        percentageShare: 60,
        averageTransactionSize: 600,
      });
      expect(result.categories[1]?.percentageShare).toBe(40);
    });
  });

  describe('getPaymentMethodDistribution', () => {
    it('normalizes platform names and calculates volume distribution', async () => {
      mockPrisma.transaction.groupBy.mockResolvedValue([
        { platform: 'telebirr', _sum: { amountEtb: '7000' }, _count: { id: 14 } },
        { platform: 'cbe', _sum: { amountEtb: '3000' }, _count: { id: 2 } },
      ]);
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amountEtb: '10000' },
        _count: { id: 16 },
      });

      const result = await service.getPaymentMethodDistribution({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(result.totalVolume).toBe(10000);
      expect(result.platforms).toHaveLength(2);
      expect(result.platforms[0]?.paymentMethod).toBe('Telebirr');
      expect(result.platforms[0]?.percentageShare).toBe(70);
      expect(result.platforms[1]?.paymentMethod).toBe('CBE');
      expect(result.platforms[1]?.averageTransactionSize).toBe(1500);
    });
  });

  describe('queryTransactions', () => {
    it('searches transactions and includes user and source details', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          type: 'EXPENSE',
          kind: 'EXPENSE',
          amountEtb: '1200.00',
          category: 'FOOD_GROCERIES',
          platform: 'telebirr',
          note: 'Dinner with family',
          occurredAt: new Date('2026-08-20T19:00:00Z'),
          user: {
            firstName: 'Gamer',
            lastName: 'King',
            username: 'gamer',
            telegramId: 8102690249n,
          },
          group: { source: 'VOICE', rawTranscript: 'I spent 1200 birr on dinner' },
        },
      ]);
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amountEtb: '1200.00' },
      });

      const result = await service.queryTransactions({
        category: 'food',
        limit: 10,
      });

      expect(result.count).toBe(1);
      expect(result.totalVolume).toBe(1200);
      expect(result.transactions[0]?.userName).toBe('Gamer King');
      expect(result.transactions[0]?.userTelegramId).toBe('8102690249');
      expect(result.transactions[0]?.source).toBe('VOICE');
      expect(result.transactions[0]?.paymentMethod).toBe('Telebirr');
    });
  });

  describe('getTransactionDetail', () => {
    it('returns full audit details for an existing transaction', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-123',
        type: 'EXPENSE',
        kind: 'EXPENSE',
        amountEtb: '350.00',
        category: 'TRANSPORT',
        platform: 'cash',
        occurredAt: new Date('2026-08-25T10:00:00Z'),
        user: {
          id: 'user-1',
          firstName: 'Abebe',
          lastName: 'Bikila',
          username: 'abebe',
          telegramId: 123456789n,
          status: 'ACTIVE',
        },
        group: {
          source: 'TEXT',
          rawTranscript: 'Taxi 350 birr',
          sttModel: null,
          extractionModel: 'gemini-3.6-flash',
          promptVersion: 'v1',
        },
      });

      const result = await service.getTransactionDetail({ transactionId: 'tx-123' });

      expect(result.found).toBe(true);
      expect(result.transaction?.id).toBe('tx-123');
      expect(result.transaction?.user.name).toBe('Abebe Bikila');
      expect(result.transaction?.rawInputText).toBe('Taxi 350 birr');
    });

    it('returns found: false when transaction does not exist', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      const result = await service.getTransactionDetail({ transactionId: 'non-existent' });
      expect(result.found).toBe(false);
      expect(result.transaction).toBeUndefined();
    });
  });

  describe('getUserProfileSummary', () => {
    it('finds user by username and computes financial footprint', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-887',
        telegramId: 8102690249n,
        firstName: 'Gamer',
        lastName: null,
        username: 'gamer',
        language: 'AM',
        status: 'ACTIVE',
        createdAt: new Date('2026-08-01T00:00:00Z'),
      });

      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amountEtb: '25000' },
        _count: { id: 32 },
      });

      mockPrisma.transaction.groupBy
        .mockResolvedValueOnce([
          { category: 'FOOD_GROCERIES', _sum: { amountEtb: '12500' } },
          { category: 'UTILITIES', _sum: { amountEtb: '5000' } },
        ])
        .mockResolvedValueOnce([{ platform: 'telebirr', _count: { id: 24 } }]);

      const result = await service.getUserProfileSummary({ query: '@gamer' });

      expect(result.found).toBe(true);
      expect(result.user?.name).toBe('Gamer');
      expect(result.user?.totalVolume).toBe(25000);
      expect(result.user?.transactionCount).toBe(32);
      expect(result.user?.preferredPaymentMethod).toBe('Telebirr');
      expect(result.user?.topCategories[0]).toEqual({
        category: 'Food & Groceries',
        volume: 12500,
        share: 50,
      });
    });
  });

  describe('getPlatformOverview', () => {
    it('computes platform-wide metrics and input source breakdown', async () => {
      mockPrisma.user.count.mockResolvedValueOnce(150).mockResolvedValueOnce(130);
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amountEtb: '450000' },
        _count: { id: 820 },
      });
      mockPrisma.transactionGroup.groupBy.mockResolvedValue([
        { source: 'VOICE', _count: { id: 400 } },
        { source: 'RECEIPT', _count: { id: 200 } },
        { source: 'TEXT', _count: { id: 200 } },
      ]);

      const result = await service.getPlatformOverview({ period: 'this_month' });

      expect(result.totalUsers).toBe(150);
      expect(result.activeUsers).toBe(130);
      expect(result.totalVolume).toBe(450000);
      expect(result.totalTransactions).toBe(820);
      expect(result.sourceBreakdown.voiceCount).toBe(400);
      expect(result.sourceBreakdown.voiceShare).toBe(50);
      expect(result.sourceBreakdown.receiptShare).toBe(25);
    });
  });
});
