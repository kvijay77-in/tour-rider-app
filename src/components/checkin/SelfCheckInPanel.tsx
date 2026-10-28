import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { COLORS } from '../../constants';
import { useRider } from '../../hooks/useRider';
import { useTour } from '../../hooks/useTour';
import { cancelSelfCheckIn, getRiderRideCheckIns, submitSelfCheckIn } from '../../services/api/checkInApi';
import { getTodaysRide } from '../../services/api/rideApi';
import { CheckInStatus, deriveCheckInStatus, type CheckIn } from '../../types/checkin';
import { TourRiderStatus, TourStatus } from '../../types/tour';
import type { Ride } from '../../types/ride';
import {
  canCancelCheckIn,
  getAvailableSelfCheckInActions,
  getCheckInApiErrorMessage,
  getCheckInMethodLabel,
  type SelfCheckInAction,
} from '../../utils/checkInPresentation';
import { logger } from '../../utils/logger';

const TAG = 'SelfCheckInPanel';

interface Props {
  expectedTourId?: string;
  expectedRideId?: string;
  onRefresh?: () => void | Promise<void>;
}

type Confirmation =
  | { kind: 'stage'; stageNumber: number; stageName: string }
  | { kind: 'notRiding' }
  | { kind: 'quitRiding' }
  | { kind: 'cancel'; checkIn: CheckIn };

function getErrorMessage(code?: string, message?: string, fallback = 'Unable to complete this check-in. Please try again.') {
  return getCheckInApiErrorMessage(code) ?? message ?? fallback;
}

function isActiveEnrollment(status?: TourRiderStatus): boolean {
  return status === TourRiderStatus.REGISTERED || status === TourRiderStatus.ACTIVE;
}

