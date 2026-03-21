/**
 * Tour type definitions for the Tour Rider App.
 * Aligned with tour-data-api backend data model.
 */

/**
 * Tour status values
 */
export enum TourStatus {
  PLANNING = 'PLANNING',
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Tour rider registration status
 */
export enum TourRiderStatus {
  PENDING = 'PENDING',
  REGISTERED = 'REGISTERED',
  ACTIVE = 'ACTIVE',
  WITHDRAWN = 'WITHDRAWN',
  REJECTED = 'REJECTED',
}

/**
 * Tour definition (from TourMaster table)
 */
export interface Tour {
  /** Unique tour identifier (e.g., TOT-2026) */
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

  /** Tour location/region */
  location?: string;

  /** Tour organizer name */
  organizer?: string;

  /** Number of rides in the tour */
  rideCount?: number;

  /** Whether registration is open */
  registrationOpen?: boolean;

  /** Created timestamp */
  createdAt: string;

  /** Updated timestamp */
  updatedAt: string;
}

/**
 * Tour rider enrollment record (from TourRider-{tourId} table)
 */
export interface TourRider {
  /** Tour-specific rider ID (e.g., R1, R57) */
  riderId: string;

  /** Reference to RiderProfile */
  profileId: string;

  /** Registration status */
  status: TourRiderStatus;

  /** Cycling experience level */
  experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced';

  /** Medical conditions/allergies */
  medicalConditions?: string;

  /** Special requirements */
  specialRequirements?: string;

  /** Registration timestamp */
  registeredAt?: string;

  /** Created timestamp */
  createdAt?: string;

  /** Updated timestamp */
  updatedAt?: string;
}

/**
 * Tour registration request
 */
export interface TourRegistrationRequest {
  profileId: string;
  experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  medicalConditions?: string;
  specialRequirements?: string;
}

/**
 * Rider statistics for a tour
 */
export interface RiderTourStatistics {
  /** Total rides completed */
  ridesCompleted: number;

  /** Rides not completed (Not Riding days) */
  ridesNotCompleted: number;

  /** Current consecutive ride streak */
  currentStreak: number;

  /** Total distance covered (km) */
  totalDistance: number;
}
