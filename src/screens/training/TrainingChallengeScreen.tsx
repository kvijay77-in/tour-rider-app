/**
 * Training challenge placeholder screen.
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { Card } from '../../components/common/Card';

export function TrainingChallengeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Card style={styles.card}>
          <Image
            source={require('../../../assets/TC_2026.jpg')}
            resizeMode="cover"
            style={styles.image}
          />
          <Text style={styles.title}>Training Challenge</Text>
          <Text style={styles.subtitle}>Coming soon....</Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  image: {
    width: '100%',
    height: 260,
    borderRadius: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default TrainingChallengeScreen;