export function SelfCheckInPanel({ expectedTourId, expectedRideId, onRefresh }: Props) {
  const { activeTour, enrollment } = useTour();
  const { profile } = useRider();
  const [ride, setRide] = useState<Ride | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const canLoad = Boolean(
    activeTour?.status === TourStatus.ACTIVE
      && enrollment
      && isActiveEnrollment(enrollment.status)
      && profile?.profileId
      && enrollment.profileId === profile.profileId
      && (!expectedTourId || expectedTourId === activeTour.tourId),
  );

  const loadCurrentRide = useCallback(async () => {
    setError(null);
    if (!canLoad || !activeTour || !enrollment) {
      setRide(null);
      setCheckIns([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const rideResponse = await getTodaysRide(activeTour.tourId);
      if (!rideResponse.success || !rideResponse.data) {
        if (rideResponse.error?.code !== 'HTTP_404' && rideResponse.error?.code !== 'NO_ACTIVE_RIDE') {
          setError(getErrorMessage(rideResponse.error?.code, rideResponse.error?.message, 'Unable to load today\'s ride.'));
        }
        setRide(null);
        setCheckIns([]);
        return;
      }

      const currentRide = rideResponse.data;
      const utcToday = new Date().toISOString().slice(0, 10);
      if (currentRide.date !== utcToday || (expectedRideId && currentRide.rideId !== expectedRideId)) {
        setRide(null);
        setCheckIns([]);
        return;
      }

      const checkInsResponse = await getRiderRideCheckIns(
        activeTour.tourId,
        enrollment.riderId,
        currentRide.rideNo,
      );
      if (!checkInsResponse.success || !checkInsResponse.data) {
        setRide(null);
        setCheckIns([]);
        setError(getErrorMessage(checkInsResponse.error?.code, checkInsResponse.error?.message, 'Unable to load today\'s check-in records.'));
        return;
      }

      setRide(currentRide);
      setCheckIns(checkInsResponse.data.checkIns);
    } catch (loadError) {
      logger.error(TAG, 'Unable to load current ride self-check-in state', loadError);
      setRide(null);
      setCheckIns([]);
      setError('Unable to load today\'s check-in status. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTour, canLoad, enrollment, expectedRideId]);

  useFocusEffect(useCallback(() => {
    void loadCurrentRide();
  }, [loadCurrentRide]));

  const availableActions = ride ? getAvailableSelfCheckInActions(ride, checkIns) : [];
  const stageActions: { stageNumber: number; stageName: string }[] = ride
    ? ride.stages.flatMap((stage) => {
      const stageAction: SelfCheckInAction | null = stage.type === 'START'
        ? 'START'
        : stage.type === 'PIT_STOP'
          ? 'PIT_STOP'
          : stage.type === 'FINISH'
            ? 'FINISH'
            : null;
      return stageAction && availableActions.includes(stageAction)
        ? [{ stageNumber: stage.stageNumber, stageName: stage.name }]
        : [];
    })
    : [];

  const runMutation = async (request: () => Promise<{ success: boolean; error?: { code?: string; message: string } }>) => {
    setIsSubmitting(true);
    setConfirmation(null);
    let mutationError: string | null = null;
    try {
      const response = await request();
      if (!response.success) {
        mutationError = getErrorMessage(response.error?.code, response.error?.message);
      }
    } catch (mutationException) {
      logger.error(TAG, 'Self check-in request failed', mutationException);
      mutationError = 'Unable to complete this check-in. Check your connection and try again.';
    }

    await loadCurrentRide();
    try {
      await onRefresh?.();
    } catch (refreshError) {
      logger.warn(TAG, 'Unable to refresh the check-in timeline', refreshError);
    }
    if (mutationError) setError(mutationError);
    setIsSubmitting(false);
  };

  const confirmAction = () => {
    if (!confirmation || !ride || !activeTour) return;
    if (confirmation.kind === 'stage') {
      void runMutation(() => submitSelfCheckIn(activeTour.tourId, ride.rideId, {
        stageNumber: confirmation.stageNumber,
      }));
    } else if (confirmation.kind === 'notRiding') {
      void runMutation(() => submitSelfCheckIn(activeTour.tourId, ride.rideId, { isNotRiding: true }));
    } else if (confirmation.kind === 'quitRiding') {
      void runMutation(() => submitSelfCheckIn(activeTour.tourId, ride.rideId, { isQuitRiding: true }));
    } else {
      void runMutation(() => cancelSelfCheckIn(activeTour.tourId, ride.rideId, confirmation.checkIn.checkInId));
    }
  };

  if (!canLoad || (!isLoading && !ride && !error)) return null;

  const quitRecord = checkIns.find((checkIn) => checkIn.isQuitRiding);
  const getRecordTitle = (checkIn: CheckIn) => {
    if (checkIn.isNotRiding) return 'Not Riding';
    if (checkIn.isQuitRiding) return 'Quit Riding';
    return ride?.stages.find((stage) => stage.stageNumber === checkIn.stageNumber)?.name
      ?? `Stage ${checkIn.stageNumber}`;
  };

  return (
    <View style={styles.panel}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Today&apos;s ride check-in</Text>
        {isLoading ? <ActivityIndicator color={COLORS.primary} accessibilityLabel="Refreshing today's ride" /> : null}
      </View>

      {error ? (
        <View>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void loadCurrentRide()} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {ride && !isLoading ? (
        <>
          <Text style={styles.rideTitle}>{ride.name}</Text>
          {quitRecord ? (
            <View style={styles.quitBanner} accessibilityRole="alert">
              <Text style={styles.quitBannerText}>You have quit this ride.</Text>
            </View>
          ) : null}

          {stageActions.map((stage) => (
            <Pressable
              key={stage.stageNumber}
              accessibilityRole="button"
              accessibilityLabel={`Check in at ${stage.stageName}`}
              disabled={isSubmitting}
              onPress={() => setConfirmation({ kind: 'stage', ...stage })}
              style={({ pressed }) => [styles.actionButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.actionLabel}>Check in at {stage.stageName}</Text>
            </Pressable>
          ))}

          {availableActions.includes('NOT_RIDING') ? (
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => setConfirmation({ kind: 'notRiding' })}
              style={({ pressed }) => [styles.actionButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.actionLabel}>Not Riding</Text>
            </Pressable>
          ) : null}

          {availableActions.includes('QUIT_RIDING') ? (
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => setConfirmation({ kind: 'quitRiding' })}
              style={({ pressed }) => [styles.quitButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.quitButtonLabel}>Quit Riding</Text>
            </Pressable>
          ) : null}

          {checkIns.map((checkIn) => {
            const title = getRecordTitle(checkIn);
            const status = deriveCheckInStatus(checkIn);
            const canCancel = Boolean(profile?.profileId && canCancelCheckIn(checkIn, profile.profileId, ride));
            return (
              <View key={checkIn.checkInId} style={styles.recordRow}>
                <View style={styles.recordDetails}>
                  <Text style={styles.recordTitle}>{title}</Text>
                  <Text style={styles.recordStatus}>
                    {status === CheckInStatus.NOT_RIDING ? 'Not Riding' : status === CheckInStatus.QUIT_RIDING ? 'Quit Riding' : 'Checked in'}
                    {getCheckInMethodLabel(checkIn.method) ? ` · ${getCheckInMethodLabel(checkIn.method)}` : ''}
                  </Text>
                </View>
                {checkIn.isQuitRiding ? (
                  <Text style={styles.organizerText}>Contact the organisers to resume riding</Text>
                ) : canCancel ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel ${title} check-in`}
                    disabled={isSubmitting}
                    onPress={() => setConfirmation({ kind: 'cancel', checkIn })}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelLabel}>Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}

      <Modal
        visible={Boolean(confirmation)}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmation(null)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View
              style={styles.dialog}
              accessibilityViewIsModal
              accessibilityLabel="Confirm check-in action"
            >
              <Text style={styles.dialogTitle}>
                {confirmation?.kind === 'cancel'
                  ? 'Cancel check-in?'
                  : confirmation?.kind === 'quitRiding'
                    ? 'Confirm Quit Riding'
                    : confirmation?.kind === 'notRiding'
                      ? 'Confirm Not Riding'
                      : 'Confirm check-in'}
              </Text>
              <Text style={styles.dialogBody}>
                {confirmation?.kind === 'cancel'
                  ? `Cancel your ${getRecordTitle(confirmation.checkIn)} check-in? You can check in again while it is allowed.`
                  : confirmation?.kind === 'stage'
                    ? `Record your check-in at ${confirmation.stageName}?`
                    : confirmation?.kind === 'notRiding'
                      ? 'Record that you are not riding today?'
                      : confirmation?.kind === 'quitRiding'
                        ? 'Record that you are stopping this ride?'
                        : ''}
              </Text>
              {confirmation?.kind === 'quitRiding' ? (
                <View style={styles.safetyNotice}>
                  <Text style={styles.safetyTitle}>Organisers&apos; advice</Text>
                  <Text style={styles.safetyText}>
                    Wherever possible, quit at a Pit Stop so the team can record it for you and arrange safe transport for you and your bike. If you must quit on the road, contact the organisers immediately after confirming.
                  </Text>
                  <Text style={styles.safetyWarning}>This cannot be undone from the app.</Text>
                  <Text style={styles.safetyText}>Only the organisers can cancel a Quit Riding check-in, after making sure you are safe to continue.</Text>
                </View>
              ) : null}
              <View style={styles.dialogActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={() => setConfirmation(null)}
                  style={styles.dialogSecondary}
                >
                  <Text style={styles.dialogSecondaryLabel}>Keep</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={confirmAction}
                  style={styles.dialogPrimary}
                >
                  <Text style={styles.dialogPrimaryLabel}>{confirmation?.kind === 'cancel' ? 'Cancel check-in' : 'Confirm'}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  rideTitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  actionButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  actionLabel: { color: COLORS.white, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  quitButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.danger,
  },
  quitButtonLabel: { color: COLORS.white, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.75 },
  quitBanner: { backgroundColor: COLORS.warning, borderRadius: 6, padding: 10 },
  quitBannerText: { color: COLORS.textPrimary, fontWeight: '700', textAlign: 'center' },
  recordRow: {
    borderTopColor: COLORS.borderLight,
    borderTopWidth: 1,
    paddingTop: 8,
    gap: 6,
  },
  recordDetails: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  recordTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  recordStatus: { color: COLORS.textSecondary, fontSize: 13 },
  cancelButton: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: 10 },
  cancelLabel: { color: COLORS.primary, fontWeight: '700' },
  organizerText: { color: COLORS.textSecondary, fontSize: 13 },
  errorText: { color: COLORS.danger, fontSize: 13 },
  textButton: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 4 },
  textButtonLabel: { color: COLORS.primary, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    padding: 20,
  },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center' },
  dialog: {
    maxHeight: '90%',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 18,
    gap: 12,
  },
  dialogTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  dialogBody: { color: COLORS.textPrimary, fontSize: 15, lineHeight: 21 },
  safetyNotice: { backgroundColor: COLORS.warning, borderRadius: 6, padding: 12, gap: 8 },
  safetyTitle: { color: COLORS.textPrimary, fontWeight: '800' },
  safetyText: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 19 },
  safetyWarning: { color: COLORS.danger, fontWeight: '800', fontSize: 14 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  dialogSecondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  dialogSecondaryLabel: { color: COLORS.textSecondary, fontWeight: '600' },
  dialogPrimary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 6, backgroundColor: COLORS.primary },
  dialogPrimaryLabel: { color: COLORS.white, fontWeight: '700' },
});