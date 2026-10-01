/**
 * Active and historical tour rides list screen.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { Card } from '../../components/common/Card';
import { DocumentsSection } from '../../components/tour/DocumentsSection';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { SearchableSelectField, type SelectOption } from '../../components/common/SearchableSelectField';
import { getTourRides } from '../../services/api/rideApi';
import { getTours, getProfileTourParticipations } from '../../services/api/tourApi';
import { getRiderRideCheckIns } from '../../services/api/checkInApi';
import { useTour } from '../../hooks/useTour';
import { useRider } from '../../hooks/useRider';
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
import { TourRiderStatus, TourStatus } from '../../types/tour';
import type { Ride } from '../../types/ride';
import type { Tour, TourParticipation } from '../../types/tour';
import type { CheckIn } from '../../types/checkin';
import type { TourStackParamList } from '../../types/navigation';

const TAG = 'TourScreen';

function formatTourDateRange(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) {
    return 'Dates unavailable';
  }

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function extractTourItems(payload: unknown): Tour[] {
  logger.debug(TAG, 'Extracting tour items from payload...');

  if (Array.isArray(payload)) {
    logger.debug(TAG, `Payload is an array with ${payload.length} items`);
    return payload as Tour[];
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as { tours?: unknown; items?: unknown; count?: unknown };
    logger.debug(TAG, `Payload actual keys: ${JSON.stringify(Object.keys(objectPayload))}`);

    if (Array.isArray(objectPayload.tours)) {
      logger.debug(TAG, `Payload has tours array with ${objectPayload.tours.length} items`);
      return objectPayload.tours as Tour[];
    }

    if (Array.isArray(objectPayload.items)) {
      logger.debug(TAG, `Payload has items array with ${objectPayload.items.length} items`);
      return objectPayload.items as Tour[];
    }
  }

  logger.warn(TAG, 'Tours payload did not include a supported tours list key');

  return [];
}

type Props = NativeStackScreenProps<TourStackParamList, 'TourRides'>;

export function TourScreen({ navigation }: Props) {
  const { activeTour, activeRides, enrollment, loadActiveTour } = useTour();
  const { profile } = useRider();
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
  const checkInCacheRef = useRef<Map<string, CheckIn[]>>(new Map());
  const [participations, setParticipations] = useState<TourParticipation[]>([]);
  const [loadingCheckInKey, setLoadingCheckInKey] = useState<string | null>(null);
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);

  useEffect(() => {
    selectedTourIdRef.current = selectedTourId;
  }, [selectedTourId]);

  const loadParticipations = useCallback(async () => {
    if (!profile?.profileId) {
      setParticipations([]);
      return;
    }

    try {
      const response = await getProfileTourParticipations(profile.profileId);
      setParticipations(response.success ? response.data?.items ?? [] : []);
    } catch (error) {
      logger.warn(TAG, 'Failed to load rider tour participations');
      logger.debug(TAG, 'Rider tour participation load failure', error);
      setParticipations([]);
    }
  }, [profile?.profileId]);

  useEffect(() => {
    void loadParticipations();
  }, [loadParticipations]);

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
    logger.debug(TAG, `Generating tour options for ${availableTours.length} available tours`);
    return availableTours.map((tour) => ({
      value: tour.tourId,
      label: tour.name,
      // No details required as name itself is good enough.
      detail: '',
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
        if (requestId !== ridesRequestIdRef.current) {
          return;
        }

        setRides(sortRidesForDisplay(activeRides));
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
  }, [activeRides]);

  const loadTourData = useCallback(async () => {
    const requestId = ++catalogRequestIdRef.current;
    const currentSelectedTourId = selectedTourIdRef.current;

    try {
      let cachedHistoricalTours = await getCachedHistoricalTours();

      if (!cachedHistoricalTours.length) {
        const toursResponse = await getTours();
        logger.debug(TAG, `Response status for historical tours catalog: ${toursResponse.success ? 'success' : 'failure'}`);
        if (requestId !== catalogRequestIdRef.current) {
          return;
        }

      const fetchedTours = extractTourItems(toursResponse.data);
      logger.debug(TAG, `Fetched ${fetchedTours.length} historical tours from API`);

        if (toursResponse.success || fetchedTours.length > 0) {
          cachedHistoricalTours = filterHistoricalTours(fetchedTours);
          await cacheHistoricalTourCatalog(cachedHistoricalTours);
        } else {
          logger.warn(TAG, toursResponse.error?.message ?? 'Unable to load historical tour catalog');
        }
      }

      if (requestId !== catalogRequestIdRef.current) {
        return;
      }

      setHistoricalTours(cachedHistoricalTours);
      logger.debug(TAG, `Loaded ${cachedHistoricalTours.length} historical tours from cache`);

      const nextSelectedTourId = (() => {
        if (activeTour && !previousActiveTourIdRef.current) {
          return activeTour.tourId;
        }

        if (activeTour && currentSelectedTourId === previousActiveTourIdRef.current) {
          return activeTour.tourId;
        }

        if (currentSelectedTourId && [...cachedHistoricalTours, ...(activeTour ? [activeTour] : [])].some((tour) => tour.tourId === currentSelectedTourId)) {
          return currentSelectedTourId;
        }

        return activeTour?.tourId ?? cachedHistoricalTours[0]?.tourId ?? null;
      })();

      previousActiveTourIdRef.current = activeTour?.tourId ?? null;
      setSelectedTourId(nextSelectedTourId);
    } catch (err) {
      logger.warn(TAG, 'Failed to load tour data');
      logger.debug(TAG, 'Tour data load failure', err);
      setHistoricalTours([]);
      setSelectedTourId(null);
      setRides([]);
    } finally {
      if (requestId === catalogRequestIdRef.current) {
        setIsLoadingTours(false);
      }
    }
  }, [activeTour]);

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
    checkInCacheRef.current.clear();
    setDocumentsRefreshKey((current) => current + 1);
    await loadActiveTour();
    await loadParticipations();
    await loadTourData();
    setIsRefreshing(false);
  }, [loadActiveTour, loadParticipations, loadTourData]);

  const getParticipation = useCallback((tourId: string): TourParticipation | null => {
    if (tourId === activeTour?.tourId && enrollment) {
      return { ...enrollment, tourId };
    }

    return participations.find((participation) => participation.tourId === tourId) ?? null;
  }, [activeTour?.tourId, enrollment, participations]);

  const navigateToRideInfo = useCallback((tourId: string, rideId: string) => {
    navigation.navigate('RideDetails', { rideId, tourId });
  }, [navigation]);

  const handleRidePress = useCallback(async (tour: Tour, ride: Ride) => {
    const participation = getParticipation(tour.tourId);
    const isRegistered = participation?.status === TourRiderStatus.REGISTERED
      || participation?.status === TourRiderStatus.ACTIVE;

    if (!isRegistered || typeof ride.rideNo !== 'number') {
      navigateToRideInfo(tour.tourId, ride.rideId);
      return;
    }

    const cacheKey = `${tour.tourId}:${ride.rideNo}`;
    let checkIns = checkInCacheRef.current.get(cacheKey);
    if (!checkIns) {
      setLoadingCheckInKey(cacheKey);
      try {
        const response = await getRiderRideCheckIns(tour.tourId, participation.riderId, ride.rideNo);
        checkIns = response.success ? response.data?.checkIns ?? [] : [];
        checkInCacheRef.current.set(cacheKey, checkIns);
      } catch (error) {
        logger.warn(TAG, `Unable to load check-ins for ${cacheKey}`);
        logger.debug(TAG, 'Ride check-in lookup failure', error);
        navigateToRideInfo(tour.tourId, ride.rideId);
        return;
      } finally {
        setLoadingCheckInKey(null);
      }
    }

    if (checkIns.length === 0) {
      navigateToRideInfo(tour.tourId, ride.rideId);
      return;
    }

    Alert.alert(
      'Ride options',
      'Choose what you want to view.',
      [
        { text: 'Ride info', onPress: () => navigateToRideInfo(tour.tourId, ride.rideId) },
        {
          text: 'Check-In',
          onPress: () => navigation.navigate('CheckInStatus', {
            tourId: tour.tourId,
            riderId: participation.riderId,
            rideId: ride.rideId,
            rideNo: ride.rideNo,
          }),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [getParticipation, navigation, navigateToRideInfo]);

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

            <DocumentsSection tourId={selectedTour.tourId} refreshKey={documentsRefreshKey} />

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
                    onPress={() => void handleRidePress(selectedTour, ride)}
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
                      {(() => {
                        const participation = getParticipation(selectedTour.tourId);
                        const isRegistered = participation?.status === TourRiderStatus.REGISTERED
                          || participation?.status === TourRiderStatus.ACTIVE;
                        if (!isRegistered) return null;
                        const cacheKey = `${selectedTour.tourId}:${ride.rideNo}`;
                        return (
                          <View
                            style={styles.checkInHint}
                            accessibilityRole="image"
                            accessibilityLabel="Check-in status available for this registered ride"
                            accessibilityHint={loadingCheckInKey === cacheKey ? 'Loading check-in status' : 'Open ride options to view check-in status'}
                          >
                            <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
                            <Text style={styles.checkInHintText}>
                            {loadingCheckInKey === cacheKey ? 'Loading check-in status...' : 'Check-in status'}
                            </Text>
                          </View>
                        );
                      })()}
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
  checkInHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkInHintText: {
    marginLeft: 4,
    fontSize: 13,
    color: COLORS.primary,
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
