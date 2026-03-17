/**
 * Banner displayed at the top of the screen when the device is offline.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../../constants';
import { useOffline } from '../../context/OfflineContext';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OfflineBanner() {
  const { isOffline } = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>You are offline</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OfflineBanner;
