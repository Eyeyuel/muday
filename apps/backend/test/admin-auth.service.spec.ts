import type { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAuthService } from '../src/admin-auth/admin-auth.service.js';
import type { Environment } from '../src/config/environment.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import type { RedisService } from '../src/redis/redis.service.js';

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let mockPrisma: { adminUser: { findUnique: ReturnType<typeof vi.fn> } };
  let mockConfig: { get: ReturnType<typeof vi.fn> };
  let mockRedis: {
    incrementWithExpiry: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrisma = {
      adminUser: {
        findUnique: vi.fn(),
      },
    };
    mockConfig = {
      get: vi.fn().mockReturnValue('test_jwt_secret_key_32_characters!'),
    };
    mockRedis = {
      incrementWithExpiry: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(1),
    };
    service = new AdminAuthService(
      mockPrisma as unknown as PrismaService,
      mockRedis as unknown as RedisService,
      mockConfig as unknown as ConfigService<Environment, true>,
    );
  });

  it('authenticates valid email and password', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    vi.spyOn(mockPrisma.adminUser, 'findUnique').mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      displayName: 'Abebe',
      passwordHash,
      role: 'analytics_viewer',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.login('admin@example.com', 'secret123');
    expect(result.token).toBeDefined();
    expect(result.expiresIn).toBe(28800);

    const verified = await service.verifyActiveToken(result.token);
    expect(verified.email).toBe('admin@example.com');
    expect(verified.displayName).toBe('Abebe');
  });

  it('rejects invalid password', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    vi.spyOn(mockPrisma.adminUser, 'findUnique').mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      displayName: 'Abebe',
      passwordHash,
      role: 'analytics_viewer',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.login('admin@example.com', 'wrongpassword')).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('rejects non-existent admin user', async () => {
    vi.spyOn(mockPrisma.adminUser, 'findUnique').mockResolvedValue(null);
    await expect(service.login('nobody@example.com', 'secret123')).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('rejects a token after its administrator is disabled', async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);
    vi.spyOn(mockPrisma.adminUser, 'findUnique')
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        displayName: 'Abebe',
        passwordHash,
        role: 'analytics_viewer',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@example.com',
        displayName: 'Abebe',
        passwordHash,
        role: 'analytics_viewer',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    const { token } = await service.login('admin@example.com', 'secret123');
    await expect(service.verifyActiveToken(token)).rejects.toThrow('Invalid email or password');
  });

  it('rate limits repeated login attempts without querying credentials', async () => {
    mockRedis.incrementWithExpiry.mockResolvedValue(6);

    await expect(service.login('admin@example.com', 'wrongpassword')).rejects.toMatchObject({
      status: 429,
    });
    expect(mockPrisma.adminUser.findUnique).not.toHaveBeenCalled();
  });
});
