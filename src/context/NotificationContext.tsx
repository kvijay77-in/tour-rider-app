import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useAuth } from './AuthContext';
import { useRider } from './RiderContext';
import {
  getNotifications,
  getUnreadNotificationCount,
  isNotificationsApiUnavailable,
  markAllNotificationsRead,
} from '../services/api/notificationApi';
import {
  configureForegroundNotificationHandler,
  registerPushTokenForCurrentUser,
} from '../services/push/pushService';
import { logger } from '../utils/logger';
import { navigationRef } from '../navigation/navigationRef';
import type { Notification } from '../types/notification';

const TAG = 'NotificationContext';
const WEB_POLL_INTERVAL_MS = 5 * 60 * 1000;
const NOTIFICATION_PAGE_SIZE = 50;

type NotificationTargetPayload = {
  screen?: unknown;
  params?: unknown;
};

interface NotificationContextValue {
  items: Notification[];
  unreadCount: number;
  isApiAvailable: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  latestItems: Notification[];
}

const NotificationContext = createContext<NotificationContextValue>({
  items: [],
  unreadCount: 0,
  isApiAvailable: true,
  isRefreshing: false,
  refresh: async () => {},
  markAllRead: async () => {},
  latestItems: [],
});

function sortByLatest(items: Notification[]): Notification[] {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function mapTargetPayload(payload: unknown): NotificationTargetPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  return payload as NotificationTargetPayload;
}

function getTargetScreen(target: NotificationTargetPayload): string {
  if (typeof target.screen === 'string') {
    return target.screen;
  }

  return 'NOTIFICATIONS';
}

function getTargetParams(target: NotificationTargetPayload): Record<string, unknown> | undefined {
  if (!target.params || typeof target.params !== 'object' || Array.isArray(target.params)) {
    return undefined;
  }

  return target.params as Record<string, unknown>;
}

function navigateForNotificationTarget(target: NotificationTargetPayload, fallbackTourId?: string): void {
  if (!navigationRef.isReady()) {
    return;
  }

  const screen = getTargetScreen(target);
  const params = getTargetParams(target);

  if (screen === 'PROFILE') {
    navigationRef.navigate('ViewProfile' as never);
    return;
  }

  if (screen === 'TOUR') {
    navigationRef.navigate('Tour' as never);
    return;
  }

  if (screen === 'RIDE_DETAILS') {
    const rideId = typeof params?.rideId === 'string' ? params.rideId : undefined;
    const tourId = typeof params?.tourId === 'string' ? params.tourId : fallbackTourId;

    if (rideId && tourId) {
      navigationRef.navigate('Tour' as never, {
        screen: 'RideDetails',
        params: { rideId, tourId },
      } as never);
      return;
    }
  }

  if (screen !== 'NOTIFICATIONS') {
    logger.info(TAG, `Unknown notification target ${screen}, opening Notifications.`);
  }

  navigationRef.navigate('Notifications' as never);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { hasProfile } = useRider();

  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isApiAvailable, setIsApiAvailable] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loggedUnavailableRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || !hasProfile) {
      setItems([]);
      setUnreadCount(0);
      setIsApiAvailable(true);
      return;
    }

    setIsRefreshing(true);

    try {
      const response = await getNotifications({ limit: NOTIFICATION_PAGE_SIZE });

      if (!response.success) {
        if (isNotificationsApiUnavailable(response)) {
          setIsApiAvailable(false);
          setItems([]);
          setUnreadCount(0);

          if (!loggedUnavailableRef.current) {
            logger.info(TAG, 'Notifications API unavailable (404/501). Hiding badge.');
            loggedUnavailableRef.current = true;
          }

          return;
        }

        logger.warn(TAG, response.error?.message ?? 'Failed to load notifications.');
        return;
      }

      loggedUnavailableRef.current = false;
      setIsApiAvailable(true);

      const responseItems = Array.isArray(response.data?.items) ? response.data.items : [];
      setItems(sortByLatest(responseItems));
      setUnreadCount(typeof response.data?.unreadCount === 'number' ? response.data.unreadCount : 0);
    } catch (error) {
      logger.warn(TAG, 'Failed to refresh notifications', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [hasProfile, user]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user || !hasProfile) {
      return;
    }

    try {
      const response = await getUnreadNotificationCount();

      if (!response.success) {
        if (isNotificationsApiUnavailable(response)) {
          setIsApiAvailable(false);
          setUnreadCount(0);
          return;
        }

        return;
      }

      setIsApiAvailable(true);
      setUnreadCount(typeof response.data?.unreadCount === 'number' ? response.data.unreadCount : 0);
    } catch (error) {
      logger.warn(TAG, 'Failed to refresh unread count', error);
    }
  }, [hasProfile, user]);

  const markAllRead = useCallback(async () => {
    if (!isApiAvailable) {
      return;
    }

    try {
      await markAllNotificationsRead();
      setItems((previousItems) => previousItems.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      logger.warn(TAG, 'Failed to mark notifications as read', error);
    }
  }, [isApiAvailable]);

  useEffect(() => {
    if (!user || !hasProfile) {
      return;
    }

    configureForegroundNotificationHandler();
    void registerPushTokenForCurrentUser();
    void refresh();
  }, [hasProfile, refresh, user]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void refresh();
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [refresh]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const intervalId = setInterval(() => {
      void refreshUnreadCount();
    }, WEB_POLL_INTERVAL_MS);

    const onFocus = () => {
      void refreshUnreadCount();
    };

    const webWindow = (globalThis as { window?: {
      addEventListener?: (event: string, handler: () => void) => void;
      removeEventListener?: (event: string, handler: () => void) => void;
    } }).window;

    webWindow?.addEventListener?.('focus', onFocus);

    return () => {
      clearInterval(intervalId);
      webWindow?.removeEventListener?.('focus', onFocus);
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const channelId = notification.request.content?.data?.channelId;
      if (channelId === 'urgent' || channelId === 'general') {
        logger.debug(TAG, `Foreground push received on ${channelId}`);
      }
      void refresh();
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const target = mapTargetPayload(data?.target);
      const fallbackTourId = typeof data?.tourId === 'string' ? data.tourId : undefined;

      navigateForNotificationTarget(target, fallbackTourId);
      void refresh();
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [refresh]);

  const latestItems = useMemo(() => items.slice(0, 3), [items]);

  const value = useMemo<NotificationContextValue>(() => ({
    items,
    unreadCount,
    isApiAvailable,
    isRefreshing,
    refresh,
    markAllRead,
    latestItems,
  }), [isApiAvailable, isRefreshing, items, latestItems, markAllRead, refresh, unreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext);
}
