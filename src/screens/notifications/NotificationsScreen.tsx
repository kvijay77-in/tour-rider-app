/**
 * Notifications screen — list of tour notifications with read/unread state.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  StyleSheet,
} from 'react-native';

import { COLORS } from '../../constants';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useTour } from '../../hooks/useTour';
import { getTourNotifications, markNotificationRead } from '../../services/api/notificationApi';
import { getRelativeTime } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import type { Notification } from '../../types/notification';

const TAG = 'NotificationsScreen';

export function NotificationsScreen() {
  const { activeTour } = useTour();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!activeTour) {
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const response = await getTourNotifications(activeTour.tourId);
      if (response.success && response.data) {
        setNotifications(response.data.items);
      } else {
        setError(response.error?.message ?? 'Failed to load notifications.');
      }
    } catch (err) {
      logger.error(TAG, 'Error fetching notifications', err);
      setError('Unable to load notifications. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [activeTour]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handlePress = async (notification: Notification) => {
    if (notification.isRead || !activeTour) return;

    try {
      const response = await markNotificationRead(activeTour.tourId, notification.notificationId);
      if (response.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.notificationId === notification.notificationId
              ? { ...n, isRead: true }
              : n,
          ),
        );
      }
    } catch (err) {
      logger.error(TAG, 'Error marking notification as read', err);
    }
  };

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="Loading notifications..." />
      </SafeAreaView>
    );
  }

  if (!activeTour) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.infoText}>No active tour enrollment.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.notificationId}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handlePress(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View
              style={[
                styles.notificationCard,
                !item.isRead && styles.unreadCard,
              ]}
            >
              <View style={styles.notificationHeader}>
                <Text
                  style={[styles.notificationTitle, !item.isRead && styles.unreadTitle]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {!item.isRead ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text style={styles.notificationBody} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.notificationTime}>
                {getRelativeTime(item.createdAt)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No notifications yet.</Text>
        }
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorContainer: {
    backgroundColor: COLORS.danger,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    color: COLORS.white,
    fontSize: 14,
    textAlign: 'center',
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
    borderWidth: 1,
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
  notificationTime: {
    fontSize: 12,
    color: COLORS.textDisabled,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 48,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default NotificationsScreen;
