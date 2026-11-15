import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';

import type { Environment } from '../src/config/environment.js';
import type { DashboardRepository } from '../src/dashboard/dashboard.repository.js';
import { I18nService } from '../src/i18n/i18n.service.js';
import { NavigationMenuService } from '../src/onboarding/navigation-menu.service.js';
import { BankBreakdownCommandService } from '../src/summaries/bank-breakdown-command.service.js';
import { RecordingTelegramTransport } from '../src/telegram/transport/recording-transport.js';
import type { UsersService } from '../src/users/users.service.js';

describe('BankBreakdownCommandService', () => {
  it('formats bank breakdown correctly when banks are present', async () => {
    const transport = new RecordingTelegramTransport();
    const i18n = new I18nService();
    const config = {
      get: vi.fn().mockReturnValue(1000),
    } as unknown as ConfigService<Environment, true>;
    const navigation = new NavigationMenuService(config, i18n);

    const usersService = {
      findById: vi.fn().mockResolvedValue({
        id: 'usr-1',
        telegramUserId: BigInt(123456),
        status: 'ACTIVE',
        language: 'EN',
      }),
      findByTelegramId: vi.fn().mockResolvedValue({
        id: 'usr-1',
        telegramUserId: BigInt(123456),
        status: 'ACTIVE',
        language: 'EN',
      }),
    } as unknown as UsersService;

    const dashboardRepository = {
      getBankBreakdown: vi.fn().mockResolvedValue({
        banks: [
          {
            id: 'telebirr',
            name: 'Telebirr',
            nameAm: 'ቴሌብር',
            emoji: '📱',
            count: 5,
            totalEtb: 1500,
          },
          {
            id: 'cbe',
            name: 'Commercial Bank of Ethiopia (CBE)',
            nameAm: 'የኢትዮጵያ ንግድ ባንክ (CBE)',
            emoji: '🏦',
            count: 3,
            totalEtb: 4200,
          },
        ],
        other: { count: 2, totalEtb: 500 },
        totalCount: 10,
        totalEtb: 6200,
      }),
    } as unknown as DashboardRepository;

    const service = new BankBreakdownCommandService(
      usersService,
      dashboardRepository,
      i18n,
      transport,
      navigation,
    );

    await service.send(123456, 123456, 'month');

    expect(transport.messages).toHaveLength(1);
    const text = transport.messages[0]?.text;
    expect(text).toContain('Bank & Account Activity (This Month)');
    expect(text).toContain('Telebirr: 5 transactions • 1500.00 ETB');
    expect(text).toContain('Commercial Bank of Ethiopia (CBE): 3 transactions • 4200.00 ETB');
    expect(text).toContain('Cash / Other: 2 transactions • 500.00 ETB');
    expect(text).toContain('Total Tracked: 10 transactions • 6200.00 ETB');
  });

  it('formats empty state when user has no bank transactions', async () => {
    const transport = new RecordingTelegramTransport();
    const i18n = new I18nService();
    const config = {
      get: vi.fn().mockReturnValue(1000),
    } as unknown as ConfigService<Environment, true>;
    const navigation = new NavigationMenuService(config, i18n);

    const usersService = {
      findById: vi.fn().mockResolvedValue({
        id: 'usr-1',
        telegramUserId: BigInt(123456),
        status: 'ACTIVE',
        language: 'AM',
      }),
      findByTelegramId: vi.fn().mockResolvedValue({
        id: 'usr-1',
        telegramUserId: BigInt(123456),
        status: 'ACTIVE',
        language: 'AM',
      }),
    } as unknown as UsersService;

    const dashboardRepository = {
      getBankBreakdown: vi.fn().mockResolvedValue({
        banks: [],
        other: { count: 0, totalEtb: 0 },
        totalCount: 0,
        totalEtb: 0,
      }),
    } as unknown as DashboardRepository;

    const service = new BankBreakdownCommandService(
      usersService,
      dashboardRepository,
      i18n,
      transport,
      navigation,
    );

    await service.send(123456, 123456, 'month');

    expect(transport.messages).toHaveLength(1);
    const text = transport.messages[0]?.text;
    expect(text).toContain('የባንክና አካውንት እንቅስቃሴ (የዚህ ወር)');
    expect(text).toContain('በዚህ ጊዜ ምንም የባንክ ግብይት አልተገኘም።');
  });
});
