/**
 * RBAC permission utilities.
 *
 * Checks whether a user role grants a specific permission using
 * the ROLES_MAP defined in constants/roles.ts.
 *
 * See docs/Requirements.md § Role Based App Access.
 */

import { UserRole, Permission } from '../types/models';
import { ROLES_MAP } from '../constants/roles';

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const roleDef = ROLES_MAP[role];
  return roleDef?.permissions.includes(permission) ?? false;
}

/**
 * Check if a role has ALL of the specified permissions.
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
