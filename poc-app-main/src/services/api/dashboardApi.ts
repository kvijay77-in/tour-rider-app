/**
 * Dashboard API service — composite endpoint for dashboard data.
 * See docs/DataIntegrationDesign.md §3.2 for response structure.
 */

import { apiClient } from './apiClient';
import { DashboardData } from '../../types/models';
import { USE_MOCK_DATA, getMockDashboardDataResponse } from './mockData';

/**
 * Get complete dashboard data for a ride.
 * Returns ride details, all riders, all check-ins, and summary statistics
 * in a single API call.
 *
 * @param etag  Previous ETag for conditional request (304 optimisation)
 * @returns Dashboard data, or null if 304 Not Modified
 */
export async function getDashboardData(
  tourId: string,
  rideId: string,
  etag?: string,
): Promise<{ data: DashboardData | null; etag?: string }> {
  if (USE_MOCK_DATA) {
    return { data: getMockDashboardDataResponse(), etag: undefined };
  }

  const headers: Record<string, string> = {};
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  const response = await apiClient.get<DashboardData>(
    `/v1/tours/${tourId}/rides/${rideId}/dashboard`,
    { headers },
  );

  return {
    data: response.data ?? null,
    // ETag will be extracted from response headers in Phase 3
    // when full fetch response access is available
    etag: undefined,
  };
}
