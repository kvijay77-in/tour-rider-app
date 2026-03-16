/**
 * Data Models for Cycling Tour Management App
 * Based on Requirements.md specifications and tour-data-api backend data model.
 * See docs/DataIntegrationDesign.md for alignment details.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Tour status values
 * Flow: PLANNING → PROVISIONING → ACTIVE → COMPLETED → ARCHIVED
 */
export enum TourStatus {
  PLANNING = 'PLANNING',
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Stage types in a ride
 */
export enum StageType {
  START = 'START',
  PIT_STOP = 'PIT_STOP',
  FINISH = 'FINISH',
}

/**
 * Ride status values
 * Aligned with backend: PLANNED, ACTIVE, COMPLETED, CLOSED
 */
export enum RideStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

/**
 * Check-in status types
 * 
 * Note: NOT_CHECKED_IN is a UI-only status representing the absence of a check-in record.
 * It is never stored in the database. Only CHECKED_IN, NOT_RIDING, and QUIT_RIDING 
 * are actual database values.
 * 
 * Backend derives status from boolean flags:
 * - isNotRiding=true → NOT_RIDING
 * - isQuitRiding=true → QUIT_RIDING
 * - Both false → CHECKED_IN
 */
export enum CheckInStatus {
  NOT_CHECKED_IN = 'NOT_CHECKED_IN', // UI-only: derived from absence of CheckIn record
  CHECKED_IN = 'CHECKED_IN',
  NOT_RIDING = 'NOT_RIDING',
  QUIT_RIDING = 'QUIT_RIDING',
}

/**
 * Check-in method values
 */
export enum CheckInMethod {
  QR_SCAN = 'QR_SCAN',
  MANUAL = 'MANUAL',
  FALLBACK = 'FALLBACK',
}

/**
 * Tour rider registration status
 */
export enum TourRiderStatus {
  REGISTERED = 'REGISTERED',
  ACTIVE = 'ACTIVE',
  WITHDRAWN = 'WITHDRAWN',
}

/**
 * User roles for RBAC
 */
export enum UserRole {
  ADMINISTRATOR = 'ADMINISTRATOR',
  SUPER_USER = 'SUPER_USER',
  PIT_STOP_CREW = 'PIT_STOP_CREW',
  HOTEL_STAFF = 'HOTEL_STAFF',
  GUEST = 'GUEST',
}

// ============================================================================
// TOUR
// ============================================================================

/**
 * Tour definition (from shared TourMaster table)
 */
export interface Tour {
  /** Free-form unique identifier (e.g., TOT-2026) */
  tourId: string;

  /** Tour name */
  name: string;

  /** Tour start date (ISO 8601 date) */
  startDate: string;

  /** Tour end date (ISO 8601 date) */
  endDate: string;

  /** Tour status */
  status: TourStatus;

  /** Tour description */
  description?: string;

  /** Timestamp when tour tables were provisioned */
  provisionedAt?: string;

  /** Timestamp when tour was archived */
  archivedAt?: string;

  /** Created timestamp */
  createdAt: string;

  /** Updated timestamp */
  updatedAt: string;
}

// ============================================================================
// RIDER
// ============================================================================

/**
 * Rider profile information (from shared RiderProfile table)
 * Note: This data is read-only from the app's perspective
 */
export interface RiderProfile {
  /** Unique profile identifier (UUID) */
  profileId: string;

  /** Rider's full name */
  name: string;

  /** Contact email */
  email?: string;

  /** Contact phone */
  phone?: string;

  /** Emergency contact name */
  emergencyContactName?: string;

  /** Emergency contact phone */
  emergencyContactPhone?: string;

  /** S3 object key for rider photo */
  photoS3Key?: string;

  /** Created timestamp */
  createdAt?: string;

  /** Updated timestamp */
  updatedAt?: string;
}

/**
 * Tour-specific rider registration (from TourRider-{tourId} table)
 */
export interface TourRider {
  /** Tour-specific rider ID (e.g., R1, R57) */
  riderId: string;

  /** Reference to RiderProfile */
  profileId: string;

