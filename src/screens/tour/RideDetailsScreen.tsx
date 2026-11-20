/**
 * Ride details screen.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { StageType } from '../../constants/stages';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { DocumentsSection } from '../../components/tour/DocumentsSection';
import { getRideDetails } from '../../services/api/rideApi';
import { logger } from '../../utils/logger';
import { RideStatus } from '../../types/ride';
import type { Ride, Stage } from '../../types/ride';
import type { TourStackParamList } from '../../types/navigation';

const TAG = 'RideDetailsScreen';

const TIMELINE_TONES = [COLORS.accent, COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger];

function formatStatusLabel(status: RideStatus): string {
  return status.replace(/_/g, ' ');
}

function formatDateShort(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeOnly(value?: string | null): string {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Combines the ride date (YYYY-MM-DD) with an HH:MM time into an ISO timestamp. */
function buildRideDateTime(rideDate: string, time?: string): string | null {
  if (!time) return null;
  const parsed = new Date(`${rideDate}T${time.length === 5 ? `${time}:00` : time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function addMinutes(value: string, minutes: number): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Date(parsed.getTime() + minutes * 60_000).toISOString();
}

function getStageEta(rideStart: string | null, stage: Stage): string | null {
  if (!rideStart || typeof stage.estimatedTimeFromStart !== 'number') return null;
  return addMinutes(rideStart, stage.estimatedTimeFromStart);
}

type Props = NativeStackScreenProps<TourStackParamList, 'RideDetails'>;

export function RideDetailsScreen({ route }: Props) {
  const { rideId, tourId } = route.params;

  const [ride, setRide] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      setError(null);

      try {
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
  }, [rideId, tourId]);

  const pitStops = useMemo(
    () =>
      (ride?.stages ?? [])
        .filter((stage) => stage.type === StageType.PIT_STOP)
        .sort((a, b) => a.stageNumber - b.stageNumber),
    [ride],
  );

  const finishStage = useMemo(
    () => (ride?.stages ?? []).find((stage) => stage.type === StageType.FINISH),
    [ride],
  );

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

  const isFutureRide = ride.status === RideStatus.PLANNED;
  const plannedStart = buildRideDateTime(ride.date, ride.flagOffTime);
  const rideStart = isFutureRide ? plannedStart : (ride.startedAt ?? plannedStart);
  const plannedFinish = finishStage ? getStageEta(rideStart, finishStage) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{ride.name}</Text>
            <View style={styles.headerMetaRow}>
              <Text style={styles.subtitle}>{formatDateShort(ride.date)}</Text>
              <View style={styles.statusChip}>
                <Text style={styles.statusChipText}>{formatStatusLabel(ride.status)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.routeStack}>
              <View style={styles.routeStackRow}>
                <View style={[styles.routeIcon, { backgroundColor: COLORS.success + '1A' }]}>
                  <MaterialIcons name="flag" size={22} color={COLORS.success} />
                </View>
                <View style={styles.routeTextWrap}>
                  <Text style={styles.routeStackLabel}>Start</Text>
                  <Text style={styles.routeStackValue} numberOfLines={1}>{ride.startLocation}</Text>
                </View>
              </View>

              <View style={styles.routeCenterRow}>
                <View style={styles.routeStackConnector} />
                <View style={styles.routeDistanceBadge}>
                  <MaterialIcons name="route" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.routeDistanceText}>{ride.totalDistance} km</Text>
                </View>
              </View>

              <View style={styles.routeStackRow}>
                <View style={[styles.routeIcon, { backgroundColor: COLORS.danger + '1A' }]}>
                  <MaterialIcons name="flag" size={22} color={COLORS.danger} />
                </View>
                <View style={styles.routeTextWrap}>
                  <Text style={styles.routeStackLabel}>Finish</Text>
                  <Text style={styles.routeStackValue} numberOfLines={1}>{ride.finishLocation}</Text>
                </View>
              </View>
            </View>

            {ride.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.sectionText}>{ride.description}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Timeline</Text>
              </View>

              <View style={styles.timelineRail}>
                <View style={styles.timelineNode}>
                  <View style={[styles.timelineIconBubble, { backgroundColor: COLORS.success + '1A' }]}>
                    <MaterialIcons name="flag" size={22} color={COLORS.success} />
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeaderRow}>
                      <Text style={styles.timelineStageTitle}>Flag Off</Text>
                      <Text style={styles.timelineStageMeta} numberOfLines={1}>{ride.startLocation}</Text>
                    </View>
                    <View style={styles.timelinePillRow}>
                      <View style={styles.timelinePill}>
                        <MaterialIcons
                          name={isFutureRide ? 'schedule' : 'play-arrow'}
                          size={12}
                          color={COLORS.primary}
                        />
                        <Text style={styles.timelinePillText}>{isFutureRide ? 'Planned' : 'Started'}</Text>
                        <Text style={styles.timelinePillTime}>{formatTimeOnly(rideStart)}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {pitStops.map((stage, index) => {
                  const tone = TIMELINE_TONES[index % TIMELINE_TONES.length];
                  const eta = getStageEta(rideStart, stage);

                  return (
                    <View key={stage.stageId} style={styles.timelineNode}>
                      <View style={[styles.timelineIconBubble, { backgroundColor: tone + '18' }]}>
                        <MaterialIcons name="directions-bike" size={16} color={tone} />
                      </View>
                      <View style={styles.timelineContent}>
                        <View style={styles.timelineHeaderRow}>
                          <View style={[styles.stageBadge, { backgroundColor: tone + '18' }]}>
                            <Text style={[styles.stageBadgeText, { color: tone }]}>{`PS${index + 1}`}</Text>
                          </View>
                          <Text style={styles.timelineStageMeta} numberOfLines={1}>{stage.name}</Text>
                        </View>

                        <View style={styles.stageMetricsRow}>
                          {stage.location ? (
                            <View style={styles.stageMetric}>
                              <MaterialIcons name="place" size={12} color={COLORS.textSecondary} />
                              <Text style={styles.stageMetricText}>{stage.location}</Text>
                            </View>
                          ) : null}
                          <View style={styles.stageMetric}>
                            <MaterialIcons name="straighten" size={12} color={COLORS.textSecondary} />
                            <Text style={styles.stageMetricText}>
                              {typeof stage.distanceFromStart === 'number' ? `${stage.distanceFromStart} km` : 'N/A'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.timelinePillRow}>
                          <View style={styles.timelinePill}>
                            <MaterialIcons name="schedule" size={12} color={COLORS.primary} />
                            <Text style={styles.timelinePillText}>ETA</Text>
                            <Text style={styles.timelinePillTime}>{formatTimeOnly(eta)}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}

                <View style={styles.timelineNode}>
                  <View style={[styles.timelineIconBubble, { backgroundColor: COLORS.danger + '1A' }]}>
                    <MaterialIcons name="flag" size={22} color={COLORS.danger} />
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeaderRow}>
                      <Text style={styles.timelineStageTitle}>Finish at</Text>
                      <Text style={styles.timelineStageMeta} numberOfLines={1}>{ride.finishLocation}</Text>
                    </View>
                    <View style={styles.timelinePillRow}>
                      <View style={styles.timelinePill}>
                        <MaterialIcons name="flag" size={12} color={COLORS.primary} />
                        <Text style={styles.timelinePillText}>{ride.completedAt ? 'Arrived' : 'Planned'}</Text>
                        <Text style={styles.timelinePillTime}>
                          {formatTimeOnly(ride.completedAt ?? plannedFinish)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <DocumentsSection tourId={tourId} rideId={rideId} />

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
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    width: '100%',
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerMetaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statusChip: {
    backgroundColor: COLORS.primary + '1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  routeStack: {
    backgroundColor: COLORS.gray[100],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  routeStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeTextWrap: {
    flex: 1,
  },
  routeStackLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  routeStackValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  routeCenterRow: {
    marginLeft: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeStackConnector: {
    marginLeft: 13,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.gray[300],
    height: 10,
  },
  routeDistanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  routeDistanceText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  section: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  timelineRail: {
    gap: 7,
  },
  timelineNode: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  timelineIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  timelineContent: {
    flex: 1,
    gap: 5,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  timelineStageTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  timelineStageMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flexShrink: 1,
  },
  stageBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  stageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stageMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stageMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gray[100],
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  stageMetricText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  timelinePillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timelinePill: {
    flexGrow: 1,
    flexBasis: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  timelinePillText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  timelinePillTime: {
    marginLeft: 'auto',
    fontSize: 10,
    color: COLORS.textPrimary,
    fontWeight: '700',
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
