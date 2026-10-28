/**
 * Check-in status screen — today's check-in progress and list.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Card } from '../../components/common/Card';
import { StageIndicator } from '../../components/checkin/StageIndicator';
import { CheckInCard } from '../../components/checkin/CheckInCard';
import { SelfCheckInPanel } from '../../components/checkin/SelfCheckInPanel';
import { useTour } from '../../hooks/useTour';
import { getRideCheckIns, getRiderRideCheckIns } from '../../services/api/checkInApi';
import { getRideDetails } from '../../services/api/rideApi';
import { logger } from '../../utils/logger';
import type { CheckIn } from '../../types/checkin';
import { CheckInStatus } from '../../types/checkin';
import type { Ride } from '../../types/ride';
import type { TourStackParamList } from '../../types/navigation';

const TAG = 'CheckInStatusScreen';

type Props = {
  route?: { params?: TourStackParamList['CheckInStatus'] };
};

export function CheckInStatusScreen({ route }: Props) {
  const {
    activeTour,
    enrollment,
    activeTodaysRide,
    isLoading: isLoadingActiveTour,
    loadActiveTour,
  } = useTour();

  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const routeParams = route?.params;

  const fetchData = useCallback(async () => {
    if (routeParams) {
      setError(null);
      try {
        const [rideResponse, checkInsResponse] = await Promise.all([
          getRideDetails(routeParams.tourId, routeParams.rideId),
          getRiderRideCheckIns(routeParams.tourId, routeParams.riderId, routeParams.rideNo),
        ]);

        if (rideResponse.success && rideResponse.data) {
          setRide(rideResponse.data);
        } else {
          setRide(null);
        }

        if (checkInsResponse.success && checkInsResponse.data) {
          setCheckIns(checkInsResponse.data.checkIns);
        } else {
          setCheckIns([]);
        }
      } catch (err) {
        logger.error(TAG, 'Error fetching parameterized check-in data', err);
        setError('Unable to load check-in data. Please try again.');
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
      return;
    }

    if (!activeTour || !enrollment) {
      setCheckIns([]);
      setRide(null);
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      if (!activeTodaysRide) {
        setCheckIns([]);
        setRide(null);
        return;
      }

      setRide(activeTodaysRide);

      const checkInsResponse = await getRideCheckIns(
        activeTour.tourId,
        activeTodaysRide.rideId,
        { riderId: enrollment.riderId },
      );

      if (checkInsResponse.success && checkInsResponse.data) {
        setCheckIns(checkInsResponse.data.items);
      } else {
        setCheckIns([]);
      }
    } catch (err) {
      logger.error(TAG, 'Error fetching check-in data', err);
      setError('Unable to load check-in data. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [activeTodaysRide, activeTour, enrollment, routeParams]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setIsLoading(true);
    if (!routeParams) {
      await loadActiveTour();
    }
    await fetchData();
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
    if (!ride) return `Stage ${checkIn.stageNumber}`;
    const stage = ride.stages.find((s) => s.stageId === checkIn.stageId);
    return stage?.name ?? `Stage ${checkIn.stageNumber}`;
  };

  if ((isLoading || isLoadingActiveTour) && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="Loading check-in status..." />
      </SafeAreaView>
    );
  }

  if (!routeParams && (!activeTour || !enrollment)) {
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

      {ride ? (
        <FlatList
          data={checkIns}
          keyExtractor={(item) => item.checkInId}
          ListHeaderComponent={
            <View>
              <SelfCheckInPanel
                expectedTourId={routeParams?.tourId}
                expectedRideId={routeParams?.rideId}
                onRefresh={fetchData}
              />
              <Card style={styles.progressCard}>
                <Text style={styles.rideName}>{ride.name}</Text>
                <StageIndicator
                  stages={ride.stages}
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
