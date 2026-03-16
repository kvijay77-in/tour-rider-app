/**
 * Navigation types for React Navigation
 */

import { UserRole } from './models';

// ============================================================================
// AUTH STACK
// ============================================================================

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

// ============================================================================
// MAIN APP STACK
// ============================================================================

export type MainStackParamList = {
  Dashboard: {
    rideDate?: string; // For historical view
  };
  CheckIn: {
    stageId: string;
    riderId?: string; // Pre-filled for manual check-in
  };
  AdminRideManagement: undefined;
  AddEditRide: {
    rideId?: string; // undefined for new ride
  };
  Profile: undefined;
};

// ============================================================================
// ROOT NAVIGATOR
// ============================================================================

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Loading: undefined;
};

// ============================================================================
// NAVIGATION PROPS
// ============================================================================

export type NavigationProps = {
  userRole: UserRole;
  isAuthenticated: boolean;
};
