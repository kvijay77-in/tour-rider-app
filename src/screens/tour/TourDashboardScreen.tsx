/**
 * Tour dashboard screen — enrolled rider's tour overview.
 *
 * Shows tour banner, today's ride, personal stats placeholder,
 * and Not Riding / Quit Riding self-service actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Alert,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';

import { COLORS } from '../../constants';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { TourInfoBanner } from '../../components/tour/TourInfoBanner';
import { useTour } from '../../hooks/useTour';
import { getTodaysRide } from '../../services/api/rideApi';
import { submitNotRiding, submitQuitRiding } from '../../services/api/checkInApi';
import { computeTourDay } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import type { Ride } from '../../types/ride';

const TAG = 'TourDashboardScreen';

export function TourDashboardScreen() {
  const { activeTour, enrollment, loadActiveTour } = useTour();

  const [todaysRide, setTodaysRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTodaysRide = useCallback(async () => {
    if (!activeTour) return;
    try {
      const response = await getTodaysRide(activeTour.tourId);
      if (response.success && response.data) {
        setTodaysRide(response.data);
      } else {
        setTodaysRide(null);
      }
    } catch (err) {
      logger.error(TAG, 'Error fetching today\'s ride', err);
      setTodaysRide(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeTour]);

  useEffect(() => {
    fetchTodaysRide();
  }, [fetchTodaysRide]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActiveTour();
    await fetchTodaysRide();
    setRefreshing(false);
  };

  const handleNotRiding = () => {
    if (!activeTour || !enrollment || !todaysRide) return;

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
                rideId: todaysRide.rideId,
              });
              logger.info(TAG, 'Not Riding submitted');
              await fetchTodaysRide();
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
    if (!activeTour || !enrollment) return;

    Alert.alert(
      'Quit Riding',
      'Are you sure you want to quit this tour? This action is irreversible — you will not be able to check in at any future stages or rides.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I\'m Sure',
          style: 'destructive',
          onPress: () => {
            // Double confirmation
            Alert.alert(
              'Final Confirmation',
              'This cannot be undone. Do you really want to quit the tour?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Quit Tour',
                  style: 'destructive',
                  onPress: async () => {
                    setActionLoading(true);
                    try {
                      await submitQuitRiding(activeTour.tourId, {
                        riderId: enrollment.riderId,
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

  if (isLoading && !refreshing) {
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

        {/* Today's ride summary */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Today&apos;s Ride</Text>
          {todaysRide ? (
            <View>
              <Text style={styles.rideName}>{todaysRide.name}</Text>
              <Text style={styles.rideDetail}>
                {todaysRide.startLocation} → {todaysRide.finishLocation}
              </Text>
              <Text style={styles.rideDetail}>
                {todaysRide.totalDistance} km • {todaysRide.stages.length} stages
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
                disabled={actionLoading || !todaysRide}
                loading={actionLoading}
              />
            </View>
            <View style={styles.actionButton}>
              <Button
                title="Quit Riding"
                onPress={handleQuitRiding}
                variant="danger"
                disabled={actionLoading}
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
});

export default TourDashboardScreen;
