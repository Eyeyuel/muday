import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, type Mock, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { ActiveAccountGuard } from '../src/customer-auth/active-account.guard.js';
import { CustomerJwtService } from '../src/customer-auth/customer-jwt.service.js';
import { CustomerSessionService } from '../src/customer-auth/customer-session.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';

interface TestContext {
  sessionService: CustomerSessionService;
  jwtService: CustomerJwtService;
  updateSessionMock: Mock;
  updateManySessionMock: Mock;
  findUniqueTokenMock: Mock;
  mockUser: Record<string, unknown>;
  mockSession: Record<string, unknown>;
  mockTokenRecord: Record<string, unknown>;
}

describe('CustomerSessionService', () => {
  function createService(): TestContext {
    const configValues: Record<string, unknown> = {
      CUSTOMER_JWT_SECRET: 'test_customer_jwt_secret_32_chars_long!',
      CUSTOMER_ACCESS_TOKEN_TTL_SECONDS: 900,
      CUSTOMER_REFRESH_TOKEN_TTL_SECONDS: 2592000,
    };

    const config = {
      get: vi.fn((key: string) => configValues[key]),
    } as unknown as ConfigService<Environment, true>;

    const jwtService = new CustomerJwtService(config);

    const mockUser = {
      id: 'user-uuid-1',
      firstName: 'Abebe',
      lastName: 'Bikila',
      language: 'AM',
      status: 'ACTIVE',
      createdAt: new Date(),
      deletedAt: null,
    };

    const mockSession = {
      id: 'session-uuid-1',
      userId: 'user-uuid-1',
      identityId: 'identity-uuid-1',
      clientType: 'FLUTTER_ANDROID',
      deviceName: 'Mobile Device',
      appVersion: '1.0.0',
      expiresAt: new Date(Date.now() + 2592000000),
      revokedAt: null,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    const mockTokenRecord = {
      id: 'token-uuid-1',
      sessionId: 'session-uuid-1',
      tokenHash: 'hashed_token',
      expiresAt: new Date(Date.now() + 2592000000),
      usedAt: null,
      revokedAt: null,
      session: {
        ...mockSession,
        user: mockUser,
      },
    };

    const updateSessionMock = vi.fn().mockResolvedValue(mockSession);
    const updateManySessionMock = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueTokenMock = vi.fn().mockResolvedValue(mockTokenRecord);

    const mockPrisma: PrismaService = {
      $transaction: vi.fn((cb: (tx: PrismaService) => Promise<unknown>) => cb(mockPrisma)),
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
      },
      customerSession: {
        create: vi.fn().mockResolvedValue(mockSession),
        update: updateSessionMock,
        updateMany: updateManySessionMock,
        findMany: vi.fn().mockResolvedValue([mockSession]),
      },
      customerRefreshToken: {
        create: vi.fn().mockResolvedValue(mockTokenRecord),
        findUnique: findUniqueTokenMock,
        update: vi.fn().mockResolvedValue(mockTokenRecord),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;

    const sessionService = new CustomerSessionService(mockPrisma, config, jwtService);

    return {
      sessionService,
      jwtService,
      updateSessionMock,
      updateManySessionMock,
      findUniqueTokenMock,
      mockUser,
      mockSession,
      mockTokenRecord,
    };
  }

  it('creates customer session, signs access token with iss=muday-api and aud=muday-customer', async () => {
    const { sessionService, jwtService } = createService();
    const result = await sessionService.createSession({
      userId: 'user-uuid-1',
      identityId: 'identity-uuid-1',
    });

    expect(result.sessionId).toBe('session-uuid-1');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.id).toBe('user-uuid-1');

    const payload = jwtService.verifyAccessToken(result.accessToken);
    expect(payload.sub).toBe('user-uuid-1');
    expect(payload.sid).toBe('session-uuid-1');
    expect(payload.role).toBe('customer');
    expect(payload.iss).toBe('muday-api');
    expect(payload.aud).toBe('muday-customer');
  });

  it('rotates refresh token in transaction and returns new access token', async () => {
    const { sessionService } = createService();
    const result = await sessionService.refreshSession('raw_refresh_token');

    expect(result.sessionId).toBe('session-uuid-1');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('detects refresh token reuse and revokes entire session family immediately', async () => {
    const updateSessionMock = vi.fn().mockResolvedValue({ id: 'session-uuid-1' });
    const usedTokenRecord = {
      id: 'token-uuid-1',
      sessionId: 'session-uuid-1',
      tokenHash: 'hashed_token',
      expiresAt: new Date(Date.now() + 2592000000),
      usedAt: new Date(Date.now() - 5000),
      revokedAt: null,
      session: {
        id: 'session-uuid-1',
        user: { id: 'user-uuid-1', status: 'ACTIVE', deletedAt: null },
      },
    };

    const mockPrisma: PrismaService = {
      $transaction: vi.fn((cb: (tx: PrismaService) => Promise<unknown>) => cb(mockPrisma)),
      customerRefreshToken: {
        findUnique: vi.fn().mockResolvedValue(usedTokenRecord),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      customerSession: {
        update: updateSessionMock,
      },
    } as unknown as PrismaService;

    const config = {
      get: vi.fn((key: string) => (key === 'CUSTOMER_REFRESH_TOKEN_TTL_SECONDS' ? 2592000 : 900)),
    } as unknown as ConfigService<Environment, true>;

    const jwtService = new CustomerJwtService({
      get: vi.fn().mockReturnValue('test_customer_jwt_secret_32_chars_long!'),
    } as unknown as ConfigService<Environment, true>);

    const sessionService = new CustomerSessionService(mockPrisma, config, jwtService);

    await expect(sessionService.refreshSession('reused_token')).rejects.toThrow(
      'Session revoked due to token reuse detection',
    );

    expect(updateSessionMock.mock.calls.length).toBe(1);
    expect(updateSessionMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'session-uuid-1' },
      data: {
        revokeReason: 'TOKEN_REUSE_DETECTED',
      },
    });
  });

  it('revokes current session', async () => {
    const updateManyMock = vi.fn().mockResolvedValue({ count: 1 });
    const mockPrisma = {
      customerSession: {
        updateMany: updateManyMock,
      },
    } as unknown as PrismaService;
    const config = { get: vi.fn() } as unknown as ConfigService<Environment, true>;
    const jwtService = {} as CustomerJwtService;
    const sessionService = new CustomerSessionService(mockPrisma, config, jwtService);

    await sessionService.revokeCurrentSession('session-uuid-1');

    expect(updateManyMock.mock.calls.length).toBe(1);
    expect(updateManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'session-uuid-1', revokedAt: null },
    });
  });

  describe('ActiveAccountGuard Permission Rules', () => {
    const guard = new ActiveAccountGuard();

    function createMockContext(status: string, deletedAt: Date | null = null): ExecutionContext {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            customerUser: {
              status,
              deletedAt,
            },
          }),
        }),
      } as unknown as ExecutionContext;
    }

    it('allows ACTIVE user to perform financial operations', () => {
      const ctx = createMockContext('ACTIVE');
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('blocks PENDING_CONSENT user from financial operations', () => {
      const ctx = createMockContext('PENDING_CONSENT');
      expect(() => guard.canActivate(ctx)).toThrow(
        'Consent is required before performing financial operations',
      );
    });

    it('blocks PAUSED user from financial operations', () => {
      const ctx = createMockContext('PAUSED');
      expect(() => guard.canActivate(ctx)).toThrow(
        'Account is paused; financial operations are blocked',
      );
    });

    it('blocks DELETED user from financial operations', () => {
      const ctx = createMockContext('DELETED', new Date());
      expect(() => guard.canActivate(ctx)).toThrow('User account has been deleted');
    });
  });
});
