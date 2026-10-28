import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../constants';
import { getEventActivityActions, getEventActivityStatus } from '../../utils/eventPresentation';
import type {
  EventActivity,
  EventDefinition,
  EventOccurrence,
  EventProgressItem,
} from '../../types/event';

type Props = {
  event: EventDefinition;
  occurrence: EventOccurrence;
  registered: boolean;
  progress: EventProgressItem[];
  selfServiceByActivity: Record<string, boolean>;
  busy: boolean;
  onRegister: () => void;
  onUnregister: () => void;
  onRecord: (activity: EventActivity, outcome: 'COMPLETED' | 'OPTED_OUT', variantSelected?: string) => void;
  onCancel: (recordId: string) => void;
};

function optionValue(option: string | { value: string }): string {
  return typeof option === 'string' ? option : option.value;
}

function optionLabel(option: string | { value: string; label?: string }): string {
  return typeof option === 'string' ? option : option.label ?? option.value;
}

function formatOccurrenceDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function EventOccurrenceCard({
  event,
  occurrence,
  registered,
  progress,
  selfServiceByActivity,
  busy,
  onRegister,
  onUnregister,
  onRecord,
  onCancel,
}: Props) {
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const occurrenceProgress = progress.filter((item) => item.occurrenceId === occurrence.occurrenceId);
  const canParticipate = occurrence.status === 'ACTIVE'
    && (!event.registrationEnabled || registered);
  const showProgress = canParticipate
    || (occurrence.status !== 'ACTIVE' && (!event.registrationEnabled || registered));

  return (
    <View style={styles.card}>
      <View style={styles.occurrenceHeader}>
        <View>
          <Text style={styles.occurrenceDate}>{formatOccurrenceDate(occurrence.date)}</Text>
          <Text style={styles.occurrenceNumber}>Occurrence {occurrence.seq}</Text>
        </View>
        <Text style={[styles.status, occurrence.status === 'ACTIVE' ? styles.activeStatus : null]}>
          {occurrence.status}
        </Text>
      </View>

      {event.registrationEnabled ? (
        <View style={styles.registrationRow}>
          <Text style={styles.registrationStatus}>{registered ? 'Registered' : 'Not registered'}</Text>
          {occurrence.status === 'PLANNED' ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={registered ? onUnregister : onRegister}
              style={[styles.smallButton, busy ? styles.disabled : null]}
            >
              <Text style={styles.smallButtonText}>{registered ? 'Un-register' : 'Register'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text style={styles.allParticipate}>All tour riders participate</Text>
      )}

      {showProgress ? (
        <View style={styles.activities}>
          <Text style={styles.sectionTitle}>Activities</Text>
          {[...event.activities]
            .sort((left, right) => left.sequenceNo - right.sequenceNo)
            .map((activity) => {
              const record = occurrenceProgress.find((item) => item.activityId === activity.activityId);
              const actions = getEventActivityActions({
                activity,
                occurrenceStatus: occurrence.status,
                registrationEnabled: event.registrationEnabled,
                registered,
                selfServiceAllowed: selfServiceByActivity[activity.activityId] === true,
                record,
              });
              const options = activity.variantOptions ?? [];
              const selectionRequired = options.length > 0;
              const selectedVariant = selectedVariants[activity.activityId];

              return (
                <View key={activity.activityId} style={styles.activityRow}>
                  <View style={styles.activityHeading}>
                    <Text style={styles.activityName}>
                      {activity.sequenceNo}. {activity.name}{activity.mandatory ? ' *' : ''}
                    </Text>
                    <Text style={styles.activityStatus}>{getEventActivityStatus(record)}</Text>
                  </View>
                  {record?.method === 'SELF_SERVICE' ? <Text style={styles.selfLabel}>Self</Text> : null}
                  {activity.enabled === false ? <Text style={styles.muted}>Unavailable</Text> : null}
                  {selectionRequired && actions.canMarkComplete ? (
                    <View style={styles.optionGroup} accessibilityRole="radiogroup">
                      {options.map((option) => {
                        const value = optionValue(option);
                        const selected = selectedVariant === value;
                        return (
                          <Pressable
                            key={value}
                            accessibilityRole="radio"
                            accessibilityLabel={optionLabel(option)}
                            accessibilityState={{ checked: selected }}
                            onPress={() => setSelectedVariants((current) => ({ ...current, [activity.activityId]: value }))}
                            style={styles.option}
                          >
                            <View style={[styles.radio, selected ? styles.radioSelected : null]} />
                            <Text style={styles.optionLabel}>{optionLabel(option)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                  {activity.enabled !== false && (actions.canMarkComplete || actions.canOptOut || actions.canCancel) ? (
                    <View style={styles.actions}>
                      {actions.canMarkComplete ? (
                        <Pressable
                          testID={`event-complete-${activity.activityId}`}
                          accessibilityRole="button"
                          accessibilityLabel="Mark complete"
                          disabled={busy || (selectionRequired && !selectedVariant)}
                          accessibilityState={{ disabled: busy || (selectionRequired && !selectedVariant) }}
                          onPress={() => onRecord(activity, 'COMPLETED', selectedVariant)}
                          style={[styles.actionButton, busy || (selectionRequired && !selectedVariant) ? styles.disabled : null]}
                        >
                          <Text style={styles.actionText}>Mark complete</Text>
                        </Pressable>
                      ) : null}
                      {actions.canOptOut ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Opt out"
                          disabled={busy}
                          accessibilityState={{ disabled: busy }}
                          onPress={() => onRecord(activity, 'OPTED_OUT')}
                          style={[styles.secondaryButton, busy ? styles.disabled : null]}
                        >
                          <Text style={styles.secondaryText}>Opt out</Text>
                        </Pressable>
                      ) : null}
                      {actions.canCancel && record?.recordId ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Cancel activity record"
                          disabled={busy}
                          accessibilityState={{ disabled: busy }}
                          onPress={() => onCancel(record.recordId as string)}
                          style={[styles.secondaryButton, busy ? styles.disabled : null]}
                        >
                          <Text style={styles.secondaryText}>Cancel</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  occurrenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  occurrenceDate: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  occurrenceNumber: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  status: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  activeStatus: { color: COLORS.success },
  registrationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
  },
  registrationStatus: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  allParticipate: { color: COLORS.textSecondary, fontSize: 14, marginTop: 2 },
  smallButton: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.primary, borderRadius: 6 },
  smallButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  activities: { borderTopWidth: 1, borderTopColor: COLORS.borderLight, marginTop: 12, paddingTop: 12 },
  sectionTitle: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: 4 },
  activityRow: { paddingVertical: 10, borderBottomColor: COLORS.borderLight, borderBottomWidth: 1 },
  activityHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  activityName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  activityStatus: { color: COLORS.textSecondary, fontSize: 13 },
  selfLabel: { alignSelf: 'flex-start', color: COLORS.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
  muted: { color: COLORS.textDisabled, fontSize: 12, marginTop: 4 },
  optionGroup: { marginTop: 8, gap: 8 },
  option: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 9 },
  radio: { width: 18, height: 18, borderWidth: 1, borderColor: COLORS.gray[500], borderRadius: 9 },
  radioSelected: { borderWidth: 5, borderColor: COLORS.primary },
  optionLabel: { color: COLORS.textPrimary, fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actionButton: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  actionText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  secondaryButton: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border },
  secondaryText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});