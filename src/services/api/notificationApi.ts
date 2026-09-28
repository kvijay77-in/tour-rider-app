/**
 * Notification API service.
 * Handles notification and push-device operations via tour-data-api.
 */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse } from '../../types/api';
import type {
  MarkNotificationsReadRequest,
  NotificationListResponse,
  NotificationUnreadCountResponse,
  PushDevicePlatform,
} from '../../types/notification';

const TAG = 'NotificationApi';
const NOTIFICATIONS_NOT_DEPLOYED_STATUSES = [404, 501] as const;

export function isNotificationsApiUnavailable(response: ApiResponse<unknown>): boolean {
  const errorCode = response.error?.code;
  return errorCode === 'HTTP_404' || errorCode === 'HTTP_501';
}

export async function registerPushDevice(
  token: string,
  platform: PushDevicePlatform,
): Promise<ApiResponse<Record<string, never>>> {
  logger.debug(TAG, 'Registering push device token');
  return apiClient.post<Record<string, never>>('/v1/notifications/devices', { token, platform });
}

export async function deletePushDevice(
  token: string,
): Promise<ApiResponse<Record<string, never>>> {
  logger.debug(TAG, 'Deleting push device token');
  return apiClient.delete<Record<string, never>>(
    `/v1/notifications/devices/${encodeURIComponent(token)}`,
  );
}

export async function getNotifications(params?: {
  since?: string;
  limit?: number;
}): Promise<ApiResponse<NotificationListResponse>> {
  logger.debug(TAG, 'Fetching notifications');

  const query: Record<string, string> = {};
  if (params?.since) {
    query.since = params.since;
  }
  if (typeof params?.limit === 'number') {
    query.limit = String(params.limit);
  }

  return apiClient.get<NotificationListResponse>('/v1/notifications', {
    params: Object.keys(query).length ? query : undefined,
    returnErrorResponseForStatuses: NOTIFICATIONS_NOT_DEPLOYED_STATUSES,
  });
}

export async function getUnreadNotificationCount(): Promise<ApiResponse<NotificationUnreadCountResponse>> {
  logger.debug(TAG, 'Fetching unread notification count');
  return apiClient.get<NotificationUnreadCountResponse>('/v1/notifications/unread-count', {
    returnErrorResponseForStatuses: NOTIFICATIONS_NOT_DEPLOYED_STATUSES,
  });
}

export async function markAllNotificationsRead(
  payload: MarkNotificationsReadRequest = {},
): Promise<ApiResponse<Record<string, never>>> {
  logger.debug(TAG, 'Marking all notifications as read');
  return apiClient.put<Record<string, never>>('/v1/notifications/read', payload);
}
