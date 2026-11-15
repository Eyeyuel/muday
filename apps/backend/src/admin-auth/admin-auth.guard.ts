import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { ApplicationException } from '../common/errors/application.exception.js';
import { ErrorCode } from '../common/errors/error-code.js';
import { AdminAuthService, type AdminPayload } from './admin-auth.service.js';

export interface AuthenticatedAdminRequest extends Request {
  adminUser?: AdminPayload;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(@Inject(AdminAuthService) private readonly adminAuth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedAdminRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApplicationException(
        ErrorCode.MINIAPP_AUTH_INVALID,
        HttpStatus.UNAUTHORIZED,
        'Admin authorization token required',
      );
    }

    const token = authHeader.slice(7).trim();
    const adminUser = await this.adminAuth.verifyActiveToken(token);
    request.adminUser = adminUser;

    return true;
  }
}
