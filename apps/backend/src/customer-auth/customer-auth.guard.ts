import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { PrismaService } from '../database/prisma.service.js';
import { CustomerJwtService } from './customer-jwt.service.js';
import type { CustomerJwtPayload } from './customer-session-types.js';

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    @Inject(CustomerJwtService) private readonly jwtService: CustomerJwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: CustomerJwtPayload }>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7).trim();
    const payload = this.jwtService.verifyAccessToken(token);
    const sessionId = payload.sid || payload.sessionId;

    if (!sessionId) {
      throw new UnauthorizedException('Invalid or missing session identifier in token');
    }

    const session = await this.prisma.customerSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new UnauthorizedException('Customer session is invalid, expired, or revoked');
    }

    if (payload.sub !== session.userId || sessionId !== session.id) {
      throw new UnauthorizedException('Customer session token subject or session mismatch');
    }

    if (!session.user || session.user.deletedAt || session.user.status === 'DELETED') {
      throw new UnauthorizedException('User account is deleted or inactive');
    }

    request.user = payload;
    (request as Request & { customerUser?: typeof session.user }).customerUser = session.user;
    return true;
  }
}
