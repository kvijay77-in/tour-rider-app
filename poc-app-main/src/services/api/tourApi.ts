/**
 * Tour API service — endpoints for tour management.
 * See docs/DataIntegrationDesign.md §2.2 and §2.4.
 */

import { apiClient, ApiError } from './apiClient';
import { Tour } from '../../types/models';
import { USE_MOCK_DATA, MOCK_TOUR } from './mockData';

const TOURS_PATH = '/v1/tours';

/**
 * Get the currently active tour.
 * Uses mock data when EXPO_PUBLIC_USE_MOCK_DATA is true.
 */
export async function getActiveTour(): Promise<Tour | null> {
  if (USE_MOCK_DATA) {
    return MOCK_TOUR;
  }
  try {
    const response = await apiClient.get<Tour>(`${TOURS_PATH}/active`);
    return response.data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      // NO_ACTIVE_TOUR — normal when no tour is currently active
      return null;
    }
    throw error;
  }
}

/**
 * Get a tour by ID.
 */
export async function getTourById(tourId: string): Promise<Tour | null> {
  try {
    const response = await apiClient.get<Tour>(`${TOURS_PATH}/${tourId}`);
    return response.data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * List all tours, optionally filtered by status.
 */
export async function listTours(
  status?: string,
): Promise<Tour[]> {
  const params: Record<string, string> = {};
  if (status) params.status = status;

  const response = await apiClient.get<Tour[]>(`${TOURS_PATH}`, { params });
  return response.data ?? [];
}
