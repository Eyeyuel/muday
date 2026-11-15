import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';

import type { Environment } from '../config/environment.js';
import type { CustomerJwtPayload } from './customer-session-types.js';

@Injectable()
export class CustomerJwtService {
  private readonly secret: string;
  private readonly accessTokenTtlSeconds: number;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.secret = config.get('CUSTOMER_JWT_SECRET', { infer: true });
    this.accessTokenTtlSeconds = config.get('CUSTOMER_ACCESS_TOKEN_TTL_SECONDS', { infer: true });
  }

  signAccessToken(params: {
    userId: string;
    sessionId: string;
    identityId?: string | null;
  }): string {
    const payload = {
      sub: params.userId,
      sid: params.sessionId,
      sessionId: params.sessionId,
      ...(params.identityId ? { identityId: params.identityId } : {}),
      role: 'customer' as const,
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.accessTokenTtlSeconds,
      algorithm: 'HS256',
      issuer: 'muday-api',
      audience: 'muday-customer',
    });
  }

  verifyAccessToken(token: string): CustomerJwtPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: 'muday-api',
        audience: 'muday-customer',
      }) as CustomerJwtPayload;

      if (decoded.role !== 'customer') {
        throw new UnauthorizedException('Invalid token role');
      }

      if (!decoded.sub || (!decoded.sid && !decoded.sessionId)) {
        throw new UnauthorizedException('Missing required JWT subject or session claims');
      }

      const sid = decoded.sid || decoded.sessionId || '';

      return {
        ...decoded,
        sid,
        sessionId: sid,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired customer access token');
    }
  }

  getAccessTokenTtlSeconds(): number {
    return this.accessTokenTtlSeconds;
  }
}
