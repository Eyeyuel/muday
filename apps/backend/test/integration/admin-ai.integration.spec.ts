import { PrismaPg } from '@prisma/adapter-pg';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AdminAiService } from '../../src/admin-ai/admin-ai.service.js';
import { AdminAiSessionRepository } from '../../src/admin-ai/admin-ai-session.repository.js';
import { AdminAiToolsService } from '../../src/admin-ai/admin-ai-tools.service.js';
import { AdminAiExportService } from '../../src/admin-ai/admin-ai-export.service.js';
import { AdminAuthGuard } from '../../src/admin-auth/admin-auth.guard.js';
import type { AdminAuthService } from '../../src/admin-auth/admin-auth.service.js';
import type { Environment } from '../../src/config/environment.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import {
  FinancialEventKind,
  PrismaClient,
  TransactionSource,
  TransactionType,
  UserStatus,
} from '../../src/generated/prisma/client.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://muday:muday_local_password@localhost:5432/muday?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 2 }) });

const testTelegramIds = [9_920_000_001n, 9_920_000_002n];

describe('Admin AI Assistant Integration Tests', () => {
  let toolsService: AdminAiToolsService;
  let sessionRepo: AdminAiSessionRepository;
  let aiService: AdminAiService;
  let mockConfig: { get: ReturnType<typeof vi.fn> };
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // Cleanup any existing test users
    await prisma.user.deleteMany({
      where: { telegramId: { in: testTelegramIds } },
    });

    // Seed test users with required consent fields for ACTIVE status
    const user1 = await prisma.user.create({
      data: {
        telegramId: testTelegramIds[0]!,
        firstName: 'Gamer',
        lastName: 'King',
        username: 'gamerking',
        status: UserStatus.ACTIVE,
        consentVersion: 'v1.0',
        consentAt: new Date('2026-08-01T08:00:00.000Z'),
        language: 'AM',
      },
    });
    user1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        telegramId: testTelegramIds[1]!,
        firstName: 'Abebe',
        lastName: 'Bikila',
        username: 'abebebikila',
        status: UserStatus.ACTIVE,
        consentVersion: 'v1.0',
        consentAt: new Date('2026-08-01T08:00:00.000Z'),
        language: 'EN',
      },
    });
    user2Id = user2.id;

    // Seed transaction groups and transactions for User 1
    const group1 = await prisma.transactionGroup.create({
      data: {
        userId: user1Id,
        telegramUpdateId: 99201n,
        telegramMessageId: 101n,
        source: TransactionSource.VOICE,
        messageAt: new Date('2026-08-15T10:00:00Z'),
        rawTranscript: 'I spent 4000 birr on groceries with telebirr',
        extractionModel: 'gemini-3.6-flash',
        promptVersion: 'v1',
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          groupId: group1.id,
          userId: user1Id,
          type: TransactionType.EXPENSE,
          kind: FinancialEventKind.EXPENSE,
          amountEtb: 4000.0,
          category: 'FOOD_GROCERIES',
          platform: 'telebirr',
          occurredAt: new Date('2026-08-15T10:00:00Z'),
        },
        {
          groupId: group1.id,
          userId: user1Id,
          type: TransactionType.EXPENSE,
          kind: FinancialEventKind.EXPENSE,
          amountEtb: 2500.0,
          category: 'FOOD_GROCERIES',
          platform: 'telebirr',
          occurredAt: new Date('2026-08-16T12:00:00Z'),
        },
        {
          groupId: group1.id,
          userId: user1Id,
          type: TransactionType.EXPENSE,
          kind: FinancialEventKind.EXPENSE,
          amountEtb: 1500.0,
          category: 'TRANSPORT',
          platform: 'cbe',
          occurredAt: new Date('2026-08-18T15:00:00Z'),
        },
      ],
    });

    // Seed transaction groups and transactions for User 2
    const group2 = await prisma.transactionGroup.create({
      data: {
        userId: user2Id,
        telegramUpdateId: 99202n,
        telegramMessageId: 201n,
        source: TransactionSource.RECEIPT,
        messageAt: new Date('2026-08-20T14:00:00Z'),
        rawTranscript: 'Supermarket shopping 5000 birr',
        extractionModel: 'gemini-3.6-flash',
        promptVersion: 'v1',
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          groupId: group2.id,
          userId: user2Id,
          type: TransactionType.EXPENSE,
          kind: FinancialEventKind.EXPENSE,
          amountEtb: 5000.0,
          category: 'SHOPPING',
          platform: 'cbe',
          occurredAt: new Date('2026-08-20T14:00:00Z'),
        },
        {
          groupId: group2.id,
          userId: user2Id,
          type: TransactionType.EXPENSE,
          kind: FinancialEventKind.EXPENSE,
          amountEtb: 3000.0,
          category: 'UTILITIES',
          platform: 'telebirr',
          occurredAt: new Date('2026-08-22T09:00:00Z'),
        },
      ],
    });

    // Setup services
    toolsService = new AdminAiToolsService(prisma as unknown as PrismaService);
    sessionRepo = new AdminAiSessionRepository(); // in-memory mode for integration test
    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'GEMINI_BASE_URL') return 'https://generativelanguage.googleapis.com/v1beta';
        if (key === 'GEMINI_MODEL') return 'gemini-3.6-flash';
        if (key === 'GEMINI_API_KEY') return 'test_api_key';
        if (key === 'GEMINI_TIMEOUT_MS') return 10000;
        return undefined;
      }),
    };

    const exportService = new AdminAiExportService();
    aiService = new AdminAiService(
      mockConfig as unknown as ConfigService<Environment, true>,
      toolsService,
      sessionRepo,
      exportService,
    );
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { telegramId: { in: testTelegramIds } },
    });
    await prisma.$disconnect();
  });

  it('Test 1: Category spending habits inquiry ("What do users spend the most on?")', async () => {
    // Mock Gemini function calling sequence
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'getSpendingHabitsAndCategoryAnalytics',
                        args: { type: 'EXPENSE', limit: 5 },
                      },
                    },
                  ],
                },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      text: 'Food & Groceries is the highest spending category with 6,500.00 ETB (40.6% share), followed by Shopping with 5,000.00 ETB (31.3% share).',
                    },
                  ],
                },
              },
            ],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await aiService.chat('admin-test-id', {
      message: 'What do users spend the most on?',
    });

    expect(response.reply).toContain('Food & Groceries');
    expect(response.toolsExecuted).toHaveLength(1);
    expect(response.toolsExecuted[0]?.toolName).toBe('getSpendingHabitsAndCategoryAnalytics');
    expect(response.visualData?.kpis).toBeDefined();
    expect(response.visualData?.table?.headers).toContain('Category');
    expect(response.visualData?.chart?.chartType).toBe('pie');
  });

  it('Test 2: Bank & payment method market share inquiry ("Telebirr vs CBE")', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'getPaymentMethodAndBankDistribution',
                        args: {},
                      },
                    },
                  ],
                },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      text: 'Telebirr dominates with 9,500.00 ETB (59.4% share) across 3 transactions, while CBE accounts for 6,500.00 ETB (40.6% share).',
                    },
                  ],
                },
              },
            ],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await aiService.chat('admin-test-id', {
      message: 'Compare Telebirr vs CBE volume',
    });

    expect(response.reply).toContain('Telebirr dominates');
    expect(response.toolsExecuted[0]?.toolName).toBe('getPaymentMethodAndBankDistribution');
    expect(response.visualData?.chart?.chartType).toBe('bar');
  });

  it('Test 3: Single user deep dive ("Show Gamer\'s financial footprint")', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'getUserProfileAndBehaviorSummary',
                        args: { query: 'gamerking' },
                      },
                    },
                  ],
                },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      text: 'Gamer King has logged 8,000.00 ETB across 3 transactions. Preferred platform is Telebirr.',
                    },
                  ],
                },
              },
            ],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await aiService.chat('admin-test-id', {
      message: "Show Gamer's financial footprint",
    });

    expect(response.reply).toContain('Gamer King');
    expect(response.visualData?.kpis?.[0]?.value).toBe('Gamer King');
    expect(response.visualData?.kpis?.[1]?.value).toBe('8,000.00 ETB');
    expect(response.visualData?.kpis?.[3]?.value).toBe('Telebirr');
  });

  it('Test 4: Multi-turn conversation maintaining session state', async () => {
    const sessionId = 'session-multi-turn-test';

    // Turn 1
    const fetchMock1 = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    text: 'Here are the top spenders: 1. Gamer King (8,000 ETB), 2. Abebe Bikila (8,000 ETB).',
                  },
                ],
              },
            },
          ],
        }),
    });
    vi.stubGlobal('fetch', fetchMock1);

    const response1 = await aiService.chat('admin-test-id', {
      message: 'Who are the top spenders?',
      sessionId,
    });
    expect(response1.sessionId).toBe(sessionId);

    // Turn 2 (Follow-up)
    const fetchMock2 = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  { text: 'Abebe Bikila spent 5,000 ETB on Shopping and 3,000 ETB on Utilities.' },
                ],
              },
            },
          ],
        }),
    });
    vi.stubGlobal('fetch', fetchMock2);

    const response2 = await aiService.chat('admin-test-id', {
      message: 'What about the second one?',
      sessionId,
    });

    expect(response2.sessionId).toBe(sessionId);
    expect(response2.reply).toContain('Abebe Bikila');

    // Verify session stored 4 turns (2 user, 2 model)
    const stored = await sessionRepo.getSession('admin-test-id', sessionId);
    expect(stored?.turns).toHaveLength(4);
  });

  it('Test 5: Unauthorized request rejection (missing token throws ApplicationException)', async () => {
    const mockAdminAuth = {
      verifyActiveToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
    };
    const guard = new AdminAuthGuard(mockAdminAuth as unknown as AdminAuthService);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {}, // No authorization header
        }),
      }),
    };

    await expect(guard.canActivate(mockContext as unknown as ExecutionContext)).rejects.toThrow(
      'Admin authorization token required',
    );
  });

  it('Test 6: Excel & Word Export generation with Muday Mint styling and category humanization', async () => {
    const exportService = new AdminAiExportService();

    const testData = {
      title: 'Top Spending Categories Report',
      subtitle: 'Muday Financial Intelligence',
      headers: ['category', 'total_volume', 'percentage_share'],
      rows: [
        ['clothing_personal_care', 4500, '45.0%'],
        ['food_groceries', 3500, '35.0%'],
        ['airtime_data', 2000, '20.0%'],
      ],
      kpis: [
        { label: 'top_category', value: 'clothing_personal_care' },
        { label: 'total_volume', value: '10,000.00 ETB' },
      ],
      summary: 'Clothing & Personal Care represents the majority of spending.',
    };

    const excelBuffer = await exportService.generateExcel(testData);
    expect(excelBuffer).toBeInstanceOf(Buffer);
    expect(excelBuffer.length).toBeGreaterThan(1000);

    const wordBuffer = await exportService.generateWord(testData);
    expect(wordBuffer).toBeInstanceOf(Buffer);
    expect(wordBuffer.length).toBeGreaterThan(1000);

    const token = exportService.storeExportFile(
      'report.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      excelBuffer,
    );
    expect(token).toBeDefined();
    const retrieved = exportService.getExportFile(token);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.filename).toBe('report.xlsx');
  });

  it('Test 7: Hourly spending curve inquiry in East Africa Time (EAT)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'getHourlySpendingCurveAndPeakTimes',
                        args: {},
                      },
                    },
                  ],
                },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      text: 'Consumer spending peaks during midday hours between 12:00 and 15:00 EAT.',
                    },
                  ],
                },
              },
            ],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await aiService.chat('admin-test-id', {
      message: 'When are our peak spending hours in Ethiopia?',
    });

    expect(response.reply).toContain('12:00');
    expect(response.visualData?.kpis).toBeDefined();
    expect(response.visualData?.chart?.chartType).toBe('line');
  });

  it('Test 8: Month-over-month category growth comparison', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'getMonthOverMonthCategoryTrends',
                        args: {},
                      },
                    },
                  ],
                },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      text: 'Food & Groceries and Shopping are our highest volume categories this month.',
                    },
                  ],
                },
              },
            ],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await aiService.chat('admin-test-id', {
      message: 'Show me category trends and growth',
    });

    expect(response.toolsExecuted[0]?.toolName).toBe('getMonthOverMonthCategoryTrends');
    expect(response.visualData?.table?.headers).toContain('Growth (%)');
    expect(response.visualData?.chart?.chartType).toBe('bar');
  });

  it('Test 9: User retention cohorts and language distribution', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'getUserRetentionAndCohortAnalytics',
                        args: {},
                      },
                    },
                  ],
                },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      text: 'We currently have 2 registered users with 100% active status.',
                    },
                  ],
                },
              },
            ],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await aiService.chat('admin-test-id', {
      message: 'What is our user retention rate and active cohort breakdown?',
    });

    expect(response.toolsExecuted[0]?.toolName).toBe('getUserRetentionAndCohortAnalytics');
    expect(response.visualData?.kpis?.[0]?.label).toBe('Registered Users');
  });

  it('Test 10: AI extraction modality telemetry and confidence metrics', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'getAiExtractionQualityAndModalityMetrics',
                        args: {},
                      },
                    },
                  ],
                },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      text: 'Voice notes account for 50% of data ingestion, followed by receipt image OCR.',
                    },
                  ],
                },
              },
            ],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await aiService.chat('admin-test-id', {
      message: 'Analyze our voice AI and OCR extraction health',
    });

    expect(response.toolsExecuted[0]?.toolName).toBe('getAiExtractionQualityAndModalityMetrics');
    expect(response.visualData?.chart?.chartType).toBe('pie');
  });
});
