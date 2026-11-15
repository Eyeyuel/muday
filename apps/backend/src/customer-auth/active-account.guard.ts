import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { UserStatus } from '../generated/prisma/client.js';

@Injectable()
export class ActiveAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { customerUser?: { status: UserStatus; deletedAt?: Date | null } }>();
    const user = request.customerUser;

    if (!user) {
      throw new UnauthorizedException('Customer context not found');
    }

    if (user.deletedAt || user.status === 'DELETED') {
      throw new ForbiddenException('User account has been deleted');
    }

    if (user.status === 'PENDING_CONSENT') {
      throw new ForbiddenException('Consent is required before performing financial operations');
    }

    if (user.status === 'PAUSED') {
      throw new ForbiddenException('Account is paused; financial operations are blocked');
    }

    if (user.status === 'DELETING') {
      throw new ForbiddenException('Account is pending deletion; financial operations are blocked');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Financial operations require an active account');
    }

    return true;
  }
}
