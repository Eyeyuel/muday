import { randomBytes } from 'node:crypto';
import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';

import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 6;

@Injectable()
export class AppCodeService {
  private readonly pepper: string;
  private readonly rateLimitPerHour: number;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.pepper = config.get('APP_CODE_PEPPER', { infer: true });
    this.rateLimitPerHour = config.get('APP_CODE_RATE_LIMIT_PER_HOUR', { infer: true });
  }

  async generateForUser(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt || user.status === 'DELETED') {
      throw new NotFoundException('User not found');
    }

    const code = this.generateSecureCode();
    const hash = await bcrypt.hash(code + this.pepper, 12);
    const prefix = code.substring(0, 4);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        appCodeHash: hash,
        appCodePrefix: prefix,
      },
    });

    return code;
  }

  async verifyAndGetUserId(code: string, callerIp?: string): Promise<string> {
    const attemptKey = callerIp ? `muday:auth:attempts:${callerIp}` : null;

    if (attemptKey) {
      const rawCount = await this.redis.get(attemptKey);
      const attempts = rawCount ? parseInt(rawCount, 10) : 0;
      if (attempts >= this.rateLimitPerHour) {
        await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));
        throw new UnauthorizedException('Invalid code');
      }
    }

    if (
      !code ||
      typeof code !== 'string' ||
      code.length !== CODE_LENGTH ||
      !/^[A-Za-z0-9]{6}$/.test(code)
    ) {
      if (attemptKey) {
        await this.redis.incrementWithExpiry(attemptKey, 3600);
      }
      throw new UnauthorizedException('Invalid code');
    }

    const prefix = code.substring(0, 4);
    const candidates = await this.prisma.user.findMany({
      where: {
        appCodePrefix: prefix,
        appCodeHash: { not: null },
      },
      select: {
        id: true,
        appCodeHash: true,
        status: true,
        deletedAt: true,
      },
    });

    for (const candidate of candidates) {
      if (!candidate.appCodeHash) continue;
      const match = await bcrypt.compare(code + this.pepper, candidate.appCodeHash);
      if (match) {
        if (
          candidate.deletedAt ||
          candidate.status === 'DELETED' ||
          candidate.status === 'PENDING_CONSENT'
        ) {
          if (attemptKey) {
            await this.redis.incrementWithExpiry(attemptKey, 3600);
          }
          throw new UnauthorizedException('Invalid code');
        }

        if (attemptKey) {
          await this.redis.delete(attemptKey);
        }

        return candidate.id;
      }
    }

    if (attemptKey) {
      await this.redis.incrementWithExpiry(attemptKey, 3600);
    }
    throw new UnauthorizedException('Invalid code');
  }

  async regenerateForUser(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt || user.status === 'DELETED') {
      throw new NotFoundException('User not found');
    }

    const code = this.generateSecureCode();
    const hash = await bcrypt.hash(code + this.pepper, 12);
    const prefix = code.substring(0, 4);

    return await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          appCodeHash: hash,
          appCodePrefix: prefix,
        },
      });

      await tx.customerSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokeReason: 'CODE_REGENERATED',
        },
      });

      return code;
    });
  }

  async hasCode(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { appCodeHash: true },
    });
    return Boolean(user?.appCodeHash);
  }

  private generateSecureCode(): string {
    const maxValid = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
    const chars: string[] = [];
    while (chars.length < CODE_LENGTH) {
      const bytes = randomBytes(CODE_LENGTH * 2);
      for (const byte of bytes) {
        if (byte < maxValid) {
          const char = ALPHABET[byte % ALPHABET.length];
          if (char) {
            chars.push(char);
            if (chars.length === CODE_LENGTH) break;
          }
        }
      }
    }
    return chars.join('');
  }
}
