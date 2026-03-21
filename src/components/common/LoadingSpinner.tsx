/**
 * Centered loading indicator with optional message text.
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import { COLORS } from '../../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoadingSpinnerProps {
  /** Spinner size */
  size?: 'small' | 'large';
  /** Optional message displayed below the spinner */
  message?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoadingSpinner({ size = 'large', message }: LoadingSpinnerProps) {
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size={size} color={COLORS.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default LoadingSpinner;
