/**
 * Rider profile API service.
 * Handles rider profile CRUD operations via tour-data-api.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse } from '../../types/api';
import type {
  RiderProfile,
  CreateRiderProfileRequest,
  UpdateRiderProfileRequest,
  ProfilePictureUploadUrlResponse,
  LinkProfileResponse,
} from '../../types/rider';

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
 * Link a Cognito user (sub) to a rider profile.
 */
export async function linkCognitoUser(
  sub: string,
): Promise<ApiResponse<LinkProfileResponse>> {
  logger.info(TAG, `Linking Cognito user ${sub} to rider profile`);
  return apiClient.post<LinkProfileResponse>(`/v1/riders/link/${encodeURIComponent(sub)}`, {});
}

/**
 * Resolve profileId linked to a Cognito user (sub).
 */
export async function getLinkedProfileId(
  sub: string,
): Promise<ApiResponse<LinkProfileResponse>> {
  logger.debug(TAG, `Fetching linked rider profile for Cognito user ${sub}`);
  return apiClient.get<LinkProfileResponse>(`/v1/riders/link/${encodeURIComponent(sub)}`);
}

/**
 * Remove link between Cognito user (sub) and rider profile.
 */
export async function unlinkCognitoUser(
  sub: string,
): Promise<ApiResponse<LinkProfileResponse>> {
  logger.info(TAG, `Unlinking Cognito user ${sub} from rider profile`);
  return apiClient.delete<LinkProfileResponse>(`/v1/riders/link/${encodeURIComponent(sub)}`);
}

/**
 * Request a pre-signed upload URL for rider profile picture.
 */
export async function requestProfilePictureUploadUrl(
  profileId: string,
  contentType?: string,
): Promise<ApiResponse<ProfilePictureUploadUrlResponse>> {
  logger.info(TAG, `Requesting profile picture upload URL for ${profileId}`);
  const payload = contentType ? { contentType } : {};
  return apiClient.post<ProfilePictureUploadUrlResponse>(
    `/v1/riders/profile/${encodeURIComponent(profileId)}/picture`,
    payload,
  );
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
