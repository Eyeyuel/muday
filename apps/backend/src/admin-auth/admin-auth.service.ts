import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';

import { ApplicationException } from '../common/errors/application.exception.js';
import { ErrorCode } from '../common/errors/error-code.js';
import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { isAdminRole, type AdminRole } from './admin-role.js';

export interface AdminPayload {
  sub: string;
  email: string;
  displayName: string;
  role: AdminRole;
}

@Injectable()
export class AdminAuthService {
  private readonly secret: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.secret = config.get('ADMIN_JWT_SECRET', { infer: true });
  }

  async login(
    emailInput: string,
    passwordInput: string,
    clientAddress = 'unknown',
  ): Promise<{ token: string; expiresIn: number }> {
    const email = emailInput.trim().toLowerCase();
    const rateLimitKeys = this.loginRateLimitKeys(email, clientAddress);
    const attemptCounts = await Promise.all(
      rateLimitKeys.map((key) => this.redis.incrementWithExpiry(key, 15 * 60)),
    ).catch(() => {
      throw new ApplicationException(
        ErrorCode.SERVICE_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
        'Administrator sign-in is temporarily unavailable',
      );
    });
    if ((attemptCounts[0] ?? 0) > 5 || (attemptCounts[1] ?? 0) > 100) {
      throw new ApplicationException(
        ErrorCode.RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
        'Too many sign-in attempts. Try again in 15 minutes.',
      );
    }
    const user = await this.prisma.adminUser.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      // Run dummy bcrypt compare to prevent timing enumeration attack
      await bcrypt.compare('dummy', '$2b$12$eX8O1b/4B3k0m.x1Y2z3u.VqW4x5y6z7a8b9c0d1e2f3g4h5i6j7k');
      this.unauthorized();
    }

    const matches = await bcrypt.compare(passwordInput, user.passwordHash);
    if (!matches) this.unauthorized();

    if (!isAdminRole(user.role)) this.unauthorized();

    const payload: AdminPayload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };

    const expiresIn = 28800; // 8 hours in seconds
    const token = jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      issuer: 'muday-api',
      audience: 'muday-admin',
      expiresIn,
    });

    await this.redis.delete(...rateLimitKeys);

    return { token, expiresIn };
  }

  async verifyActiveToken(token: string): Promise<AdminPayload> {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: 'muday-api',
        audience: 'muday-admin',
      }) as AdminPayload;
      if (!decoded?.sub || !decoded.email || !isAdminRole(decoded.role)) this.unauthorized();

      const current = await this.prisma.adminUser.findUnique({ where: { id: decoded.sub } });
      if (!current?.isActive || current.email !== decoded.email || !isAdminRole(current.role)) {
        this.unauthorized();
      }

      return {
        sub: current.id,
        email: current.email,
        displayName: current.displayName,
        role: current.role,
      };
    } catch {
      this.unauthorized();
    }
  }

  private loginRateLimitKeys(email: string, clientAddress: string): string[] {
    const digest = (value: string) => createHash('sha256').update(value).digest('hex');
    return [
      `admin-login:email:${digest(email)}`,
      `admin-login:network:${digest(clientAddress.trim().toLowerCase())}`,
    ];
  }

  private unauthorized(): never {
    throw new ApplicationException(
      ErrorCode.MINIAPP_AUTH_INVALID,
      HttpStatus.UNAUTHORIZED,
      'Invalid email or password',
    );
  }
}
