/**
 * Ride API service.
 * Handles ride information retrieval via tour-data-api.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse, PaginatedResponse } from '../../types/api';
import type { Ride } from '../../types/ride';

const TAG = 'RideApi';

function normalizeRideListPayload(payload: unknown): PaginatedResponse<Ride> {
  if (Array.isArray(payload)) {
    return { items: payload };
  }

  if (!payload || typeof payload !== 'object') {
    return { items: [] };
  }

  const response = payload as Record<string, unknown>;
  const items =
    (Array.isArray(response.items) ? response.items : undefined) ??
    (Array.isArray(response.rides) ? response.rides : undefined) ??
    (Array.isArray(response.results) ? response.results : undefined) ??
    (Array.isArray(response.data) ? response.data : undefined) ??
    [];

  return {
    items,
    ...(typeof response.nextToken === 'string'
      ? { nextToken: response.nextToken }
      : {}),
    ...(typeof response.total === 'number'
      ? { total: response.total }
      : {}),
  };
}

/**
 * Get today's ride for a specific tour.
 */
export async function getTodaysRide(
  tourId: string,
): Promise<ApiResponse<Ride>> {
  logger.debug(TAG, `Fetching today's ride for tour ${tourId}`);
  return apiClient.get<Ride>(
    `/v1/tours/${encodeURIComponent(tourId)}/rides/today`,
    {
      returnErrorResponseForStatuses: [404],
      isExpectedError: (error) => error.statusCode === 404,
    },
  );
}

/**
 * Get all rides for a specific tour.
 */
export async function getTourRides(
  tourId: string,
  params?: Record<string, string>,
): Promise<ApiResponse<PaginatedResponse<Ride>>> {
  logger.debug(TAG, `Fetching rides for tour ${tourId}`);
  const response = await apiClient.get<unknown>(
    `/v1/tours/${encodeURIComponent(tourId)}/rides`,
    { params },
  );

  if (!response.success) {
    return response as ApiResponse<PaginatedResponse<Ride>>;
  }

  return {
    ...response,
    data: normalizeRideListPayload(response.data),
  } as ApiResponse<PaginatedResponse<Ride>>;
}

/**
 * Get ride details by ride ID for a specific tour.
 */
export async function getRideDetails(
  tourId: string,
  rideId: string,
): Promise<ApiResponse<Ride>> {
  logger.debug(TAG, `Fetching ride ${rideId} for tour ${tourId}`);
  return apiClient.get<Ride>(
    `/v1/tours/${encodeURIComponent(tourId)}/rides/${encodeURIComponent(rideId)}`,
  );
}
