/**
 * Persistent "TEST" strip shown above every screen in the Test app variant.
 *
 * Wraps the app content. In the Test variant it renders a high-contrast strip
 * in the top safe area and a nested SafeAreaProvider so screens below measure
 * their insets from under the strip. In Production (including store-reviewer
 * sessions) it renders the children unchanged.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { isTestVariant } from '../../config/appVariant';

interface TestVariantBannerProps {
  children: React.ReactNode;
}

function TestStrip() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.strip, { paddingTop: insets.top }]}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Test app. Data here is test data, not the live tour."
    >
      <Text style={styles.text}>TEST</Text>
    </View>
  );
}

export function TestVariantBanner({ children }: TestVariantBannerProps) {
  if (!isTestVariant()) {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      <TestStrip />
      <SafeAreaProvider style={styles.content}>{children}</SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  strip: {
    backgroundColor: COLORS.warning,
    alignItems: 'center',
  },
  text: {
    color: COLORS.black,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    paddingVertical: 2,
  },
  content: {
    flex: 1,
  },
});

export default TestVariantBanner;
