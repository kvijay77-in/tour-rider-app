/**
 * Tour registration API service.
 * Handles rider-initiated tour registration requests via tour-data-api.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse } from '../../types/api';
import type { TourRider, TourRegistrationRequest } from '../../types/tour';

const TAG = 'TourRegistrationApi';

/**
 * Submit a tour registration request.
 */
export async function submitTourRegistration(
  tourId: string,
  data: TourRegistrationRequest,
): Promise<ApiResponse<TourRider>> {
  logger.info(TAG, `Submitting tour registration for tour ${tourId}`);
  return apiClient.post<TourRider>(
    `/v1/tours/${encodeURIComponent(tourId)}/riders`,
    data,
  );
}
