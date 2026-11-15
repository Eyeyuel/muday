import { SetMetadata } from '@nestjs/common';

export const ADMIN_ROLES_KEY = 'adminRoles';
export const ADMIN_ROLES = ['analytics_viewer', 'super_admin'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const AdminRoles = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);

export function isAdminRole(value: string): value is AdminRole {
  return ADMIN_ROLES.includes(value as AdminRole);
}
