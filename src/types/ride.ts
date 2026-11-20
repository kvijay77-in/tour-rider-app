/**
 * Ride type definitions for the Tour Rider App.
 * Aligned with tour-data-api backend data model.
 */

import { StageType } from '../constants/stages';

/**
 * Ride status values
 */
export enum RideStatus {
  PLANNED = 'PLANNED',
  OPEN = 'OPEN',
  STARTED = 'STARTED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

export interface RideSelfService {
  quitRidingAllowed: boolean;
  notRidingAllowed: boolean;
  stages: RideSelfServiceStage[];
}

export interface RideSelfServiceStage {
  stageNumber: number;
  stageId: string;
  stageType: StageType | string;
  checkInAllowed: boolean;
}

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

  /** API stage type alias returned by live ride endpoints */
  stageType?: StageType | string;

  /** Stage name/label */
  name: string;

  /** Location name */
  location?: string;

  /** Distance from start (in km) */
  distanceFromStart?: number;

  /** Estimated time from start (in minutes) */
  estimatedTimeFromStart?: number;

  /** Whether the rider may self-check in for this stage */
  checkInAllowed?: boolean;

  /** Runtime pit-stop state, when this stage is a pit stop */
  pitStopStatus?: 'OPEN' | 'CLOSED' | string;

  /** Runtime pit-stop timestamps */
  openedAt?: string;
  closedAt?: string;
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
  rideNo: number;

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

  /** Backend-resolved self-service policy for the current caller */
  selfService?: RideSelfService;

  /** Timestamp when ride was started */
  startedAt?: string;

  /** Timestamp when ride was completed */
  completedAt?: string;

  /** Additional notes */
  notes?: string;

  /** Created timestamp */
  createdAt?: string;

  /** Updated timestamp */
  updatedAt?: string;
}
