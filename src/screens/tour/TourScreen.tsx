/**
 * Active and historical tour rides list screen.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { Card } from '../../components/common/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { SearchableSelectField, type SelectOption } from '../../components/profile/SearchableSelectField';
import { getTourRides } from '../../services/api/rideApi';
import { getActiveTour, getTours } from '../../services/api/tourApi';
import {
  cacheHistoricalTourCatalog,
  cacheHistoricalTourRides,
  filterHistoricalTours,
  getCachedHistoricalTourRides,
  getCachedHistoricalTours,
  getHistoricalTourCacheRecord,
  sortRidesForDisplay,
  sortToursForDisplay,
} from '../../services/tourHistoryStore';
import { formatDate } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import { TourStatus } from '../../types/tour';
import type { Ride } from '../../types/ride';
import type { Tour } from '../../types/tour';
import type { TourStackParamList } from '../../types/navigation';

const TAG = 'TourScreen';

function formatTourDateRange(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) {
    return 'Dates unavailable';
  }

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

type Props = NativeStackScreenProps<TourStackParamList, 'TourRides'>;

export function TourScreen({ navigation }: Props) {
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [historicalTours, setHistoricalTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoadingTours, setIsLoadingTours] = useState(true);
  const [isLoadingRides, setIsLoadingRides] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const catalogRequestIdRef = useRef(0);
  const ridesRequestIdRef = useRef(0);
  const selectedTourIdRef = useRef<string | null>(null);
  const previousActiveTourIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedTourIdRef.current = selectedTourId;
  }, [selectedTourId]);

  const availableTours = useMemo(() => {
    return sortToursForDisplay([
      ...(activeTour ? [activeTour] : []),
      ...historicalTours.filter((tour) => tour.tourId !== activeTour?.tourId),
    ]);
  }, [activeTour, historicalTours]);

  const selectedTour = useMemo(
    () => availableTours.find((tour) => tour.tourId === selectedTourId) ?? null,
    [availableTours, selectedTourId],
  );

  const tourOptions = useMemo<SelectOption[]>(() => {
    return availableTours.map((tour) => ({
      value: tour.tourId,
      label: tour.name,
      detail: `${tour.status} • ${formatTourDateRange(tour.startDate, tour.endDate)}`,
    }));
  }, [availableTours]);

  const loadSelectedTourRides = useCallback(async (tour: Tour | null) => {
    const requestId = ++ridesRequestIdRef.current;

    if (!tour) {
      setRides([]);
      return;
    }

    setIsLoadingRides(true);
    setRides([]);

    try {
      if (tour.status === TourStatus.ACTIVE) {
        const ridesResponse = await getTourRides(tour.tourId);
        if (requestId !== ridesRequestIdRef.current) {
          return;
        }

        if (ridesResponse.success) {
          const items = ridesResponse.data?.items ?? [];
          setRides(sortRidesForDisplay(items));
        } else {
          logger.warn(TAG, ridesResponse.error?.message ?? `Unable to load rides for tour ${tour.tourId}`);
          setRides([]);
        }

        return;
      }

      const cacheRecord = await getHistoricalTourCacheRecord(tour.tourId);
      if (requestId !== ridesRequestIdRef.current) {
        return;
      }

      if (cacheRecord?.ridesSynced) {
        const cachedRides = await getCachedHistoricalTourRides(tour.tourId);
        if (requestId !== ridesRequestIdRef.current) {
          return;
        }

        setRides(sortRidesForDisplay(cachedRides));
        return;
      }

      const ridesResponse = await getTourRides(tour.tourId);
      if (requestId !== ridesRequestIdRef.current) {
        return;
      }

      if (ridesResponse.success) {
        const items = ridesResponse.data?.items ?? [];
        await cacheHistoricalTourRides(tour, items);
        if (requestId !== ridesRequestIdRef.current) {
          return;
        }

        setRides(sortRidesForDisplay(items));
      } else {
        logger.warn(TAG, ridesResponse.error?.message ?? `Unable to load rides for historical tour ${tour.tourId}`);
        setRides([]);
      }
    } catch (loadError) {
      if (requestId !== ridesRequestIdRef.current) {
        return;
      }

      logger.warn(TAG, 'Failed to load selected tour rides');
      logger.debug(TAG, 'Selected tour ride load failure', loadError);
      setRides([]);
    } finally {
      if (requestId === ridesRequestIdRef.current) {
        setIsLoadingRides(false);
      }
    }
  }, []);

  const loadTourData = useCallback(async () => {
    const requestId = ++catalogRequestIdRef.current;
    const currentSelectedTourId = selectedTourIdRef.current;

    try {
      const activeTourResponse = await getActiveTour();
      const activeTourData = activeTourResponse.success ? activeTourResponse.data ?? null : null;

      if (!activeTourResponse.success) {
        logger.warn(TAG, activeTourResponse.error?.message ?? 'Unable to load active tour');
      }

      let cachedHistoricalTours = await getCachedHistoricalTours();

      if (!cachedHistoricalTours.length) {
        const toursResponse = await getTours();
        if (requestId !== catalogRequestIdRef.current) {
          return;
        }

        if (toursResponse.success && toursResponse.data?.items) {
          cachedHistoricalTours = filterHistoricalTours(toursResponse.data.items);
          await cacheHistoricalTourCatalog(cachedHistoricalTours);
        } else {
          logger.warn(TAG, toursResponse.error?.message ?? 'Unable to load historical tour catalog');
        }
      }

      if (requestId !== catalogRequestIdRef.current) {
        return;
      }

      setActiveTour(activeTourData);
      setHistoricalTours(cachedHistoricalTours);

      const nextSelectedTourId = (() => {
        if (activeTourData && !previousActiveTourIdRef.current) {
          return activeTourData.tourId;
        }

        if (activeTourData && currentSelectedTourId === previousActiveTourIdRef.current) {
          return activeTourData.tourId;
        }

        if (currentSelectedTourId && [...cachedHistoricalTours, ...(activeTourData ? [activeTourData] : [])].some((tour) => tour.tourId === currentSelectedTourId)) {
          return currentSelectedTourId;
        }

        return activeTourData?.tourId ?? cachedHistoricalTours[0]?.tourId ?? null;
      })();

      previousActiveTourIdRef.current = activeTourData?.tourId ?? null;
      setSelectedTourId(nextSelectedTourId);
    } catch (err) {
      logger.warn(TAG, 'Failed to load tour data');
      logger.debug(TAG, 'Tour data load failure', err);
      setActiveTour(null);
      setHistoricalTours([]);
      setSelectedTourId(null);
      setRides([]);
    } finally {
      if (requestId === catalogRequestIdRef.current) {
        setIsLoadingTours(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTourData();
  }, [loadTourData]);

  useEffect(() => {
    if (!selectedTour) {
      return;
    }

    void loadSelectedTourRides(selectedTour);
  }, [loadSelectedTourRides, selectedTour]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadTourData();
    setIsRefreshing(false);
  }, [loadTourData]);

  const sortedRides = useMemo(() => sortRidesForDisplay(rides), [rides]);

  const selectedTourMessage = selectedTour ? `${selectedTour.status} tour` : 'No tour selected';

  if (isLoadingTours) {
    return <LoadingSpinner message="Loading tours..." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {!selectedTour ? (
          <Card>
            <Text style={styles.emptyTitle}>No tours available right now</Text>
            <Text style={styles.emptySubtitle}>
              Active and historical tours will appear here once they are available.
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.headerCard}>
              <Text style={styles.sectionTitle}>Tour</Text>

              <SearchableSelectField
                label="Tour"
                value={selectedTour.tourId}
                options={tourOptions}
                onSelect={(option) => setSelectedTourId(option.value)}
                placeholder="Select a tour"
                searchPlaceholder="Search tours"
                selectedLabel={selectedTour.name}
              />

              <Text style={styles.tourName}>{selectedTour.name}</Text>
              <Text style={styles.tourMeta}>Tour ID: {selectedTour.tourId}</Text>
              <Text style={styles.tourMeta}>{formatTourDateRange(selectedTour.startDate, selectedTour.endDate)}</Text>
              <Text style={styles.tourMeta}>{selectedTourMessage}</Text>
            </Card>

            {isLoadingRides ? (
              <Card>
                <Text style={styles.emptySubtitle}>Loading rides for the selected tour...</Text>
              </Card>
            ) : null}

            {!isLoadingRides && !sortedRides.length ? (
              <Card>
                <Text style={styles.emptySubtitle}>No rides published for this tour yet.</Text>
              </Card>
            ) : null}

            {!isLoadingRides
              ? sortedRides.map((ride) => (
                  <TouchableOpacity
                    key={ride.rideId}
                    activeOpacity={0.75}
                    onPress={() => navigation.navigate('RideDetails', { rideId: ride.rideId, tourId: selectedTour.tourId })}
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
                ))
              : null}
          </>
        )}

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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
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
});

export default TourScreen;
