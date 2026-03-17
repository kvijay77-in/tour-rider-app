/**
 * Small rounded pill badge for displaying a status label.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatusBadgeProps {
  /** Status text displayed inside the badge */
  status: string;
  /** Background colour of the badge */
  color: string;
  /** Text colour (defaults to white) */
  textColor?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatusBadge({ status, color, textColor = COLORS.white }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]} accessibilityRole="text">
      <Text style={[styles.text, { color: textColor }]}>{status}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default StatusBadge;
