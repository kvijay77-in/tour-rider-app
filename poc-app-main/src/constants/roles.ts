/**
 * Role definitions with permissions for RBAC
 */

import { UserRole, Permission, Role } from '../types/models';

/**
 * Administrator role - Full access to all features
 */
export const ADMINISTRATOR_ROLE: Role = {
  roleId: 'role_admin',
  role: UserRole.ADMINISTRATOR,
  name: 'Administrator',
  description: 'Full unrestricted access to all features and functions',
  permissions: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_HISTORICAL_DASHBOARD,
    Permission.CHECKIN_RIDER,
    Permission.CHECKIN_NOT_RIDING,
    Permission.CHECKIN_QUIT_RIDING,
    Permission.MANUAL_CHECKIN,
    Permission.ADD_MODIFY_RIDE,
    Permission.CLOSE_RIDE,
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
  ],
};

/**
 * Super User role - All access except ride management
 */
export const SUPER_USER_ROLE: Role = {
  roleId: 'role_super_user',
  role: UserRole.SUPER_USER,
  name: 'Super User',
  description: 'Access to all features except Add/Modify and Close Ride',
  permissions: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_HISTORICAL_DASHBOARD,
    Permission.CHECKIN_RIDER,
    Permission.CHECKIN_NOT_RIDING,
    Permission.CHECKIN_QUIT_RIDING,
    Permission.MANUAL_CHECKIN,
  ],
};

/**
 * Pit Stop Crew role - Check-in and dashboard access for assigned pit stop
 */
export const PIT_STOP_CREW_ROLE: Role = {
  roleId: 'role_pit_stop_crew',
  role: UserRole.PIT_STOP_CREW,
  name: 'Pit Stop Crew',
  description: 'Check-in access for assigned pit stop with dashboard view',
  permissions: [
    Permission.VIEW_DASHBOARD,
    Permission.CHECKIN_RIDER,
    Permission.CHECKIN_NOT_RIDING,
    Permission.CHECKIN_QUIT_RIDING,
    // Note: MANUAL_CHECKIN not included per requirements
  ],
  assignedStage: undefined, // Set when assigning to user
};

/**
 * Hotel Staff role - Finish check-in only, no dashboard access
 */
export const HOTEL_STAFF_ROLE: Role = {
  roleId: 'role_hotel_staff',
  role: UserRole.HOTEL_STAFF,
  name: 'Hotel Staff',
  description: 'Finish stage check-in only, no dashboard access',
  permissions: [
    Permission.CHECKIN_RIDER,
    // Dashboard access explicitly not included
  ],
};

/**
 * Guest role - Read-only dashboard access
 */
export const GUEST_ROLE: Role = {
  roleId: 'role_guest',
  role: UserRole.GUEST,
  name: 'Guest',
  description: 'Read-only dashboard access to view ride progress',
  permissions: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_HISTORICAL_DASHBOARD,
  ],
};

/**
 * Map of all available roles
 */
export const ROLES_MAP: Record<UserRole, Role> = {
  [UserRole.ADMINISTRATOR]: ADMINISTRATOR_ROLE,
  [UserRole.SUPER_USER]: SUPER_USER_ROLE,
  [UserRole.PIT_STOP_CREW]: PIT_STOP_CREW_ROLE,
  [UserRole.HOTEL_STAFF]: HOTEL_STAFF_ROLE,
  [UserRole.GUEST]: GUEST_ROLE,
};

/**
 * Get role by UserRole enum
 */
export const getRoleByType = (roleType: UserRole): Role => {
  return ROLES_MAP[roleType];
};

/**
 * Create Pit Stop Crew role with assigned stage
 */
export const createPitStopCrewRole = (stageNumber: number): Role => {
  return {
    ...PIT_STOP_CREW_ROLE,
    roleId: `role_pit_stop_crew_stage_${stageNumber}`,
    name: `Pit Stop Crew - Stage ${stageNumber}`,
    assignedStage: stageNumber,
  };
};
