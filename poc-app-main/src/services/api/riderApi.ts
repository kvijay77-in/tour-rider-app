/**
 * Rider API service — endpoints for rider data.
 * See docs/DataIntegrationDesign.md §2.2.
 */

import { apiClient, ApiError } from './apiClient';
import { GetRidersQuery } from '../../types/api';
import { Rider } from '../../types/models';

function ridersPath(tourId: string): string {
  return `/v1/tours/${tourId}/riders`;
}

/**
 * List riders for a tour (combined TourRider + RiderProfile data).
 */
export async function listRiders(
  tourId: string,
  query?: GetRidersQuery,
): Promise<Rider[]> {
  const params: Record<string, string> = {};
  if (query?.limit) params.limit = String(query.limit);
  if (query?.nextToken) params.nextToken = query.nextToken;

  const response = await apiClient.get<Rider[]>(ridersPath(tourId), { params });
  return response.data ?? [];
}

/**
 * Get a single rider by ID.
 */
export async function getRiderById(
  tourId: string,
  riderId: string,
): Promise<Rider | null> {
  try {
    const response = await apiClient.get<Rider>(
      `${ridersPath(tourId)}/${riderId}`,
    );
    return response.data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}
