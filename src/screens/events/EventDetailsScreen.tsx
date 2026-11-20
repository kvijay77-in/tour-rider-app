import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { EventOccurrenceCard } from '../../components/events/EventOccurrenceCard';
import {
  cancelSelfEventRecord,
  getEvent,
  getEventBootstrap,
  getEventOccurrences,
  getRiderEventProgress,
  registerForOccurrence,
  submitSelfEventRecord,
  unregisterFromOccurrence,
} from '../../services/api/eventApi';
import { ApiError } from '../../services/api/apiClient';
import { getEventErrorMessage } from '../../utils/eventPresentation';
import { logger } from '../../utils/logger';
import type {
  EventActivity,
  EventActivityOutcome,
  EventBootstrap,
  EventDefinition,
  EventOccurrence,
  EventProgressItem,
  RiderEventProgress,
} from '../../types/event';
import type { EventsStackParamList } from '../../types/navigation';

const TAG = 'EventDetailsScreen';

type Props = NativeStackScreenProps<EventsStackParamList, 'EventDetails'>;

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return getEventErrorMessage(error.errorCode, error.message);
  return 'Event details could not be loaded. Check your connection and try again.';
}

function requireResponse<T>(response: { success: boolean; data?: T; error?: { code: string; message: string } }): T {
  if (!response.success || response.data === undefined) {
    throw new ApiError(response.error?.message ?? 'The event request failed.', 500, response.error?.code);
  }
  return response.data;
}

export function EventDetailsScreen({ route }: Props) {
  const { tourId, eventId, riderId } = route.params;
  const [event, setEvent] = useState<EventDefinition | null>(null);
  const [occurrences, setOccurrences] = useState<EventOccurrence[]>([]);
  const [bootstrap, setBootstrap] = useState<EventBootstrap | null>(null);
  const [progress, setProgress] = useState<RiderEventProgress>({ items: [], registrations: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [eventResponse, occurrenceResponse, bootstrapResponse, progressResponse] = await Promise.all([
        getEvent(tourId, eventId),
        getEventOccurrences(tourId, eventId),
        getEventBootstrap(tourId),
        getRiderEventProgress(tourId, riderId, eventId),
      ]);
      const nextEvent = requireResponse(eventResponse);
      const nextOccurrences = requireResponse(occurrenceResponse).items;
      const nextBootstrap = requireResponse(bootstrapResponse);
      const nextProgress = requireResponse(progressResponse);
      setEvent(nextEvent);
      setOccurrences([...nextOccurrences].sort((left, right) => (
        left.date.localeCompare(right.date) || left.seq - right.seq
      )));
      setBootstrap(nextBootstrap);
      setProgress({ items: nextProgress.items ?? [], registrations: nextProgress.registrations ?? [] });
    } catch (loadError) {
      logger.warn(TAG, `Unable to load event ${eventId} for tour ${tourId}`, loadError);
      setError(apiMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId, riderId, tourId]);

  useFocusEffect(useCallback(() => {
    void loadData();
  }, [loadData]));

  const bootstrapOccurrences = bootstrap?.activeOccurrences ?? [];
  const sortedActivities = useMemo(
    () => [...(event?.activities ?? [])].sort((left, right) => left.sequenceNo - right.sequenceNo),
    [event?.activities],
  );

  const performAction = useCallback(async (action: () => Promise<{ success: boolean; error?: { code: string; message: string } }>) => {
    setBusy(true);
    try {
      const response = await action();
      if (!response.success) {
        throw new ApiError(response.error?.message ?? 'The event action failed.', 500, response.error?.code);
      }
      await loadData(false);
    } catch (actionError) {
      Alert.alert('Event update', apiMessage(actionError));
      await loadData(false);
    } finally {
      setBusy(false);
    }
  }, [loadData]);

  const confirmCancel = useCallback((occurrenceId: string, recordId: string) => {
    Alert.alert('Cancel activity record?', 'You can record this activity again after the event refreshes.', [
      { text: 'Keep record', style: 'cancel' },
      {
        text: 'Cancel record',
        style: 'destructive',
        onPress: () => void performAction(() => cancelSelfEventRecord(tourId, eventId, occurrenceId, recordId)),
      },
    ]);
  }, [eventId, performAction, tourId]);

  const submitRecord = useCallback((occurrenceId: string, activity: EventActivity, outcome: EventActivityOutcome, variantSelected?: string) => {
    void performAction(() => submitSelfEventRecord(tourId, eventId, occurrenceId, {
      activityId: activity.activityId,
      outcome,
      ...(variantSelected ? { variantSelected } : {}),
    }));
  }, [eventId, performAction, tourId]);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(false)} />}
      >
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {event ? (
          <>
            <View style={styles.heading}>
              <Text style={styles.title}>{event.eventName}</Text>
              <Text style={styles.meta}>{event.eventType} · {event.location}</Text>
            </View>
            <View style={styles.activitiesSummary}>
              <Text style={styles.sectionTitle}>Activities</Text>
              {sortedActivities.map((activity) => (
                <Text key={activity.activityId} style={styles.summaryActivity}>
                  {activity.sequenceNo}. {activity.name}{activity.mandatory ? ' · Mandatory' : ''}
                </Text>
              ))}
            </View>
            <Text style={styles.sectionTitle}>Occurrences</Text>
            {occurrences.length === 0 ? <Text style={styles.empty}>No occurrences are scheduled.</Text> : null}
            {occurrences.map((occurrence) => {
              const bootstrapOccurrence = bootstrapOccurrences.find((item) => item.occurrenceId === occurrence.occurrenceId);
              const progressRegistration = progress.registrations.find((item) => item.occurrenceId === occurrence.occurrenceId);
              const registered = bootstrapOccurrence?.registered ?? progressRegistration?.registered ?? false;
              const permissions = Object.fromEntries(
                (bootstrapOccurrence?.activitySelfService ?? []).map((item) => [item.activityId, item.selfServiceAllowed]),
              );
              const occurrenceProgress: EventProgressItem[] = progress.items.filter(
                (item) => item.occurrenceId === occurrence.occurrenceId,
              );

              return (
                <EventOccurrenceCard
                  key={occurrence.occurrenceId}
                  event={event}
                  occurrence={occurrence}
                  registered={registered}
                  progress={occurrenceProgress}
                  selfServiceByActivity={permissions}
                  busy={busy}
                  onRegister={() => void performAction(() => registerForOccurrence(tourId, eventId, occurrence.occurrenceId))}
                  onUnregister={() => void performAction(() => unregisterFromOccurrence(tourId, eventId, occurrence.occurrenceId))}
                  onRecord={(activity, outcome, variantSelected) => submitRecord(occurrence.occurrenceId, activity, outcome, variantSelected)}
                  onCancel={(recordId) => confirmCancel(occurrence.occurrenceId, recordId)}
                />
              );
            })}
          </>
        ) : <Text style={styles.empty}>Event details are unavailable.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 30 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { color: COLORS.danger, fontSize: 14, marginBottom: 12 },
  heading: { paddingBottom: 16 },
  title: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700' },
  meta: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  activitiesSummary: { paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 12, marginBottom: 7 },
  summaryActivity: { color: COLORS.textSecondary, fontSize: 14, paddingVertical: 4 },
  empty: { color: COLORS.textSecondary, fontSize: 14, paddingVertical: 8 },
});

export default EventDetailsScreen;