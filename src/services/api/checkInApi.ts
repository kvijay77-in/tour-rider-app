/**
 * Check-in API service.
 * Handles check-in status retrieval and self-service actions (Not Riding, Quit Riding)
 * via tour-data-api.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse, PaginatedResponse } from '../../types/api';
import type {
  CheckIn,
  CheckInHistory,
  NotRidingRequest,
  QuitRidingRequest,
  SelfCheckInRequest,
} from '../../types/checkin';

const TAG = 'CheckInApi';

function normalizeCheckIns(payload: unknown): CheckIn[] {
  if (Array.isArray(payload)) {
    return payload as CheckIn[];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const response = payload as Record<string, unknown>;
  if (Array.isArray(response.checkIns)) return response.checkIns as CheckIn[];
  if (Array.isArray(response.items)) return response.items as CheckIn[];
  return [];
}

function normalizeHistory(
  payload: unknown,
  tourId: string,
  riderId: string,
  rideNo: number,
): CheckInHistory {
  const records = normalizeCheckIns(payload);
  return {
    ...(payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).tourId === 'string'
      ? { tourId: (payload as Record<string, unknown>).tourId as string }
      : { tourId }),
    riderId,
    rideNo,
    checkIns: records,
    available: records.length > 0,
  };
}

/**
 * Get the signed-in rider's check-ins for a ride number.
 * A missing check-in table is a valid empty history for Rider API callers.
 */
export async function getRiderRideCheckIns(
  tourId: string,
  riderId: string,
  rideNo: number,
): Promise<ApiResponse<CheckInHistory>> {
  logger.debug(TAG, `Fetching rider ${riderId} check-ins for ride ${rideNo} in tour ${tourId}`);
  const response = await apiClient.get<unknown>(
    `/v1/tours/${encodeURIComponent(tourId)}/riders/${encodeURIComponent(riderId)}/rides/${encodeURIComponent(String(rideNo))}/checkins`,
    {
      returnErrorResponseForStatuses: [404],
      isExpectedError: (error) => error.statusCode === 404,
    },
  );

  if (!response.success) {
    if (response.error?.code === 'HTTP_404' || response.error?.code === 'CHECKINS_NOT_FOUND') {
      return {
        success: true,
        data: { tourId, riderId, rideNo, checkIns: [], available: false },
        timestamp: response.timestamp,
      };
    }
    return response as ApiResponse<CheckInHistory>;
  }

  return {
    ...response,
    data: normalizeHistory(response.data, tourId, riderId, rideNo),
  };
}

/** Submit one Rider self-check-in request. Phase 1 exposes this for Phase 2 callers only. */
export async function submitSelfCheckIn(
  tourId: string,
  rideId: string,
  body: SelfCheckInRequest,
): Promise<ApiResponse<CheckIn>> {
  logger.info(TAG, `Submitting self check-in for ride ${rideId} in tour ${tourId}`);
  return apiClient.post<CheckIn>(
    `/v1/tours/${encodeURIComponent(tourId)}/rides/${encodeURIComponent(rideId)}/self-checkins`,
    body,
  );
}

/** Cancel a Rider-owned eligible self-check-in. */
export async function cancelSelfCheckIn(
  tourId: string,
  rideId: string,
  checkInId: string,
): Promise<ApiResponse<CheckIn>> {
  logger.info(TAG, `Cancelling self check-in ${checkInId} for ride ${rideId} in tour ${tourId}`);
  return apiClient.post<CheckIn>(
    `/v1/tours/${encodeURIComponent(tourId)}/rides/${encodeURIComponent(rideId)}/self-checkins/${encodeURIComponent(checkInId)}/cancel`,
    {},
  );
}

/**
 * Get rider's check-ins for a specific ride.
 */
export async function getRideCheckIns(
  tourId: string,
  rideId: string,
  params?: Record<string, string>,
): Promise<ApiResponse<PaginatedResponse<CheckIn>>> {
  logger.debug(TAG, `Fetching check-ins for ride ${rideId} in tour ${tourId}`);
  return apiClient.get<PaginatedResponse<CheckIn>>(
    `/v1/tours/${encodeURIComponent(tourId)}/rides/${encodeURIComponent(rideId)}/checkins`,
    { params },
  );
}

/**
 * Submit a Not Riding self-service check-in.
 */
export async function submitNotRiding(
  tourId: string,
  data: NotRidingRequest,
): Promise<ApiResponse<CheckIn>> {
  logger.info(TAG, `Submitting Not Riding for rider ${data.riderId} in tour ${tourId}`);
  return apiClient.post<CheckIn>(
    `/v1/tours/${encodeURIComponent(tourId)}/checkins`,
    {
      ...data,
      stageNumber: 1,
      method: 'SELF_SERVICE',
      isNotRiding: true,
      isQuitRiding: false,
    },
  );
}

/**
 * Submit a Quit Riding self-service check-in.
 * Quit Riding ends the current ride midway — the rider started but decides to stop.
 */
export async function submitQuitRiding(
  tourId: string,
  data: QuitRidingRequest,
): Promise<ApiResponse<CheckIn>> {
  logger.info(TAG, `Submitting Quit Riding for rider ${data.riderId} in tour ${tourId}, ride ${data.rideId}`);
  return apiClient.post<CheckIn>(
    `/v1/tours/${encodeURIComponent(tourId)}/checkins`,
    {
      riderId: data.riderId,
      rideId: data.rideId,
      stageNumber: 1,
      method: 'SELF_SERVICE',
      isNotRiding: false,
      isQuitRiding: true,
      notes: data.reason,
      location: data.location,
    },
  );
}
