/**
 * Notification API service.
 * Handles notification retrieval via tour-data-api.
 *
 * Note: This requires a backend extension (Notification-{tourId} table).
 * See docs/Requirements.md § Backend Extensions Required.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse, PaginatedResponse } from '../../types/api';
import type { Notification } from '../../types/notification';

const TAG = 'NotificationApi';

/**
 * Get notifications for a specific tour.
 */
export async function getTourNotifications(
  tourId: string,
  params?: Record<string, string>,
): Promise<ApiResponse<PaginatedResponse<Notification>>> {
  logger.debug(TAG, `Fetching notifications for tour ${tourId}`);
  return apiClient.get<PaginatedResponse<Notification>>(
    `/v1/tours/${encodeURIComponent(tourId)}/notifications`,
    { params },
  );
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(
  tourId: string,
  notificationId: string,
): Promise<ApiResponse<Notification>> {
  logger.debug(TAG, `Marking notification ${notificationId} as read`);
  return apiClient.put<Notification>(
    `/v1/tours/${encodeURIComponent(tourId)}/notifications/${encodeURIComponent(notificationId)}`,
    { isRead: true },
  );
}
