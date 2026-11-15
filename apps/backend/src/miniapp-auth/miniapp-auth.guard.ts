import { CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { MiniAppAuthService } from './miniapp-auth.service.js';
import type { MiniAppAuthenticatedRequest } from './miniapp-auth.types.js';

@Injectable()
export class MiniAppAuthGuard implements CanActivate {
  constructor(@Inject(MiniAppAuthService) private readonly auth: MiniAppAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & MiniAppAuthenticatedRequest>();
    const authorization = request.headers.authorization;
    request.miniAppUser = await this.auth.authenticate(authorization);
    return true;
  }
}
