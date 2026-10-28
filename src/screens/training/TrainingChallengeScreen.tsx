/**
 * Training challenge placeholder screen.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { Card } from '../../components/common/Card';
import { TourArtifactImage } from '../../components/tour/TourArtifactImage';
import { useTour } from '../../hooks/useTour';
import { useTourArtifactImages } from '../../hooks/useTourArtifactImages';

export function TrainingChallengeScreen() {
  const { activeTour } = useTour();
  const tourImages = useTourArtifactImages(activeTour?.tourId);
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.card}>
          <TourArtifactImage
            title="Training Challenge"
            showTitle={false}
            source={tourImages.sources['training-challenge']}
            loading={tourImages.loading}
            error={tourImages.errors['training-challenge'] ?? tourImages.error}
            onError={() => void tourImages.onImageError('training-challenge')}
            onRetry={() => void tourImages.refresh()}
          />
          <Text style={styles.title}>Training Challenge</Text>
          <Text style={styles.subtitle}>Coming soon....</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    padding: 16,
  },
  card: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
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
