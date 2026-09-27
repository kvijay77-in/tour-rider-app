/**
 * Tour dashboard screen — enrolled rider's tour overview.
 *
 * Shows tour banner, today's ride, personal stats placeholder,
 * and Not Riding / Quit Riding self-service actions.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { TourInfoBanner } from '../../components/tour/TourInfoBanner';
import { useTour } from '../../hooks/useTour';
import { submitNotRiding, submitQuitRiding } from '../../services/api/checkInApi';
import { computeTourDay } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';

const TAG = 'TourDashboardScreen';

export function TourDashboardScreen() {
  const {
    activeTour,
    enrollment,
    activeTodaysRide,
    isLoading: isLoadingActiveTour,
    loadActiveTour,
  } = useTour();

  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActiveTour();
    setError(null);
    setRefreshing(false);
  };

  const handleNotRiding = () => {
    if (!activeTour || !enrollment || !activeTodaysRide) return;

    Alert.alert(
      'Not Riding Today',
      'Are you sure you want to mark yourself as Not Riding for today\'s ride? You will not be able to check in at any stages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await submitNotRiding(activeTour.tourId, {
                riderId: enrollment.riderId,
                rideId: activeTodaysRide.rideId,
              });
              logger.info(TAG, 'Not Riding submitted');
              await loadActiveTour();
            } catch (err) {
              logger.error(TAG, 'Error submitting Not Riding', err);
              Alert.alert('Error', 'Failed to submit Not Riding. Please try again.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleQuitRiding = () => {
    if (!activeTour || !enrollment || !activeTodaysRide) return;

    Alert.alert(
      'Quit Riding',
      'Are you sure you want to quit the current ride? You will not be able to check in at any remaining stages for this ride.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I\'m Sure',
          style: 'destructive',
          onPress: () => {
            // Double confirmation
            Alert.alert(
              'Final Confirmation',
              'This cannot be undone for this ride. Do you really want to quit riding?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Quit Ride',
                  style: 'destructive',
                  onPress: async () => {
                    setActionLoading(true);
                    try {
                      await submitQuitRiding(activeTour.tourId, {
                        riderId: enrollment.riderId,
                        rideId: activeTodaysRide.rideId,
                      });
                      logger.info(TAG, 'Quit Riding submitted');
                      await loadActiveTour();
                    } catch (err) {
                      logger.error(TAG, 'Error submitting Quit Riding', err);
                      Alert.alert('Error', 'Failed to submit Quit Riding. Please try again.');
                    } finally {
                      setActionLoading(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  if (!activeTour) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.infoText}>No active tour enrollment.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoadingActiveTour && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="Loading dashboard..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <TourInfoBanner
          tour={activeTour}
          currentDay={computeTourDay(activeTour.startDate)}
          totalDays={activeTour.rideCount ?? 1}
        />

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Today's ride summary */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Today&apos;s Ride</Text>
          {activeTodaysRide ? (
            <View>
              <Text style={styles.rideName}>{activeTodaysRide.name}</Text>
              <Text style={styles.rideDetail}>
                {activeTodaysRide.startLocation} → {activeTodaysRide.finishLocation}
              </Text>
              <Text style={styles.rideDetail}>
                {activeTodaysRide.totalDistance} km • {activeTodaysRide.stages.length} stages
              </Text>
            </View>
          ) : (
            <Text style={styles.infoText}>No ride scheduled for today.</Text>
          )}
        </Card>

        {/* Personal statistics placeholder */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Personal Statistics</Text>
          <Text style={styles.infoText}>Statistics will be available as you complete rides.</Text>
        </Card>

        {/* Self-service actions */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Self-Service</Text>
          <View style={styles.actionRow}>
            <View style={styles.actionButton}>
              <Button
                title="Not Riding Today"
                onPress={handleNotRiding}
                variant="secondary"
                disabled={actionLoading || !activeTodaysRide}
                loading={actionLoading}
              />
            </View>
            <View style={styles.actionButton}>
              <Button
                title="Quit Riding"
                onPress={handleQuitRiding}
                variant="danger"
                disabled={actionLoading || !activeTodaysRide}
                loading={actionLoading}
              />
            </View>
          </View>
        </Card>
      </ScrollView>
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
  container: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sectionCard: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  rideName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  rideDetail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: COLORS.danger,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    color: COLORS.white,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default TourDashboardScreen;
