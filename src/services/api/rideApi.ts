/**
 * Ride API service.
 * Handles ride information retrieval via tour-data-api.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse, PaginatedResponse } from '../../types/api';
import type { Ride } from '../../types/ride';

const TAG = 'RideApi';

/**
 * Get today's ride for a specific tour.
 */
export async function getTodaysRide(
  tourId: string,
): Promise<ApiResponse<Ride>> {
  logger.debug(TAG, `Fetching today's ride for tour ${tourId}`);
  return apiClient.get<Ride>(`/v1/tours/${encodeURIComponent(tourId)}/rides/today`);
}

/**
 * Get all rides for a specific tour.
 */
export async function getTourRides(
  tourId: string,
  params?: Record<string, string>,
): Promise<ApiResponse<PaginatedResponse<Ride>>> {
  logger.debug(TAG, `Fetching rides for tour ${tourId}`);
  return apiClient.get<PaginatedResponse<Ride>>(
    `/v1/tours/${encodeURIComponent(tourId)}/rides`,
    { params },
  );
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
