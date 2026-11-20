import { createNavigationContainerRef } from '@react-navigation/native';

import type { MainDrawerParamList } from '../types/navigation';

/**
 * Global navigation ref, typed against the drawer routes that notification
 * deep links target (Notifications, ViewProfile, Tour → RideDetails).
 */
export const navigationRef = createNavigationContainerRef<MainDrawerParamList>();
