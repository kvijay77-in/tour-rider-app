/**
 * Tour API service.
 * Handles tour listing and details via tour-data-api.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse, PaginatedResponse } from '../../types/api';
import type { Tour, TourRider } from '../../types/tour';

const TAG = 'TourApi';

/**
 * List available tours.
 */
export async function getTours(
  params?: Record<string, string>,
): Promise<ApiResponse<PaginatedResponse<Tour>>> {
  logger.debug(TAG, 'Fetching tours list');
  return apiClient.get<PaginatedResponse<Tour>>('/v1/tours', { params });
}

/**
 * Get tour details by tour ID.
 */
export async function getTourDetails(
  tourId: string,
): Promise<ApiResponse<Tour>> {
  logger.debug(TAG, `Fetching tour details for ${tourId}`);
  return apiClient.get<Tour>(`/v1/tours/${encodeURIComponent(tourId)}`);
}

/**
 * Get rider's enrollment details for a specific tour.
 */
export async function getTourRider(
  tourId: string,
  riderId: string,
): Promise<ApiResponse<TourRider>> {
  logger.debug(TAG, `Fetching tour rider ${riderId} for tour ${tourId}`);
  return apiClient.get<TourRider>(
    `/v1/tours/${encodeURIComponent(tourId)}/riders/${encodeURIComponent(riderId)}`,
  );
}
