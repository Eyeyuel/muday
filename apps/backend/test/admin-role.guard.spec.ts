import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { AdminRoleGuard } from '../src/admin-auth/admin-role.guard.js';

function contextWithRole(role: string): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ adminUser: { role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminRoleGuard', () => {
  it('allows a super administrator through a protected mutation', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['super_admin']),
    } as unknown as Reflector;
    const guard = new AdminRoleGuard(reflector);

    expect(guard.canActivate(contextWithRole('super_admin'))).toBe(true);
  });

  it('rejects an analytics viewer from a protected mutation', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['super_admin']),
    } as unknown as Reflector;
    const guard = new AdminRoleGuard(reflector);

    expect(() => guard.canActivate(contextWithRole('analytics_viewer'))).toThrow(
      'administrator role',
    );
  });
});
