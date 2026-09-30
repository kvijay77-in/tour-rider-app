import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  deletePushDevice,
  isNotificationsApiUnavailable,
  registerPushDevice,
} from '../api/notificationApi';
import { logger } from '../../utils/logger';
import type { PushDevicePlatform } from '../../types/notification';

const TAG = 'PushService';

let cachedExpoPushToken: string | null = null;
let handlerConfigured = false;

function getProjectId(): string | undefined {
  const expoProjectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const projectId = expoProjectId ?? Constants.easConfig?.projectId;
  // Ignore the unreplaced app.json placeholder (<EAS_PROJECT_ID>).
  return projectId && !projectId.startsWith('<') ? projectId : undefined;
}

function getDevicePlatform(): PushDevicePlatform | null {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return Platform.OS;
  }

  return null;
}

export function configureForegroundNotificationHandler(): void {
  if (handlerConfigured || Platform.OS === 'web') {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  handlerConfigured = true;
}

async function ensureAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('urgent', {
    name: 'Urgent',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync('general', {
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function registerPushTokenForCurrentUser(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  if (!Device.isDevice) {
    logger.info(TAG, 'Skipping push registration on simulator/emulator');
    return null;
  }

  const platform = getDevicePlatform();
  if (!platform) {
    logger.info(TAG, `Skipping push registration for unsupported platform ${Platform.OS}`);
    return null;
  }

  configureForegroundNotificationHandler();
  await ensureAndroidNotificationChannels();

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== 'granted') {
    logger.info(TAG, 'Push notifications permission not granted');
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    logger.warn(TAG, 'Missing app.json extra.eas.projectId. Push registration skipped.');
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;

  if (!token) {
    logger.warn(TAG, 'Expo push token was empty');
    return null;
  }

  try {
    const response = await registerPushDevice(token, platform);
    if (response.success) {
      cachedExpoPushToken = token;
      return token;
    }

    cachedExpoPushToken = null;
    if (!isNotificationsApiUnavailable(response)) {
      logger.warn(TAG, response.error?.message ?? 'Push registration failed');
    } else {
      logger.info(TAG, 'Notifications API unavailable. Push token not registered with backend yet.');
    }
  } catch (error) {
    cachedExpoPushToken = null;
    logger.warn(TAG, 'Push registration request failed', error);
  }

  return null;
}

export async function unregisterPushTokenForCurrentUser(): Promise<void> {
  if (!cachedExpoPushToken) {
    return;
  }

  try {
    const response = await deletePushDevice(cachedExpoPushToken);
    if (!response.success && !isNotificationsApiUnavailable(response)) {
      logger.warn(TAG, response.error?.message ?? 'Push token delete failed');
    }
  } catch (error) {
    logger.warn(TAG, 'Push token delete request failed', error);
  } finally {
    cachedExpoPushToken = null;
  }
}
