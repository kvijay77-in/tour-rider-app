/**
 * Check-in API service.
 * Handles check-in status retrieval and self-service actions (Not Riding, Quit Riding)
 * via tour-data-api.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse, PaginatedResponse } from '../../types/api';
import type { CheckIn, NotRidingRequest, QuitRidingRequest } from '../../types/checkin';

const TAG = 'CheckInApi';

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
