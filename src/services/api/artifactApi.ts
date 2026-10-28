/** Artifact manifest calls for tour and ride documents. */

import { apiClient, ApiError } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse } from '../../types/api';
import type { ArtifactManifestItem } from '../../types/artifact';

const TAG = 'ArtifactApi';

function normalizeManifest(payload: unknown): ArtifactManifestItem[] {
  if (Array.isArray(payload)) return payload as ArtifactManifestItem[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)) {
    return (payload as { items: ArtifactManifestItem[] }).items;
  }
  return [];
}

async function fetchManifest(path: string, params?: Record<string, string>): Promise<ApiResponse<ArtifactManifestItem[]>> {
  try {
    const response = await apiClient.get<unknown>(path, {
      params,
      isExpectedError: (error) => error.statusCode === 404,
    });
    if (!response.success) {
      return response as ApiResponse<ArtifactManifestItem[]>;
    }
    return { ...response, data: normalizeManifest(response.data) };
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      logger.info(TAG, `No artifact manifest available for ${path}`);
      return { success: true, data: [], timestamp: new Date().toISOString() };
    }
    throw error;
  }
}

export function getTourArtifacts(
  tourId: string,
  artifactId?: string,
): Promise<ApiResponse<ArtifactManifestItem[]>> {
  logger.debug(TAG, `Fetching tour artifacts for ${tourId}`);
  return fetchManifest(
    `/v1/tours/${encodeURIComponent(tourId)}/artifacts`,
    artifactId ? { artifactId } : undefined,
  );
}

export function getRideArtifacts(
  tourId: string,
  rideId: string,
  artifactId?: string,
): Promise<ApiResponse<ArtifactManifestItem[]>> {
  logger.debug(TAG, `Fetching ride artifacts for ${rideId} in tour ${tourId}`);
  return fetchManifest(
    `/v1/tours/${encodeURIComponent(tourId)}/rides/${encodeURIComponent(rideId)}/artifacts`,
    artifactId ? { artifactId } : undefined,
  );
}