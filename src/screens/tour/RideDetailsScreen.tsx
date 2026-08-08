/**
 * Ride details screen.
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useTour } from '../../hooks/useTour';
import { getRideDetails } from '../../services/api/rideApi';
import { getActiveTour } from '../../services/api/tourApi';
import { formatDate } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import type { Ride } from '../../types/ride';
import type { TourStackParamList } from '../../types/navigation';

const TAG = 'RideDetailsScreen';

type Props = NativeStackScreenProps<TourStackParamList, 'RideDetails'>;

export function RideDetailsScreen({ route }: Props) {
  const { activeTour } = useTour();
  const { rideId } = route.params;

  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const tourId = activeTour?.tourId ?? (await getActiveTour()).data?.tourId;

        if (!tourId) {
          throw new Error('No active tour available.');
        }

        const response = await getRideDetails(tourId, rideId);
        if (response.success && response.data) {
          setRide(response.data);
        } else {
          setRide(null);
          setError(response.error?.message ?? 'Ride details unavailable.');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load ride details.';
        logger.error(TAG, 'Failed to load ride details', err);
        setError(message);
        setRide(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [activeTour?.tourId, rideId]);

  if (isLoading) {
    return <LoadingSpinner message="Loading ride details..." />;
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Ride details unavailable.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <Text style={styles.title}>{ride.name}</Text>
          <Text style={styles.subtitle}>{formatDate(ride.date)}</Text>

          <View style={styles.detailBlock}>
            <Text style={styles.label}>Route</Text>
            <Text style={styles.value}>{`${ride.startLocation} -> ${ride.finishLocation}`}</Text>
          </View>

          <View style={styles.detailBlock}>
            <Text style={styles.label}>Distance</Text>
            <Text style={styles.value}>{ride.totalDistance} km</Text>
          </View>

          {ride.flagOffTime ? (
            <View style={styles.detailBlock}>
              <Text style={styles.label}>Flag Off Time</Text>
              <Text style={styles.value}>{ride.flagOffTime}</Text>
            </View>
          ) : null}

          <View style={styles.detailBlock}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{ride.status}</Text>
          </View>
        </Card>

        <Card style={styles.stagesCard}>
          <Text style={styles.stageTitle}>Stages</Text>

          {ride.stages.map((stage) => (
            <View key={stage.stageId} style={styles.stageRow}>
              <Text style={styles.stageName}>{stage.stageNumber}. {stage.name}</Text>
              <Text style={styles.stageMeta}>{stage.type}</Text>
              {stage.location ? <Text style={styles.stageMeta}>{stage.location}</Text> : null}
            </View>
          ))}
        </Card>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 8,
  },
  detailBlock: {
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  stagesCard: {
    marginTop: 2,
  },
  stageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  stageRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingVertical: 8,
  },
  stageName: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  stageMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 15,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    padding: 12,
  },
  errorBannerText: {
    color: COLORS.white,
    textAlign: 'center',
  },
});

export default RideDetailsScreen;
