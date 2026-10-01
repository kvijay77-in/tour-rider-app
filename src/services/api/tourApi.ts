/**
 * Tour API service.
 * Handles tour listing and details via tour-data-api.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse, PaginatedResponse } from '../../types/api';
import type { Tour, TourParticipation, TourRider } from '../../types/tour';

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
 * Get the active tour for the current organizer context.
 */
export async function getActiveTour(): Promise<ApiResponse<Tour>> {
  logger.debug(TAG, 'Fetching active tour');
  return apiClient.get<Tour>('/v1/tours/active');
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
 * Get rider's enrollment details for a specific tour by riderId.
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

/**
 * Get rider's enrollment details for a specific tour by profileId.
 * Uses a query parameter to look up enrollment by the rider's profile ID
 * instead of the tour-specific riderId (which the app may not know yet).
 */
export async function getTourRiderByProfile(
  tourId: string,
  profileId: string,
): Promise<ApiResponse<TourRider>> {
  logger.debug(TAG, `Fetching tour enrollment for profile ${profileId} in tour ${tourId}`);
  return apiClient.get<TourRider>(
    `/v1/tours/${encodeURIComponent(tourId)}/riders`,
    {
      params: { profileId },
      isExpectedError: (error) => error.statusCode === 404,
    },
  );
}

/** Get all tour participation records for the signed-in rider profile. */
export async function getProfileTourParticipations(
  profileId: string,
): Promise<ApiResponse<PaginatedResponse<TourParticipation>>> {
  logger.debug(TAG, `Fetching tour participations for profile ${profileId}`);
  const response = await apiClient.get<unknown>(
    `/v1/profile/${encodeURIComponent(profileId)}/tours`,
  );

  if (!response.success) {
    return response as ApiResponse<PaginatedResponse<TourParticipation>>;
  }

  const payload = response.data;
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];

  return {
    ...response,
    data: { items: items as TourParticipation[] },
  };
}
