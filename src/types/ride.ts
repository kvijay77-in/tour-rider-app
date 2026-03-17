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
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
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

  /** Additional notes */
  notes?: string;

  /** Created timestamp */
  createdAt?: string;

  /** Updated timestamp */
  updatedAt?: string;
}
