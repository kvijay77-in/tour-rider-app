import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { useTour } from '../../hooks/useTour';
import { getEvents, getEventBootstrap } from '../../services/api/eventApi';
import { getProfileTourParticipations, getTours } from '../../services/api/tourApi';
import { ApiError } from '../../services/api/apiClient';
import { sortEventToursActiveFirst } from '../../utils/eventPresentation';
import { logger } from '../../utils/logger';
import type { EventDefinition } from '../../types/event';
import type { EventsStackParamList } from '../../types/navigation';
import type { Tour } from '../../types/tour';

const TAG = 'EventsScreen';

type EventsGroup = {
  tour: Tour;
  riderId: string;
  events: EventDefinition[];
};

function errorText(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Events could not be loaded. Check your connection and try again.';
}

export function EventsScreen() {
  const { user } = useAuth();
  const { activeTour } = useTour();
  const navigation = useNavigation<NativeStackNavigationProp<EventsStackParamList>>();
  const [groups, setGroups] = useState<EventsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (showLoading = true) => {
    if (!user?.profileId) {
      setGroups([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [participationResponse, toursResponse] = await Promise.all([
        getProfileTourParticipations(user.profileId),
        getTours(),
      ]);
      if (!participationResponse.success || !toursResponse.success) {
        throw new Error(participationResponse.error?.message ?? toursResponse.error?.message ?? 'Tour list unavailable');
      }

      const tourById = new Map((toursResponse.data?.items ?? []).map((tour) => [tour.tourId, tour]));
      const participationByTour = new Map(
        (participationResponse.data?.items ?? []).map((participation) => [participation.tourId, participation]),
      );
      const riderTours = sortEventToursActiveFirst([...new Set((participationResponse.data?.items ?? []).map((item) => item.tourId))]
        .map((tourId) => tourById.get(tourId))
        .filter((tour): tour is Tour => tour !== undefined), activeTour?.tourId);

      const nextGroups = await Promise.all(riderTours.map(async (tour) => {
        const riderId = participationByTour.get(tour.tourId)?.riderId;
        if (!riderId) return null;
        try {
          const [eventsResponse, bootstrapResponse] = await Promise.all([
            getEvents(tour.tourId),
            getEventBootstrap(tour.tourId),
          ]);
          if (!eventsResponse.success || !bootstrapResponse.success) {
            throw new Error(eventsResponse.error?.message ?? bootstrapResponse.error?.message ?? 'Event data unavailable');
          }
          return { tour, riderId, events: eventsResponse.data?.items ?? [] };
        } catch (tourError) {
          logger.warn(TAG, `Unable to load events for tour ${tour.tourId}`, tourError);
          return { tour, riderId, events: [] };
        }
      }));
      setGroups(nextGroups.filter((group): group is EventsGroup => group !== null));
    } catch (loadError) {
      logger.warn(TAG, 'Unable to load rider event list', loadError);
      setError(errorText(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTour?.tourId, user?.profileId]);

  useFocusEffect(useCallback(() => {
    void loadEvents();
  }, [loadEvents]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadEvents(false)} />}
      >
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {groups.length === 0 ? (
          <Text style={styles.empty}>No events are available for your tours.</Text>
        ) : groups.map(({ tour, riderId, events }) => (
          <View key={tour.tourId} style={styles.tourGroup}>
            <Text style={styles.tourName}>{tour.name}</Text>
            {events.length === 0 ? <Text style={styles.emptyGroup}>No events listed.</Text> : null}
            {events.map((event) => (
              <Pressable
                key={`${tour.tourId}-${event.eventId}`}
                accessibilityRole="button"
                accessibilityLabel={`${event.eventName}, ${event.eventType}, ${event.location}`}
                onPress={() => navigation.navigate('EventDetails', {
                  tourId: tour.tourId,
                  eventId: event.eventId,
                  riderId,
                })}
                style={({ pressed }) => [styles.eventRow, pressed ? styles.pressed : null]}
              >
                <View style={styles.eventCopy}>
                  <Text style={styles.eventName}>{event.eventName}</Text>
                  <Text style={styles.eventMeta}>{event.eventType} · {event.location}</Text>
                </View>
                <View style={styles.eventTrailing}>
                  <Text style={styles.registrationTag}>
                    {event.registrationEnabled ? 'Registration required' : 'Registration not required'}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 30, flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: COLORS.danger, fontSize: 14, marginBottom: 12 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 48, fontSize: 15 },
  tourGroup: { marginBottom: 22 },
  tourName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyGroup: { color: COLORS.textSecondary, fontSize: 14, paddingVertical: 8 },
  eventRow: {
    minHeight: 72,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  eventCopy: { flex: 1, marginRight: 8 },
  eventName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  eventMeta: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  eventTrailing: { alignItems: 'flex-end', maxWidth: '43%' },
  registrationTag: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'right' },
  chevron: { color: COLORS.textDisabled, fontSize: 22, lineHeight: 23 },
  pressed: { opacity: 0.7 },
});

export default EventsScreen;