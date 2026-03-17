/**
 * Visual stage progress indicator — horizontal line with colour-coded stage dots.
 *
 * Colours:
 *  - Green  = checked in
 *  - Gray   = not checked in
 *  - Orange = current (next expected stage)
 *  - Red    = quit riding
 *  - Blue   = not riding
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS, CHECK_IN_STATUS_COLORS } from '../../constants';
import type { Stage, CheckIn } from '../../types';
import { CheckInStatus } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StageIndicatorProps {
  /** Ordered list of stages for the ride */
  stages: Stage[];
  /** Check-in records for the rider on this ride */
  checkIns: CheckIn[];
  /** Overall check-in status for the rider */
  checkInStatus: CheckInStatus;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a resolved per-stage status to a dot colour. */
function getDotColor(stageStatus: 'checked' | 'current' | 'upcoming', overallStatus: CheckInStatus): string {
  if (overallStatus === CheckInStatus.QUIT_RIDING) return CHECK_IN_STATUS_COLORS.quitRiding;
  if (overallStatus === CheckInStatus.NOT_RIDING) return CHECK_IN_STATUS_COLORS.notRiding;

  switch (stageStatus) {
    case 'checked':
      return CHECK_IN_STATUS_COLORS.checkedIn;
    case 'current':
      return COLORS.accent;
    case 'upcoming':
    default:
      return CHECK_IN_STATUS_COLORS.notCheckedIn;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StageIndicator({ stages, checkIns, checkInStatus }: StageIndicatorProps) {
  const checkedStageIds = new Set(checkIns.map((c) => c.stageId));

  // Determine per-stage visual status
  let foundCurrent = false;
  const stageStatuses = stages.map((stage) => {
    if (checkedStageIds.has(stage.stageId)) return 'checked' as const;
    if (!foundCurrent) {
      foundCurrent = true;
      return 'current' as const;
    }
    return 'upcoming' as const;
  });

  return (
    <View style={styles.container} accessibilityRole="progressbar">
      {stages.map((stage, index) => {
        const status = stageStatuses[index];
        const dotColor = getDotColor(status, checkInStatus);
        const isLast = index === stages.length - 1;

        return (
          <View key={stage.stageId} style={styles.stageItem}>
            <View style={styles.dotRow}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: status === 'checked' ? CHECK_IN_STATUS_COLORS.checkedIn : COLORS.gray[200] },
                  ]}
                />
              )}
            </View>
            <Text style={styles.stageLabel} numberOfLines={1}>
              {stage.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  stageItem: {
    flex: 1,
    alignItems: 'center',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  line: {
    flex: 1,
    height: 3,
  },
  stageLabel: {
    marginTop: 4,
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default StageIndicator;
