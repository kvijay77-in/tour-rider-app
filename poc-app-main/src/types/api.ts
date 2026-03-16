/**
 * API types for tour-data-api backend communication.
 * Aligned with tour-data-api REST endpoints.
 * See docs/DataIntegrationDesign.md for API details.
 */

import {
  CheckInStatus,
  CheckInMethod,
  RideStatus,
  TourStatus,
} from './models';

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Create check-in request body (POST /v1/tours/{tourId}/checkins)
 */
export interface CheckInRequest {
  riderId: string;
  rideId: string;
  stageNumber: number;
  method: CheckInMethod;
  isNotRiding?: boolean;
  isQuitRiding?: boolean;
  notes?: string;
}

/**
 * Create ride request body (POST /v1/tours/{tourId}/rides)
 */
export interface CreateRideRequest {
  date: string;
  rideNo: number;
  name: string;
  startLocation: string;
  finishLocation: string;
  totalDistance: number;
  flagOffTime: string;
  stages: Array<{
    stageId: string;
    stageNumber: number;
    type: 'START' | 'PIT_STOP' | 'FINISH';
    name: string;
    location?: string;
    distanceFromStart?: number;
    estimatedTimeFromStart?: number;
  }>;
  description?: string;
}

/**
 * Update ride request body (PUT /v1/tours/{tourId}/rides/{rideId})
 */
export interface UpdateRideRequest extends Partial<CreateRideRequest> {
  rideId: string;
}

/**
 * Close ride request (POST /v1/tours/{tourId}/rides/{rideId}/close)
 */
export interface CloseRideRequest {
  rideId: string;
}

/**
 * Create tour request body (POST /v1/tours)
 */
export interface CreateTourRequest {
  tourId: string;
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Standard API response envelope from tour-data-api
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

/**
 * Paginated response (for list operations)
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  total?: number;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface GetRidersQuery {
  limit?: number;
  nextToken?: string;
}

export interface GetRidesQuery {
  date?: string;
  status?: RideStatus;
  limit?: number;
  nextToken?: string;
}

export interface GetCheckInsQuery {
  rideId: string;
  riderId?: string;
  stageId?: string;
  status?: CheckInStatus;
  limit?: number;
  nextToken?: string;
}

export interface GetDashboardDataQuery {
  rideId: string;
}

export interface GetToursQuery {
  status?: TourStatus;
}

// ============================================================================
// SYNC TYPES (for offline support)
// ============================================================================

export interface SyncStatus {
  lastSyncTimestamp?: string;
  pendingChanges: number;
  isSyncing: boolean;
  syncErrors: SyncError[];
}

export interface SyncError {
  id: string;
  operation: 'CHECK_IN' | 'CREATE_RIDE' | 'UPDATE_RIDE';
  data: unknown;
  error: string;
  timestamp: string;
  retryCount: number;
}

export interface PendingCheckIn extends CheckInRequest {
  localId: string;
  createdAt: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED';
}
