import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedAdminRequest } from './admin-auth.guard.js';
import { ADMIN_ROLES_KEY, type AdminRole } from './admin-role.js';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const admin = context.switchToHttp().getRequest<AuthenticatedAdminRequest>().adminUser;
    if (!admin || !requiredRoles.includes(admin.role)) {
      throw new ForbiddenException('Your administrator role cannot perform this action');
    }
    return true;
  }
}
