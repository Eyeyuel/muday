import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { ConsentRepository } from '../src/consent/consent.repository.js';
import { ConsentService } from '../src/consent/consent.service.js';
import type { Environment } from '../src/config/environment.js';

describe('ConsentService', () => {
  const config = { get: vi.fn().mockReturnValue('2026-07') } as unknown as ConfigService<
    Environment,
    true
  >;
  const repository = {} as ConsentRepository;
  const service = new ConsentService(repository, config);

  it('allows only active users on the exact current consent version', () => {
    expect(
      service.isActive({ status: 'ACTIVE', consentVersion: '2026-07', consentAt: new Date() }),
    ).toBe(true);
    expect(
      service.isActive({ status: 'ACTIVE', consentVersion: 'old', consentAt: new Date() }),
    ).toBe(false);
    expect(
      service.isActive({ status: 'PENDING_CONSENT', consentVersion: null, consentAt: null }),
    ).toBe(false);
  });

  it('delegates acceptByUserId to repository acceptByUserId with version', async () => {
    const acceptByUserIdMock = vi.fn().mockResolvedValue('accepted');
    const mockRepo = {
      acceptByUserId: acceptByUserIdMock,
    } as unknown as ConsentRepository;
    const testService = new ConsentService(mockRepo, config);
    const result = await testService.acceptByUserId('interaction-1', 'user-uuid-1');
    expect(result).toBe('accepted');
    expect(acceptByUserIdMock).toHaveBeenCalledWith('interaction-1', 'user-uuid-1', '2026-07');
  });
});
