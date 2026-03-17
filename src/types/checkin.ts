/**
 * Check-in type definitions for the Tour Rider App.
 * Aligned with tour-data-api backend data model.
 */

/**
 * Check-in status types
 */
export enum CheckInStatus {
  NOT_CHECKED_IN = 'NOT_CHECKED_IN',
  CHECKED_IN = 'CHECKED_IN',
  NOT_RIDING = 'NOT_RIDING',
  QUIT_RIDING = 'QUIT_RIDING',
}

/**
 * Check-in record for a rider at a specific stage (from CheckIn-{tourId} table)
 */
export interface CheckIn {
  /** Unique check-in identifier */
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

  /** True if rider is Not Riding for the day */
  isNotRiding: boolean;

  /** True if rider has Quit Riding */
  isQuitRiding: boolean;

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

/**
 * Not Riding request body
 */
export interface NotRidingRequest {
  riderId: string;
  rideId: string;
}

/**
 * Quit Riding request body
 */
export interface QuitRidingRequest {
  riderId: string;
  reason?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Derive CheckInStatus from a CheckIn record's boolean flags.
 */
export const deriveCheckInStatus = (checkIn: CheckIn): CheckInStatus => {
  if (checkIn.isNotRiding) return CheckInStatus.NOT_RIDING;
  if (checkIn.isQuitRiding) return CheckInStatus.QUIT_RIDING;
  return CheckInStatus.CHECKED_IN;
};
