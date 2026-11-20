import { logger } from '../utils/logger';
import { navigationRef } from './navigationRef';

const TAG = 'notificationNavigation';

interface NavigateOptions {
  /** Tour id used when the target params do not carry one. */
  fallbackTourId?: string;
  /** When true, unknown/incomplete targets open the Notifications screen. */
  fallbackToInbox?: boolean;
}

/**
 * Navigates to the screen a notification target points at.
 * Shared by the push-response handler and the inbox list.
 */
export function navigateForNotificationTarget(
  screen: string,
  params: Record<string, unknown> | undefined,
  { fallbackTourId, fallbackToInbox = false }: NavigateOptions = {},
): void {
  if (!navigationRef.isReady()) {
    return;
  }

  if (screen === 'PROFILE') {
    navigationRef.navigate('ViewProfile');
    return;
  }

  if (screen === 'TOUR') {
    navigationRef.navigate('Tour');
    return;
  }

  if (screen === 'RIDE_DETAILS') {
    const rideId = typeof params?.rideId === 'string' ? params.rideId : undefined;
    const tourId = typeof params?.tourId === 'string' ? params.tourId : fallbackTourId;

    if (rideId && tourId) {
      navigationRef.navigate('Tour', {
        screen: 'RideDetails',
        params: { rideId, tourId },
      });
      return;
    }
  }

  if (screen !== 'NOTIFICATIONS') {
    logger.info(TAG, `Unknown notification target ${screen}.`);
  }

  if (fallbackToInbox) {
    navigationRef.navigate('Notifications');
  }
}
