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

export type CheckInMethod = 'QR_SCAN' | 'MANUAL' | 'SELF_SERVICE' | string;

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

  /** Method used to create the record */
  method?: CheckInMethod;

  /** Backend status for the record */
  status?: CheckInStatus | 'FLOAT' | 'CANCELLED' | string;

  /** Ride sequence number returned by rider-history endpoints */
  rideNo?: number;

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

  /** Cancellation audit metadata */
  cancelledAt?: string;
  cancelledBy?: string;
}

export interface CheckInHistory {
  tourId?: string;
  riderId: string;
  rideNo: number;
  checkIns: CheckIn[];
  available: boolean;
}

export type SelfCheckInRequest =
  | { stageNumber: number; isNotRiding?: never; isQuitRiding?: never; timestamp?: string; notes?: string }
  | { isNotRiding: true; stageNumber?: never; isQuitRiding?: never; timestamp?: string; notes?: string }
  | { isQuitRiding: true; stageNumber?: never; isNotRiding?: never; timestamp?: string; notes?: string };

/**
 * Not Riding request body
 */
export interface NotRidingRequest {
  riderId: string;
  rideId: string;
}

/**
 * Quit Riding request body.
 * Quit Riding ends the current ride midway — the rider started the ride but
 * decides to stop (e.g., injury, mechanical issue). Applies to the current
 * ride only; the rider can participate in the next ride.
 */
export interface QuitRidingRequest {
  riderId: string;
  rideId: string;
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