  /** Registration status */
  status: TourRiderStatus;

  /** QR code data (currently just riderId) */
  qrCodeData?: string;

  /** Registration timestamp */
  registeredAt?: string;

  /** Created timestamp */
  createdAt?: string;

  /** Updated timestamp */
  updatedAt?: string;
}

/**
 * Combined rider info returned by dashboard API
 * Merges TourRider and RiderProfile data
 */
export interface Rider {
  /** Tour-specific rider ID (e.g., R1, R57) */
  riderId: string;

  /** Reference to RiderProfile */
  profileId?: string;

  /** Rider's full name */
  name: string;

  /** Contact email */
  email?: string;

  /** Contact phone */
  phone?: string;

  /** Emergency contact name */
  emergencyContactName?: string;

  /** Emergency contact phone */
  emergencyContactPhone?: string;

  /** S3 object key for rider photo */
  photoS3Key?: string;

  /** QR code data (embedded rider info) */
  qrCodeData?: string;

  /** Tour rider registration status */
  status?: string;
}

// ============================================================================
// RIDE
// ============================================================================

/**
 * Stage information within a ride
 */
export interface Stage {
  /** Stage ID (e.g., S001) */
  stageId: string;
  
  /** Stage number (1-based) */
  stageNumber: number;
  
  /** Stage type */
  type: StageType;
  
  /** Stage name/label */
  name: string;

  /** Location name */
  location?: string;
  
  /** Distance from start (in km) */
  distanceFromStart?: number;
  
  /** Estimated time from start (in minutes) */
  estimatedTimeFromStart?: number;
}

/**
 * Daily ride configuration (from Ride-{tourId} table)
 */
export interface Ride {
  /** Unique ride identifier (e.g., RIDE001) */
  rideId: string;
  
  /** Ride date (ISO 8601 format: YYYY-MM-DD) */
  date: string;

  /** Ride sequence number for the day */
  rideNo?: number;
  
  /** Ride name/title (e.g., Day1, Day2) */
  name: string;
  
  /** Starting location */
  startLocation: string;
  
  /** Finish location */
  finishLocation: string;

  /** Optional description */
  description?: string;
  
  /** Total distance (in km) */
  totalDistance: number;

  /** Planned flag-off time */
  flagOffTime?: string;
  
  /** List of stages (Start, Pit Stops, Finish) */
  stages: Stage[];
  
  /** Ride status */
  status: RideStatus;
  
  /** Timestamp when ride was started */
  startedAt?: string;
  
  /** Timestamp when ride was completed */
  completedAt?: string;
  
  /** Timestamp when ride was closed (locked) */
  closedAt?: string;
  
  /** Additional notes */
  notes?: string;

  /** Created timestamp */
  createdAt?: string;

  /** Updated timestamp */
  updatedAt?: string;
}

// ============================================================================
// CHECK-IN
// ============================================================================

/**
 * Check-in record for a rider at a specific stage (from CheckIn-{tourId} table)
 * 
 * Status is derived from boolean flags, not stored directly:
 * - isNotRiding=true → NOT_RIDING
 * - isQuitRiding=true → QUIT_RIDING
 * - Both false → CHECKED_IN
 */
export interface CheckIn {
  /** Unique check-in identifier (format: <riderId>#<stageNumber (3-digit padded)>#<ISO 8601 timestamp>) */
  checkInId: string;
  
  /** Rider ID */
  riderId: string;
  
  /** Ride ID */
  rideId: string;

  /** Stage number (1-based) */
  stageNumber: number;
  
  /** Stage ID reference */
  stageId: string;
  
  /** Timestamp of check-in (ISO 8601) */
  timestamp: string;
  
  /** User who performed the check-in */
  checkedInBy: string;
  
  /** Check-in method */
  method: CheckInMethod;

  /** True if rider is Not Riding for the day */
  isNotRiding: boolean;

  /** True if rider has Quit Riding */
  isQuitRiding: boolean;

  /** True if check-in was done manually (not via QR scan) */
  isManualEntry?: boolean;
  
