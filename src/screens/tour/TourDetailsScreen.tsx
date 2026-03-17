/**
 * Tour details screen — shows full tour information with register action.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';

import { COLORS } from '../../constants';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { getTourDetails } from '../../services/api/tourApi';
import { formatDate } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import { useTour } from '../../hooks/useTour';
import type { Tour } from '../../types/tour';
import { TourStatus } from '../../types/tour';

const TAG = 'TourDetailsScreen';

const STATUS_BADGE_MAP: Record<TourStatus, { label: string; color: string }> = {
  [TourStatus.PLANNING]: { label: 'Planning', color: COLORS.gray[400] },
  [TourStatus.PROVISIONING]: { label: 'Provisioning', color: COLORS.info },
  [TourStatus.ACTIVE]: { label: 'Active', color: COLORS.success },
  [TourStatus.COMPLETED]: { label: 'Completed', color: COLORS.secondary },
  [TourStatus.ARCHIVED]: { label: 'Archived', color: COLORS.gray[500] },
};

interface RouteParams {
  tourId: string;
}

export function TourDetailsScreen({ route, navigation }: {
  route: { params: RouteParams };
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}) {
  const { tourId } = route.params;
  const { isEnrolled, activeTour } = useTour();

  const [tour, setTour] = useState<Tour | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    setError(null);
    try {
      const response = await getTourDetails(tourId);
      if (response.success && response.data) {
        setTour(response.data);
      } else {
        setError(response.error?.message ?? 'Failed to load tour details.');
      }
    } catch (err) {
      logger.error(TAG, 'Error fetching tour details', err);
      setError('Unable to load tour details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [tourId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <OfflineBanner />
        <LoadingSpinner message="Loading tour details..." />
      </SafeAreaView>
    );
  }

  if (error || !tour) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <OfflineBanner />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Tour not found.'}</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  const badge = STATUS_BADGE_MAP[tour.status];
  const alreadyEnrolled = isEnrolled && activeTour?.tourId === tourId;
  const canRegister = tour.registrationOpen === true && !alreadyEnrolled;

  return (
    <SafeAreaView style={styles.safeArea}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.tourName}>{tour.name}</Text>
          <StatusBadge status={badge.label} color={badge.color} />
        </View>

        <Card style={styles.detailCard}>
          <DetailRow label="Dates" value={`${formatDate(tour.startDate)} – ${formatDate(tour.endDate)}`} />
          {tour.location ? <DetailRow label="Location" value={tour.location} /> : null}
          {tour.organizer ? <DetailRow label="Organizer" value={tour.organizer} /> : null}
          {tour.rideCount != null ? <DetailRow label="Rides" value={String(tour.rideCount)} /> : null}
        </Card>

        {tour.description ? (
          <Card style={styles.detailCard}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{tour.description}</Text>
          </Card>
        ) : null}

        {alreadyEnrolled ? (
          <View style={styles.enrolledBanner}>
            <Text style={styles.enrolledText}>You are enrolled in this tour.</Text>
          </View>
        ) : null}

        {canRegister ? (
          <Button
            title="Register for Tour"
            onPress={() => navigation.navigate('TourRegistration', { tourId })}
          />
        ) : null}

        {!canRegister && !alreadyEnrolled ? (
          <Text style={styles.closedText}>Registration is not currently open for this tour.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Detail row helper
// ---------------------------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
  container: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tourName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  detailCard: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  enrolledBanner: {
    backgroundColor: COLORS.success,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  enrolledText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  closedText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default TourDetailsScreen;
