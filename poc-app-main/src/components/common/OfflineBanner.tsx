/**
 * OfflineBanner — displays a status bar when the device has no connectivity.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useOffline } from '../../context/OfflineContext';

export function OfflineBanner() {
  const { isOffline } = useOffline();

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <MaterialIcons name="wifi-off" size={16} color="#fff" style={styles.icon} />
      <Text style={styles.text}>You are offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#555',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
