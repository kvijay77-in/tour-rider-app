/**
 * Notification type definitions for the Tour Rider App.
 */

/**
 * Notification types
 */
export enum NotificationType {
  TOUR_ANNOUNCEMENT = 'TOUR_ANNOUNCEMENT',
  RIDE_UPDATE = 'RIDE_UPDATE',
  SAFETY_ALERT = 'SAFETY_ALERT',
  PERSONAL_MESSAGE = 'PERSONAL_MESSAGE',
  CHECK_IN_REMINDER = 'CHECK_IN_REMINDER',
  REGISTRATION_STATUS = 'REGISTRATION_STATUS',
}

/**
 * Notification record
 */
export interface Notification {
  /** Unique notification identifier */
  notificationId: string;

  /** Tour ID */
  tourId: string;

  /** Notification type */
  type: NotificationType;

  /** Notification title */
  title: string;

  /** Notification body/message */
  body: string;

  /** Whether the notification has been read */
  isRead: boolean;

  /** Target rider ID (for personal messages, null for broadcast) */
  targetRiderId?: string;

  /** Sender name (e.g., tour organizer) */
  senderName?: string;

  /** Created timestamp */
  createdAt: string;

  /** Read timestamp */
  readAt?: string;
}