  /** Notes/remarks */
  notes?: string;
  
  /** Location coordinates (if available) */
  location?: {
    latitude: number;
    longitude: number;
  };

  /** Created timestamp */
  createdAt?: string;
}

// ============================================================================
// USER & RBAC
// ============================================================================

/**
 * Feature/permission labels for RBAC
 */
export enum Permission {
  // Dashboard
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  VIEW_HISTORICAL_DASHBOARD = 'VIEW_HISTORICAL_DASHBOARD',
  
  // Check-in
  CHECKIN_RIDER = 'CHECKIN_RIDER',
  CHECKIN_NOT_RIDING = 'CHECKIN_NOT_RIDING',
  CHECKIN_QUIT_RIDING = 'CHECKIN_QUIT_RIDING',
  MANUAL_CHECKIN = 'MANUAL_CHECKIN',
  
  // Admin features
  ADD_MODIFY_RIDE = 'ADD_MODIFY_RIDE',
  CLOSE_RIDE = 'CLOSE_RIDE',
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_ROLES = 'MANAGE_ROLES',
}

/**
 * Role definition with permissions
 */
export interface Role {
  /** Role identifier */
  roleId: string;
  
  /** Role type */
  role: UserRole;
  
  /** Role display name */
  name: string;
  
  /** Role description */
  description: string;
  
  /** List of permissions */
  permissions: Permission[];
  
  /** For Pit Stop Crew: assigned stage number */
  assignedStage?: number;
}

/**
 * Application user
 */
export interface User {
  /** User ID (Cognito sub) */
  userId: string;
  
  /** Username */
  username: string;
  
  /** Email */
  email: string;
  
  /** Full name */
  name: string;
  
  /** Assigned role */
  role: Role;
  
  /** Account status */
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  
  /** Last login timestamp */
  lastLoginAt?: string;
  
  /** Created timestamp */
  createdAt: string;
  
  /** Updated timestamp */
  updatedAt: string;
}

// ============================================================================
// DASHBOARD
// ============================================================================

/**
 * Rider status for dashboard display
 */
export interface RiderStatus {
  /** Rider information */
  rider: Rider;
  
  /** Current ride */
  ride: Ride;
  
  /** Last check-in record */
  lastCheckIn?: CheckIn;
  
  /** Overall status for the ride */
  overallStatus: CheckInStatus;
  
  /** Last stage where rider checked in */
  lastStage?: Stage;
  
  /** Check-in history for the current ride */
  checkInHistory: CheckIn[];
}

/**
 * Dashboard filter options
 */
export interface DashboardFilter {
  /** Filter by stage */
  stageId?: string;
  
  /** Filter by status */
  status?: CheckInStatus;
}

/**
 * Dashboard sort options
 */
export enum DashboardSortOption {
  RIDER_ID = 'RIDER_ID',
  STAGE = 'STAGE',
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Derive CheckInStatus from a CheckIn record's boolean flags.
 * Backend stores isNotRiding/isQuitRiding flags; status is derived.
 * 
 * Note: Business rules prevent both isNotRiding and isQuitRiding from being true
 * simultaneously. If both are somehow set, isNotRiding takes precedence.
 */
export const deriveCheckInStatus = (checkIn: CheckIn): CheckInStatus => {
  if (checkIn.isNotRiding) return CheckInStatus.NOT_RIDING;
  if (checkIn.isQuitRiding) return CheckInStatus.QUIT_RIDING;
  return CheckInStatus.CHECKED_IN;
};

// ============================================================================
// DASHBOARD API RESPONSE
// ============================================================================

/**
 * Dashboard summary statistics returned by the API
 */
export interface DashboardSummary {
  totalRiders: number;
  checkedIn: number;
  notRiding: number;
  quitRiding: number;
  notCheckedIn: number;
}

/**
 * Complete dashboard data returned by GET /v1/tours/{tourId}/rides/{rideId}/dashboard
 */
export interface DashboardData {
  ride: Ride;
  riders: Rider[];
  checkIns: CheckIn[];
  summary: DashboardSummary;
}
