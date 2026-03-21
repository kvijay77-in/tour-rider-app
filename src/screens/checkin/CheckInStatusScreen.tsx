/**
 * Check-in status screen — today's check-in progress and list.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  RefreshControl,
  StyleSheet,
} from 'react-native';

import { COLORS } from '../../constants';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Card } from '../../components/common/Card';
import { StageIndicator } from '../../components/checkin/StageIndicator';
import { CheckInCard } from '../../components/checkin/CheckInCard';
import { useTour } from '../../hooks/useTour';
import { getTodaysRide } from '../../services/api/rideApi';
import { getRideCheckIns } from '../../services/api/checkInApi';
import { logger } from '../../utils/logger';
import type { Ride } from '../../types/ride';
import type { CheckIn } from '../../types/checkin';
import { CheckInStatus } from '../../types/checkin';

const TAG = 'CheckInStatusScreen';

export function CheckInStatusScreen() {
  const { activeTour, enrollment } = useTour();

  const [todaysRide, setTodaysRide] = useState<Ride | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeTour || !enrollment) {
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      // Fetch today's ride
      const rideResponse = await getTodaysRide(activeTour.tourId);
      if (rideResponse.success && rideResponse.data) {
        setTodaysRide(rideResponse.data);

        // Fetch check-ins for the ride
        const checkInsResponse = await getRideCheckIns(
          activeTour.tourId,
          rideResponse.data.rideId,
          { riderId: enrollment.riderId },
        );
        if (checkInsResponse.success && checkInsResponse.data) {
          setCheckIns(checkInsResponse.data.items);
        }
      } else {
        setTodaysRide(null);
        setCheckIns([]);
      }
    } catch (err) {
      logger.error(TAG, 'Error fetching check-in data', err);
      setError('Unable to load check-in data. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [activeTour, enrollment]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  /** Derive overall check-in status from check-in records. */
  const deriveOverallStatus = (): CheckInStatus => {
    if (checkIns.some((c) => c.isQuitRiding)) return CheckInStatus.QUIT_RIDING;
    if (checkIns.some((c) => c.isNotRiding)) return CheckInStatus.NOT_RIDING;
    if (checkIns.length > 0) return CheckInStatus.CHECKED_IN;
    return CheckInStatus.NOT_CHECKED_IN;
  };

  /** Resolve stage name for a check-in. */
  const getStageName = (checkIn: CheckIn): string => {
    if (!todaysRide) return `Stage ${checkIn.stageNumber}`;
    const stage = todaysRide.stages.find((s) => s.stageId === checkIn.stageId);
    return stage?.name ?? `Stage ${checkIn.stageNumber}`;
  };

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="Loading check-in status..." />
      </SafeAreaView>
    );
  }

  if (!activeTour || !enrollment) {
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
        <Text style={styles.title}>Check-In Status</Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {todaysRide ? (
        <FlatList
          data={checkIns}
          keyExtractor={(item) => item.checkInId}
          ListHeaderComponent={
            <View>
              <Card style={styles.progressCard}>
                <Text style={styles.rideName}>{todaysRide.name}</Text>
                <StageIndicator
                  stages={todaysRide.stages}
                  checkIns={checkIns}
                  checkInStatus={deriveOverallStatus()}
                />
              </Card>
              {checkIns.length > 0 ? (
                <Text style={styles.sectionTitle}>Check-In Records</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <CheckInCard checkIn={item} stageName={getStageName(item)} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No check-ins recorded for today&apos;s ride.</Text>
          }
        />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.infoText}>No ride scheduled for today.</Text>
        </View>
      )}
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
  progressCard: {
    marginBottom: 16,
  },
  rideName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default CheckInStatusScreen;
