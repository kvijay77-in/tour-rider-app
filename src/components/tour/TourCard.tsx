/**
 * Tour summary card — displays key tour information.
 */

import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';

import { COLORS } from '../../constants';
import { Card } from '../common/Card';
import { StatusBadge } from '../common/StatusBadge';
import { formatDate } from '../../utils/dateFormatter';
import type { Tour } from '../../types';
import { TourStatus } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TourCardProps {
  /** Tour data to display */
  tour: Tour;
  /** Handler invoked when the card is pressed */
  onPress: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE_MAP: Record<TourStatus, { label: string; color: string }> = {
  [TourStatus.PLANNING]: { label: 'Planning', color: COLORS.gray[400] },
  [TourStatus.PROVISIONING]: { label: 'Provisioning', color: COLORS.info },
  [TourStatus.ACTIVE]: { label: 'Active', color: COLORS.success },
  [TourStatus.COMPLETED]: { label: 'Completed', color: COLORS.secondary },
  [TourStatus.ARCHIVED]: { label: 'Archived', color: COLORS.gray[500] },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TourCard({ tour, onPress }: TourCardProps) {
  const badge = STATUS_BADGE_MAP[tour.status];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {tour.name}
          </Text>
          <StatusBadge status={badge.label} color={badge.color} />
        </View>

        <Text style={styles.dates}>
          {formatDate(tour.startDate)} – {formatDate(tour.endDate)}
        </Text>

        {tour.location ? (
          <Text style={styles.location} numberOfLines={1}>
            {tour.location}
          </Text>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  dates: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default TourCard;
