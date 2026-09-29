/**
 * Notifications inbox screen.
 */

import React, { useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS } from '../../constants';
import { useNotifications } from '../../hooks/useNotifications';
import { getRelativeTime } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import { navigationRef } from '../../navigation/navigationRef';
import type { Notification } from '../../types/notification';

const TAG = 'NotificationsScreen';

function navigateFromNotification(item: Notification): void {
  const target = item.target;

  if (!target?.screen) {
    return;
  }

  const params = target.params && typeof target.params === 'object' && !Array.isArray(target.params)
    ? target.params
    : undefined;

  if (!navigationRef.isReady()) {
    return;
  }

  if (target.screen === 'PROFILE') {
    navigationRef.navigate('ViewProfile' as never);
    return;
  }

  if (target.screen === 'TOUR') {
    navigationRef.navigate('Tour' as never);
    return;
  }

  if (target.screen === 'RIDE_DETAILS') {
    const rideId = typeof params?.rideId === 'string' ? params.rideId : undefined;
    const tourId = typeof params?.tourId === 'string' ? params.tourId : item.tourId;

    if (rideId && tourId) {
      navigationRef.navigate('Tour' as never, {
        screen: 'RideDetails',
        params: { rideId, tourId },
      } as never);
      return;
    }
  }

  if (target.screen !== 'NOTIFICATIONS') {
    logger.info(TAG, `Unknown notification target ${target.screen}, staying in Notifications.`);
  }
}

export function NotificationsScreen() {
  const {
    items,
    isApiAvailable,
    isRefreshing,
    refresh,
    markAllRead,
  } = useNotifications();

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void markAllRead();
    }, [markAllRead, refresh]),
  );

  const renderItem = useCallback(({ item }: { item: Notification }) => (
    <TouchableOpacity
      onPress={() => navigateFromNotification(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={[styles.notificationCard, !item.isRead && styles.unreadCard]}>
        <View style={styles.notificationHeader}>
          <Text style={[styles.notificationTitle, !item.isRead && styles.unreadTitle]} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.isRead ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.notificationBody} numberOfLines={3}>
          {item.body}
        </Text>
        <Text style={styles.notificationMeta}>
          {item.priority === 'URGENT' ? 'Urgent • ' : ''}
          {getRelativeTime(item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  ), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {!isApiAvailable ? (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>Notifications are not available yet in this environment.</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.notificationId}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No notifications yet.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  infoContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  notificationCard: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  unreadCard: {
    backgroundColor: COLORS.gray[50],
    borderColor: COLORS.primary,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  notificationBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationMeta: {
    fontSize: 12,
    color: COLORS.textDisabled,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 48,
  },
});

export default NotificationsScreen;
