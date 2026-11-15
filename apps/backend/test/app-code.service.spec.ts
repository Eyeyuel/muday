import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { Environment } from '../src/config/environment.js';
import { AppCodeService } from '../src/customer-auth/app-code.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import type { RedisService } from '../src/redis/redis.service.js';

interface TestContext {
  service: AppCodeService;
  findUniqueUserMock: Mock;
  findManyUserMock: Mock;
  updateUserMock: Mock;
  updateManySessionMock: Mock;
  redisGetMock: Mock;
  redisDeleteMock: Mock;
  redisIncrMock: Mock;
}

interface UserUpdateCall {
  where: { id: string };
  data: { appCodeHash?: string; appCodePrefix?: string };
}

interface SessionUpdateManyCall {
  where: { userId: string; revokedAt: null };
  data: { revokedAt: Date; revokeReason: string };
}

describe('AppCodeService', () => {
  const pepper = 'test_pepper_secret_min32chars_long_12345';
  const rateLimitPerHour = 5;

  let ctx: TestContext;

  beforeEach(() => {
    const configValues: Record<string, unknown> = {
      APP_CODE_PEPPER: pepper,
      APP_CODE_RATE_LIMIT_PER_HOUR: rateLimitPerHour,
    };

    const mockConfig = {
      get: vi.fn((key: string) => configValues[key]),
    } as unknown as ConfigService<Environment, true>;

    const redisGetMock = vi.fn().mockResolvedValue(null);
    const redisDeleteMock = vi.fn().mockResolvedValue(1);
    const redisIncrMock = vi.fn().mockResolvedValue(1);

    const mockRedis = {
      get: redisGetMock,
      set: vi.fn().mockResolvedValue('OK'),
      delete: redisDeleteMock,
      incrementWithExpiry: redisIncrMock,
    } as unknown as RedisService;

    const findUniqueUserMock = vi.fn();
    const findManyUserMock = vi.fn();
    const updateUserMock = vi.fn();
    const updateManySessionMock = vi.fn().mockResolvedValue({ count: 2 });

    const mockPrisma = {
      user: {
        findUnique: findUniqueUserMock,
        findMany: findManyUserMock,
        update: updateUserMock,
      },
      customerSession: {
        updateMany: updateManySessionMock,
      },
      $transaction: vi.fn((cb: (tx: PrismaService) => Promise<unknown>) => cb(mockPrisma)),
    } as unknown as PrismaService;

    const service = new AppCodeService(mockPrisma, mockRedis, mockConfig);

    ctx = {
      service,
      findUniqueUserMock,
      findManyUserMock,
      updateUserMock,
      updateManySessionMock,
      redisGetMock,
      redisDeleteMock,
      redisIncrMock,
    };
  });

  it('generateForUser returns a string of exactly 6 chars', async () => {
    ctx.findUniqueUserMock.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
    ctx.updateUserMock.mockResolvedValue({ id: 'user-1' });

    const code = await ctx.service.generateForUser('user-1');
    expect(typeof code).toBe('string');
    expect(code.length).toBe(6);
  });

  it('generateForUser returns only alphanumeric characters (matches /^[A-Za-z0-9]{6}$/)', async () => {
    ctx.findUniqueUserMock.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
    ctx.updateUserMock.mockResolvedValue({ id: 'user-1' });

    const code = await ctx.service.generateForUser('user-1');
    expect(/^[A-Za-z0-9]{6}$/.test(code)).toBe(true);
  });

  it('generateForUser stores a DIFFERENT value in DB than the returned code (hashed)', async () => {
    ctx.findUniqueUserMock.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
    ctx.updateUserMock.mockResolvedValue({ id: 'user-1' });

    const code = await ctx.service.generateForUser('user-1');
    const updateCall = ctx.updateUserMock.mock.calls[0] as [UserUpdateCall];
    expect(updateCall[0].where.id).toBe('user-1');
    expect(updateCall[0].data.appCodeHash).not.toBe(code);
    expect(typeof updateCall[0].data.appCodeHash).toBe('string');
  });

  it('generateForUser stores prefix = first 4 chars of the returned code', async () => {
    ctx.findUniqueUserMock.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
    ctx.updateUserMock.mockResolvedValue({ id: 'user-1' });

    const code = await ctx.service.generateForUser('user-1');
    const expectedPrefix = code.substring(0, 4);

    const updateCall = ctx.updateUserMock.mock.calls[0] as [UserUpdateCall];
    expect(updateCall[0].where.id).toBe('user-1');
    expect(updateCall[0].data.appCodePrefix).toBe(expectedPrefix);
  });

  it('generateForUser throws NotFoundException for non-existent userId', async () => {
    ctx.findUniqueUserMock.mockResolvedValue(null);

    await expect(ctx.service.generateForUser('non-existent-user')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('verifyAndGetUserId returns the correct userId for a valid code', async () => {
    const rawCode = 'aB3kX9';
    const hash = await bcrypt.hash(rawCode + pepper, 12);

    ctx.findManyUserMock.mockResolvedValue([
      {
        id: 'user-123',
        appCodeHash: hash,
        status: 'ACTIVE',
        deletedAt: null,
      },
    ]);

    const userId = await ctx.service.verifyAndGetUserId(rawCode, '127.0.0.1');
    expect(userId).toBe('user-123');
    expect(ctx.redisDeleteMock).toHaveBeenCalledWith('muday:auth:attempts:127.0.0.1');
  });

  it('verifyAndGetUserId throws UnauthorizedException for an incorrect code', async () => {
    const validCode = 'aB3kX9';
    const wrongCode = 'aB3kX8';
    const hash = await bcrypt.hash(validCode + pepper, 12);

    ctx.findManyUserMock.mockResolvedValue([
      {
        id: 'user-123',
        appCodeHash: hash,
        status: 'ACTIVE',
        deletedAt: null,
      },
    ]);

    await expect(ctx.service.verifyAndGetUserId(wrongCode, '127.0.0.1')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(ctx.redisIncrMock).toHaveBeenCalledWith('muday:auth:attempts:127.0.0.1', 3600);
  });

  it("verifyAndGetUserId throws UnauthorizedException for a deleted user's code", async () => {
    const rawCode = 'aB3kX9';
    const hash = await bcrypt.hash(rawCode + pepper, 12);

    ctx.findManyUserMock.mockResolvedValue([
      {
        id: 'user-deleted',
        appCodeHash: hash,
        status: 'DELETED',
        deletedAt: new Date(),
      },
    ]);

    await expect(ctx.service.verifyAndGetUserId(rawCode, '127.0.0.1')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifyAndGetUserId with error message is always "Invalid code" (never specific)', async () => {
    ctx.findManyUserMock.mockResolvedValue([]);

    try {
      await ctx.service.verifyAndGetUserId('invalid', '127.0.0.1');
      expect.unreachable('Should have thrown');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).message).toBe('Invalid code');
    }
  });

  it('regenerateForUser returns a different code than was previously generated', async () => {
    ctx.findUniqueUserMock.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
    ctx.updateUserMock.mockResolvedValue({ id: 'user-1' });

    const code1 = await ctx.service.generateForUser('user-1');
    const code2 = await ctx.service.regenerateForUser('user-1');

    expect(typeof code2).toBe('string');
    expect(code2.length).toBe(6);
    expect(code2).not.toBe(code1);
  });

  it('regenerateForUser revokes all CustomerSession records for the userId', async () => {
    ctx.findUniqueUserMock.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
    ctx.updateUserMock.mockResolvedValue({ id: 'user-1' });

    await ctx.service.regenerateForUser('user-1');

    const updateCall = ctx.updateManySessionMock.mock.calls[0] as [SessionUpdateManyCall];
    expect(updateCall[0].where.userId).toBe('user-1');
    expect(updateCall[0].where.revokedAt).toBeNull();
    expect(updateCall[0].data.revokeReason).toBe('CODE_REGENERATED');
    expect(updateCall[0].data.revokedAt).toBeInstanceOf(Date);
  });

  it('hasCode returns false before any code is generated', async () => {
    ctx.findUniqueUserMock.mockResolvedValue({ id: 'user-1', appCodeHash: null });

    const has = await ctx.service.hasCode('user-1');
    expect(has).toBe(false);
  });

  it('hasCode returns true after generateForUser is called', async () => {
    ctx.findUniqueUserMock.mockResolvedValue({
      id: 'user-1',
      appCodeHash: '$2a$12$somehashedvalue',
    });

    const has = await ctx.service.hasCode('user-1');
    expect(has).toBe(true);
  });

  it('Pepper is applied: verify that bcrypt.compare(code, hash) WITHOUT pepper returns false', async () => {
    const rawCode = 'aB3kX9';
    const hash = await bcrypt.hash(rawCode + pepper, 12);

    const matchWithoutPepper = await bcrypt.compare(rawCode, hash);
    expect(matchWithoutPepper).toBe(false);

    const matchWithPepper = await bcrypt.compare(rawCode + pepper, hash);
    expect(matchWithPepper).toBe(true);
  });
}, 20000);
