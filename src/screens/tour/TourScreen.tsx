/**
 * Active tour rides list screen.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { getTourRides } from '../../services/api/rideApi';
import { getActiveTour } from '../../services/api/tourApi';
import { formatDate } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import type { Ride } from '../../types/ride';
import type { Tour } from '../../types/tour';
import type { TourStackParamList } from '../../types/navigation';

const TAG = 'TourScreen';

type Props = NativeStackScreenProps<TourStackParamList, 'TourRides'>;

export function TourScreen({ navigation }: Props) {
  const [tour, setTour] = useState<Tour | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTourAndRides = useCallback(async () => {
    setError(null);

    try {
      const activeTourResponse = await getActiveTour();
      if (!activeTourResponse.success || !activeTourResponse.data) {
        setTour(null);
        setRides([]);
        return;
      }

      const activeTour = activeTourResponse.data;
      setTour(activeTour);

      const ridesResponse = await getTourRides(activeTour.tourId);
      if (ridesResponse.success && ridesResponse.data?.items) {
        setRides(ridesResponse.data.items);
      } else {
        setRides([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load active tour';
      logger.error(TAG, 'Failed to load tour rides', err);
      setError(message);
      setRides([]);
      setTour(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadTourAndRides();
      setIsLoading(false);
    })();
  }, [loadTourAndRides]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadTourAndRides();
    setIsRefreshing(false);
  }, [loadTourAndRides]);

  const sortedRides = useMemo(() => {
    return [...rides].sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) {
        return byDate;
      }
      return (a.rideNo ?? 0) - (b.rideNo ?? 0);
    });
  }, [rides]);

  if (isLoading) {
    return <LoadingSpinner message="Loading active tour..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {!tour ? (
          <Card>
            <Text style={styles.emptyTitle}>No active tour right now</Text>
            <Text style={styles.emptySubtitle}>
              You will see your ride plan here once an active tour is available.
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.headerCard}>
              <Text style={styles.tourName}>{tour.name}</Text>
              <Text style={styles.tourMeta}>Tour ID: {tour.tourId}</Text>
              <Text style={styles.tourMeta}>
                {formatDate(tour.startDate)} - {formatDate(tour.endDate)}
              </Text>
            </Card>

            {sortedRides.map((ride) => (
              <TouchableOpacity
                key={ride.rideId}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('RideDetails', { rideId: ride.rideId })}
                accessibilityRole="button"
                accessibilityLabel={`Open details for ${ride.name}`}
              >
                <Card style={styles.rideCard}>
                  <View style={styles.rideTopRow}>
                    <Text style={styles.rideName}>{ride.name}</Text>
                    <Text style={styles.rideDate}>{formatDate(ride.date)}</Text>
                  </View>
                  <Text style={styles.routeText}>
                    {`${ride.startLocation} -> ${ride.finishLocation}`}
                  </Text>
                  <Text style={styles.metaText}>
                    {ride.totalDistance} km • {ride.stages.length} stages
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}

            {!sortedRides.length ? (
              <Card>
                <Text style={styles.emptySubtitle}>No rides published for this tour yet.</Text>
              </Card>
            ) : null}
          </>
        )}

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 16,
    gap: 12,
  },
  headerCard: {
    marginBottom: 4,
  },
  tourName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  tourMeta: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  rideCard: {
    marginBottom: 2,
  },
  rideTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  rideName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rideDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  routeText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
  errorContainer: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: COLORS.white,
    textAlign: 'center',
    fontSize: 14,
  },
});

export default TourScreen;
