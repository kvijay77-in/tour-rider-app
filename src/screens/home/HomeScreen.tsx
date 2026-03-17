/**
 * Home screen — conditional rendering based on tour enrollment.
 *
 * Enrolled riders see a tour dashboard view; unenrolled riders see a
 * browse-tours prompt.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';

import { COLORS } from '../../constants';
import { useTour } from '../../hooks/useTour';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { TourInfoBanner } from '../../components/tour/TourInfoBanner';
import { getTodaysRide } from '../../services/api/rideApi';
import { logger } from '../../utils/logger';
import type { Ride } from '../../types/ride';

const TAG = 'HomeScreen';

export function HomeScreen({ navigation }: { navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void } }) {
  const { activeTour, isEnrolled, isLoading: tourLoading, loadActiveTour } = useTour();

  const [todaysRide, setTodaysRide] = useState<Ride | null>(null);
  const [rideLoading, setRideLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTodaysRide = useCallback(async () => {
    if (!activeTour) return;
    setRideLoading(true);
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
      setRideLoading(false);
    }
  }, [activeTour]);

  useEffect(() => {
    if (isEnrolled && activeTour) {
      fetchTodaysRide();
    }
  }, [isEnrolled, activeTour, fetchTodaysRide]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActiveTour();
    if (activeTour) {
      await fetchTodaysRide();
    }
    setRefreshing(false);
  };

  const computeCurrentDay = (): number => {
    if (!activeTour) return 1;
    const start = new Date(activeTour.startDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
  };

  if (tourLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <OfflineBanner />
        <LoadingSpinner message="Loading tour data..." />
      </SafeAreaView>
    );
  }

  // Enrolled rider — tour dashboard view
  if (isEnrolled && activeTour) {
    const currentDay = computeCurrentDay();
    const totalDays = activeTour.rideCount ?? 1;

    return (
      <SafeAreaView style={styles.safeArea}>
        <OfflineBanner />
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <TourInfoBanner
            tour={activeTour}
            currentDay={currentDay}
            totalDays={totalDays}
          />

          {/* Today's ride summary */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Today&apos;s Ride</Text>
            {rideLoading ? (
              <Text style={styles.infoText}>Loading ride info...</Text>
            ) : todaysRide ? (
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

          {/* Quick actions */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionRow}>
              <View style={styles.actionButton}>
                <Button
                  title="Check-In Status"
                  onPress={() => navigation.navigate('CheckInTab')}
                  variant="secondary"
                />
              </View>
              <View style={styles.actionButton}>
                <Button
                  title="Notifications"
                  onPress={() => navigation.navigate('NotificationsTab')}
                  variant="secondary"
                />
              </View>
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Unenrolled rider — browse tours
  return (
    <SafeAreaView style={styles.safeArea}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.centeredContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.welcomeTitle}>Welcome to Tour Rider</Text>
        <Text style={styles.welcomeText}>
          You are not currently enrolled in a tour. Browse available tours to get started.
        </Text>
        <Button
          title="Browse Tours"
          onPress={() => navigation.navigate('TourList')}
        />
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
  centeredContainer: {
    flexGrow: 1,
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
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
});

export default HomeScreen;
