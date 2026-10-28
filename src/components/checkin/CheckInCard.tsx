/**
 * Check-in summary card — shows stage name, timestamp, and status.
 */

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

import { COLORS, CHECK_IN_STATUS_COLORS } from '../../constants';
import { Card } from '../common/Card';
import { StatusBadge } from '../common/StatusBadge';
import { formatDateTime } from '../../utils/dateFormatter';
import type { CheckIn } from '../../types';
import { deriveCheckInStatus, CheckInStatus } from '../../types';
import { getCheckInMethodLabel } from '../../utils/checkInPresentation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckInCardProps {
  /** Check-in record */
  checkIn: CheckIn;
  /** Human-readable stage name */
  stageName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_DISPLAY: Record<CheckInStatus, { label: string; color: string }> = {
  [CheckInStatus.CHECKED_IN]: { label: 'Checked In', color: CHECK_IN_STATUS_COLORS.checkedIn },
  [CheckInStatus.NOT_CHECKED_IN]: { label: 'Not Checked In', color: CHECK_IN_STATUS_COLORS.notCheckedIn },
  [CheckInStatus.NOT_RIDING]: { label: 'Not Riding', color: CHECK_IN_STATUS_COLORS.notRiding },
  [CheckInStatus.QUIT_RIDING]: { label: 'Quit Riding', color: CHECK_IN_STATUS_COLORS.quitRiding },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CheckInCardInner({ checkIn, stageName }: CheckInCardProps) {
  const status = deriveCheckInStatus(checkIn);
  const display = STATUS_DISPLAY[status];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.stageName} numberOfLines={1}>
          {stageName}
        </Text>
        <StatusBadge status={display.label} color={display.color} />
      </View>

      <Text style={styles.timestamp}>{formatDateTime(checkIn.timestamp)}</Text>

      {getCheckInMethodLabel(checkIn.method) ? (
        <Text style={styles.method}>{getCheckInMethodLabel(checkIn.method)}</Text>
      ) : null}

      {checkIn.notes ? (
        <Text style={styles.notes} numberOfLines={2}>
          {checkIn.notes}
        </Text>
      ) : null}
    </Card>
  );
}

export const CheckInCard = React.memo(CheckInCardInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stageName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  method: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  notes: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});

export default CheckInCard;

