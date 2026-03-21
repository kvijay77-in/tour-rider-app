/**
 * Tour list screen — browse available tours.
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
import { TourCard } from '../../components/tour/TourCard';
import { getTours } from '../../services/api/tourApi';
import { logger } from '../../utils/logger';
import type { Tour } from '../../types/tour';

const TAG = 'TourListScreen';

export function TourListScreen({ navigation }: { navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void } }) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTours = useCallback(async () => {
    setError(null);
    try {
      const response = await getTours();
      if (response.success && response.data) {
        setTours(response.data.items);
      } else {
        const msg = response.error?.message ?? 'Failed to load tours.';
        setError(msg);
      }
    } catch (err) {
      logger.error(TAG, 'Error fetching tours', err);
      setError('Unable to load tours. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTours();
  }, [fetchTours]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTours();
  };

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="Loading tours..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Available Tours</Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={tours}
        keyExtractor={(item) => item.tourId}
        renderItem={({ item }) => (
          <TourCard
            tour={item}
            onPress={() => navigation.navigate('TourDetails', { tourId: item.tourId })}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tours available at this time.</Text>
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
});

export default TourListScreen;
