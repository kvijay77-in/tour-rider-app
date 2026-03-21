/**
 * Tour information banner — shows tour name, current day progress, and status.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../../constants';
import { StatusBadge } from '../common/StatusBadge';
import type { Tour } from '../../types';
import { TourStatus } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TourInfoBannerProps {
  /** Active tour data */
  tour: Tour;
  /** Current day number (1-based) */
  currentDay: number;
  /** Total days in the tour */
  totalDays: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLOR_MAP: Record<TourStatus, string> = {
  [TourStatus.PLANNING]: COLORS.gray[400],
  [TourStatus.PROVISIONING]: COLORS.info,
  [TourStatus.ACTIVE]: COLORS.success,
  [TourStatus.COMPLETED]: COLORS.secondary,
  [TourStatus.ARCHIVED]: COLORS.gray[500],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TourInfoBanner({ tour, currentDay, totalDays }: TourInfoBannerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.tourName} numberOfLines={1}>
          {tour.name}
        </Text>
        <StatusBadge status={tour.status} color={STATUS_COLOR_MAP[tour.status]} />
      </View>

      <Text style={styles.dayProgress}>
        Day {currentDay} of {totalDays}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tourName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    flex: 1,
    marginRight: 8,
  },
  dayProgress: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.9,
  },
});

export default TourInfoBanner;
