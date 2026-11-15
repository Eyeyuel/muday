import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { AdminAiService } from '../src/admin-ai/admin-ai.service.js';
import type { AdminAiSessionRepository } from '../src/admin-ai/admin-ai-session.repository.js';
import type { AdminAiExportService } from '../src/admin-ai/admin-ai-export.service.js';
import type { AdminAiToolsService } from '../src/admin-ai/admin-ai-tools.service.js';
import type { Environment } from '../src/config/environment.js';

describe('AdminAiService', () => {
  let service: AdminAiService;
  let mockConfig: { get: ReturnType<typeof vi.fn> };
  let mockToolsService: {
    getSpendingHabits: ReturnType<typeof vi.fn>;
    getPaymentMethodDistribution: ReturnType<typeof vi.fn>;
    queryTransactions: ReturnType<typeof vi.fn>;
    getTransactionDetail: ReturnType<typeof vi.fn>;
    getUserProfileSummary: ReturnType<typeof vi.fn>;
    getPlatformOverview: ReturnType<typeof vi.fn>;
  };
  let mockSessionRepo: {
    getSession: ReturnType<typeof vi.fn>;
    saveSession: ReturnType<typeof vi.fn>;
  };
  let mockExportService: {
    generateExcel: ReturnType<typeof vi.fn>;
    generateWord: ReturnType<typeof vi.fn>;
    storeExportFile: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'GEMINI_BASE_URL') return 'https://generativelanguage.googleapis.com/v1beta';
        if (key === 'GEMINI_MODEL') return 'gemini-3.6-flash';
        if (key === 'GEMINI_API_KEY') return 'test_gemini_api_key';
        if (key === 'GEMINI_TIMEOUT_MS') return 5000;
        return undefined;
      }),
    };

    mockToolsService = {
      getSpendingHabits: vi.fn(),
      getPaymentMethodDistribution: vi.fn(),
      queryTransactions: vi.fn(),
      getTransactionDetail: vi.fn(),
      getUserProfileSummary: vi.fn(),
      getPlatformOverview: vi.fn(),
    };

    mockSessionRepo = {
      getSession: vi.fn().mockResolvedValue(null),
      saveSession: vi.fn().mockResolvedValue({}),
    };

    mockExportService = {
      generateExcel: vi.fn().mockResolvedValue(Buffer.from('excel')),
      generateWord: vi.fn().mockResolvedValue(Buffer.from('word')),
      storeExportFile: vi.fn().mockReturnValue('mock-token-123'),
    };

    service = new AdminAiService(
      mockConfig as unknown as ConfigService<Environment, true>,
      mockToolsService as unknown as AdminAiToolsService,
      mockSessionRepo as unknown as AdminAiSessionRepository,
      mockExportService as unknown as AdminAiExportService,
    );
  });

  it('handles direct textual answer from Gemini without tool calls', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: 'Hello! I am your Muday data assistant. How can I help?' }],
              },
            },
          ],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await service.chat('admin-1', { message: 'Hello' });

    expect(response.reply).toBe('Hello! I am your Muday data assistant. How can I help?');
    expect(response.toolsExecuted).toHaveLength(0);
    expect(response.sessionId).toBeDefined();
    expect(mockSessionRepo.saveSession).toHaveBeenCalled();
  });

  it('executes function call, gathers visual data, and returns synthesized insight', async () => {
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
                        args: { type: 'EXPENSE', limit: 3 },
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
                      text: 'Food & Groceries is the highest spending category, making up 60% of all expenses.',
                    },
                  ],
                },
              },
            ],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    mockToolsService.getSpendingHabits.mockResolvedValueOnce({
      timeframe: 'All-time',
      type: 'EXPENSE',
      totalVolume: 10000,
      formattedTotalVolume: '10,000.00 ETB',
      totalCount: 15,
      categories: [
        {
          category: 'FOOD_GROCERIES',
          totalVolume: 6000,
          formattedVolume: '6,000.00 ETB',
          transactionCount: 10,
          percentageShare: 60,
          averageTransactionSize: 600,
        },
      ],
    });

    const response = await service.chat('admin-1', {
      message: 'What do users spend the most on?',
    });

    expect(mockToolsService.getSpendingHabits).toHaveBeenCalledWith({
      type: 'EXPENSE',
      limit: 3,
    });
    expect(response.toolsExecuted).toHaveLength(1);
    expect(response.toolsExecuted[0]?.toolName).toBe('getSpendingHabitsAndCategoryAnalytics');
    expect(response.reply).toBe(
      'Food & Groceries is the highest spending category, making up 60% of all expenses.',
    );
    expect(response.visualData?.kpis).toBeDefined();
    expect(response.visualData?.table).toBeDefined();
    expect(response.visualData?.chart).toBeDefined();
    expect(mockSessionRepo.saveSession).toHaveBeenCalled();
  });

  it('executes payment method market share tool and populates platform charts', async () => {
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
                      text: 'Telebirr accounts for 70% of total volume, followed by CBE at 30%.',
                    },
                  ],
                },
              },
            ],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    mockToolsService.getPaymentMethodDistribution.mockResolvedValueOnce({
      timeframe: 'All-time',
      totalVolume: 20000,
      formattedTotalVolume: '20,000.00 ETB',
      totalCount: 50,
      platforms: [
        {
          paymentMethod: 'Telebirr',
          totalVolume: 14000,
          formattedVolume: '14,000.00 ETB',
          transactionCount: 40,
          percentageShare: 70,
          averageTransactionSize: 350,
        },
        {
          paymentMethod: 'CBE',
          totalVolume: 6000,
          formattedVolume: '6,000.00 ETB',
          transactionCount: 10,
          percentageShare: 30,
          averageTransactionSize: 600,
        },
      ],
    });

    const response = await service.chat('admin-1', {
      message: 'Show me payment platform share',
    });

    expect(response.toolsExecuted[0]?.toolName).toBe('getPaymentMethodAndBankDistribution');
    expect(response.visualData?.table?.rows).toHaveLength(2);
    expect(response.visualData?.chart?.chartType).toBe('bar');
  });
});
