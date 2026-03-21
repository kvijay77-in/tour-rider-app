/**
 * Rider profile API service.
 * Handles rider profile CRUD operations via tour-data-api.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse } from '../../types/api';
import type { RiderProfile, CreateRiderProfileRequest, UpdateRiderProfileRequest } from '../../types/rider';

const TAG = 'RiderApi';

/**
 * Create a new rider profile.
 */
export async function createRiderProfile(
  data: CreateRiderProfileRequest,
): Promise<ApiResponse<RiderProfile>> {
  logger.info(TAG, 'Creating rider profile', { email: data.email });
  return apiClient.post<RiderProfile>('/v1/riders/profile', data);
}

/**
 * Get a rider profile by profile ID.
 */
export async function getRiderProfile(
  profileId: string,
): Promise<ApiResponse<RiderProfile>> {
  logger.debug(TAG, `Fetching rider profile ${profileId}`);
  return apiClient.get<RiderProfile>(`/v1/riders/profile/${encodeURIComponent(profileId)}`);
}

/**
 * Update a rider profile.
 */
export async function updateRiderProfile(
  profileId: string,
  data: UpdateRiderProfileRequest,
): Promise<ApiResponse<RiderProfile>> {
  logger.info(TAG, `Updating rider profile ${profileId}`);
  return apiClient.put<RiderProfile>(`/v1/riders/profile/${encodeURIComponent(profileId)}`, data);
}
