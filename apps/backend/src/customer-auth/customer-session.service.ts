import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment.js';
import { PrismaService } from '../database/prisma.service.js';
import type { CustomerClientType } from '../generated/prisma/client.js';
import { CustomerJwtService } from './customer-jwt.service.js';
import type { CustomerSessionResult, SessionInfo } from './customer-session-types.js';

@Injectable()
export class CustomerSessionService {
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
    @Inject(CustomerJwtService) private readonly jwtService: CustomerJwtService,
  ) {
    this.refreshTokenTtlSeconds = config.get('CUSTOMER_REFRESH_TOKEN_TTL_SECONDS', {
      infer: true,
    });
  }

  async createSession(params: {
    userId: string;
    identityId?: string | null;
    clientType?: CustomerClientType;
    deviceName?: string;
    appVersion?: string;
  }): Promise<CustomerSessionResult> {
    const user = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!user || user.deletedAt || user.status === 'DELETED') {
      throw new UnauthorizedException('User account is deleted or inactive');
    }

    const now = new Date();
    const sessionExpiresAt = new Date(now.getTime() + this.refreshTokenTtlSeconds * 1000);

    const session = await this.prisma.customerSession.create({
      data: {
        userId: params.userId,
        identityId: params.identityId ?? null,
        clientType: params.clientType ?? 'FLUTTER_ANDROID',
        deviceName: params.deviceName ?? 'Mobile Device',
        appVersion: params.appVersion ?? '1.0.0',
        expiresAt: sessionExpiresAt,
      },
    });

    const rawRefreshToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const refreshTokenExpiresAt = new Date(now.getTime() + this.refreshTokenTtlSeconds * 1000);

    await this.prisma.customerRefreshToken.create({
      data: {
        sessionId: session.id,
        tokenHash,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    const accessToken = this.jwtService.signAccessToken({
      userId: user.id,
      sessionId: session.id,
      identityId: params.identityId ?? null,
    });

    return {
      sessionId: session.id,
      accessToken,
      refreshToken: rawRefreshToken,
      expiresInSeconds: this.jwtService.getAccessTokenTtlSeconds(),
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        language: user.language,
        status: user.status,
        createdAt: user.createdAt
          ? new Date(user.createdAt).toISOString()
          : new Date().toISOString(),
      },
    };
  }

  async refreshSession(refreshToken: string): Promise<CustomerSessionResult> {
    const tokenHash = this.hashToken(refreshToken);

    return await this.prisma.$transaction(async (tx) => {
      const tokenRecord = await tx.customerRefreshToken.findUnique({
        where: { tokenHash },
        include: {
          session: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const { session } = tokenRecord;
      const { user } = session;

      if (session.revokedAt) {
        throw new UnauthorizedException('Session has been revoked');
      }

      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        throw new UnauthorizedException('Session has expired');
      }

      if (!user || user.deletedAt || user.status === 'DELETED') {
        throw new UnauthorizedException('User account is deleted or inactive');
      }

      // Token reuse / theft detection: if a used or revoked token is re-submitted, revoke the ENTIRE session family!
      if (tokenRecord.usedAt || tokenRecord.revokedAt) {
        await tx.customerSession.update({
          where: { id: session.id },
          data: {
            revokedAt: new Date(),
            revokeReason: 'TOKEN_REUSE_DETECTED',
          },
        });
        await tx.customerRefreshToken.updateMany({
          where: { sessionId: session.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Session revoked due to token reuse detection');
      }

      if (new Date(tokenRecord.expiresAt).getTime() <= Date.now()) {
        throw new UnauthorizedException('Refresh token has expired');
      }

      const now = new Date();

      // Conditional update: ensure exactly one concurrent refresh succeeds
      const updateResult = await tx.customerRefreshToken.updateMany({
        where: {
          id: tokenRecord.id,
          usedAt: null,
          revokedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      if (updateResult.count === 0) {
        // Race condition: another concurrent request used this token
        await tx.customerSession.update({
          where: { id: session.id },
          data: {
            revokedAt: now,
            revokeReason: 'CONCURRENT_REFRESH_RACE',
          },
        });
        throw new UnauthorizedException('Concurrent refresh conflict; session revoked');
      }

      // Create new rotated refresh token
      const newRawRefreshToken = randomBytes(32).toString('hex');
      const newTokenHash = this.hashToken(newRawRefreshToken);
      const newExpiresAt = new Date(now.getTime() + this.refreshTokenTtlSeconds * 1000);

      await tx.customerRefreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
        },
      });

      await tx.customerSession.update({
        where: { id: session.id },
        data: { lastUsedAt: now },
      });

      const accessToken = this.jwtService.signAccessToken({
        userId: user.id,
        sessionId: session.id,
        identityId: session.identityId ?? null,
      });

      return {
        sessionId: session.id,
        accessToken,
        refreshToken: newRawRefreshToken,
        expiresInSeconds: this.jwtService.getAccessTokenTtlSeconds(),
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          language: user.language,
          status: user.status,
          createdAt: user.createdAt
            ? new Date(user.createdAt).toISOString()
            : new Date().toISOString(),
        },
      };
    });
  }

  async revokeCurrentSession(sessionId: string, reason = 'LOGOUT'): Promise<void> {
    await this.prisma.customerSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async revokeAllUserSessions(userId: string, reason = 'LOGOUT_ALL'): Promise<void> {
    await this.prisma.customerSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  async listUserSessions(userId: string, currentSessionId?: string): Promise<SessionInfo[]> {
    const sessions = await this.prisma.customerSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });

    return sessions.map((s) => ({
      sessionId: s.id,
      clientType: s.clientType,
      deviceName: s.deviceName,
      appVersion: s.appVersion,
      lastUsedAt: s.lastUsedAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      isCurrentSession: currentSessionId ? s.id === currentSessionId : false,
    }));
  }

  async revokeSessionById(userId: string, sessionId: string): Promise<void> {
    await this.prisma.customerSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'REVOKED_BY_USER' },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
