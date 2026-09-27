/**
 * Check-in history screen — past rides with check-in summaries.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Card } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useTour } from '../../hooks/useTour';
import { formatDate } from '../../utils/dateFormatter';
import type { Ride } from '../../types/ride';
import { RideStatus } from '../../types/ride';

const STATUS_COLOR_MAP: Record<RideStatus, string> = {
  [RideStatus.PLANNED]: COLORS.gray[400],
  [RideStatus.ACTIVE]: COLORS.success,
  [RideStatus.COMPLETED]: COLORS.secondary,
  [RideStatus.CLOSED]: COLORS.gray[500],
};

export function CheckInHistoryScreen({ navigation }: {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void };
}) {
  const { activeTour, activeRides, isLoading: isLoadingActiveTour, loadActiveTour } = useTour();

  const [rides, setRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const syncRides = useCallback(() => {
    if (!activeTour) {
      setRides([]);
      return;
    }

    setRides(activeRides);
  }, [activeRides, activeTour]);

  useEffect(() => {
    syncRides();
  }, [syncRides]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActiveTour();
    setRefreshing(false);
  };

  if (isLoadingActiveTour && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="Loading ride history..." />
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
        <Text style={styles.title}>Ride History</Text>
      </View>

      <FlatList
        data={rides}
        keyExtractor={(item) => item.rideId}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('CheckInStatus', { rideId: item.rideId })}
            accessibilityRole="button"
          >
            <Card style={styles.rideCard}>
              <View style={styles.rideHeader}>
                <Text style={styles.rideName} numberOfLines={1}>
                  {item.name}
                </Text>
                <StatusBadge
                  status={item.status}
                  color={STATUS_COLOR_MAP[item.status]}
                />
              </View>
              <Text style={styles.rideDate}>{formatDate(item.date)}</Text>
              <Text style={styles.rideDetail}>
                {item.startLocation} → {item.finishLocation} • {item.totalDistance} km
              </Text>
            </Card>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No rides found for this tour.</Text>
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
  rideCard: {
    marginBottom: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rideName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  rideDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  rideDetail: {
    fontSize: 13,
    color: COLORS.textSecondary,
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

export default CheckInHistoryScreen;
