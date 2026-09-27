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
  ProfilePictureDownloadUrlResponse,
  ProfileAttributeFileUrlResponse,
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
  return apiClient.post<RiderProfile>('/v1/riders/profile', data, {
    isExpectedError: (error) => error.statusCode >= 400 && error.statusCode < 500,
  });
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
  return apiClient.get<LinkProfileResponse>(`/v1/riders/link/${encodeURIComponent(sub)}`, {
    isExpectedError: (error) => error.statusCode === 404,
  });
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
 * Request a pre-signed download URL for a rider profile picture.
 */
export async function getProfilePictureDownloadUrl(
  profileId: string,
): Promise<ApiResponse<ProfilePictureDownloadUrlResponse>> {
  logger.debug(TAG, `Requesting profile picture download URL for ${profileId}`);
  return apiClient.get<ProfilePictureDownloadUrlResponse>(
    `/v1/riders/profile/${encodeURIComponent(profileId)}/picture`,
    {
      isExpectedError: (error) => error.statusCode === 403 || error.statusCode === 404,
      returnErrorResponseForStatuses: [403],
    },
  );
}

/**
 * Get a rider profile by profile ID.
 */
export async function getRiderProfile(
  profileId: string,
): Promise<ApiResponse<RiderProfile>> {
  logger.debug(TAG, `Fetching rider profile ${profileId}`);
  return apiClient.get<RiderProfile>(`/v1/riders/profile/${encodeURIComponent(profileId)}`, {
    isExpectedError: (error) => error.statusCode === 404,
  });
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

export async function requestProfileAttributeUploadUrl(
  profileId: string,
  attributeKey: string,
  contentType?: string,
): Promise<ApiResponse<ProfileAttributeFileUrlResponse>> {
  logger.info(TAG, `Requesting upload URL for profile attribute ${attributeKey}`);
  const payload = contentType ? { contentType } : {};
  return apiClient.post<ProfileAttributeFileUrlResponse>(
    `/v1/riders/profile/${encodeURIComponent(profileId)}/attributes/${encodeURIComponent(attributeKey)}/upload`,
    payload,
  );
}

export async function getProfileAttributeDownloadUrl(
  profileId: string,
  attributeKey: string,
): Promise<ApiResponse<ProfileAttributeFileUrlResponse>> {
  logger.debug(TAG, `Requesting download URL for profile attribute ${attributeKey}`);
  return apiClient.get<ProfileAttributeFileUrlResponse>(
    `/v1/riders/profile/${encodeURIComponent(profileId)}/attributes/${encodeURIComponent(attributeKey)}/download`,
    {
      isExpectedError: (error) => error.statusCode === 403 || error.statusCode === 404,
      returnErrorResponseForStatuses: [403],
    },
  );
}
