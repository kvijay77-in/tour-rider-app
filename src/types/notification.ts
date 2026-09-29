/**
 * Notification type definitions for the Tour Rider App.
 */

export type NotificationPriority = 'URGENT' | 'NORMAL';

export type NotificationTargetScreen =
  | 'NOTIFICATIONS'
  | 'TOUR'
  | 'RIDE_DETAILS'
  | 'PROFILE'
  | string;

export interface NotificationTarget {
  screen: NotificationTargetScreen;
  params?: Record<string, unknown>;
}

export interface Notification {
  notificationId: string;
  ruleId: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  target?: NotificationTarget;
  tourId?: string;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationListResponse {
  items: Notification[];
  unreadCount: number;
}

export interface NotificationUnreadCountResponse {
  unreadCount: number;
}

export interface MarkNotificationsReadRequest {
  readAt?: string;
}

export type PushDevicePlatform = 'ios' | 'android';
