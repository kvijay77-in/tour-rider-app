import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { COLORS } from '../../constants';

type Props = {
  title: string;
  showTitle?: boolean;
  source?: ImageSourcePropType;
  loading: boolean;
  error?: string;
  onError: () => void;
  onRetry: () => void;
};

export function TourArtifactImage({ title, showTitle = true, source, loading, error, onError, onRetry }: Props) {
  if (!source && !loading && !error) return null;

  return (
    <View style={styles.container}>
      {showTitle ? <Text style={styles.title}>{title}</Text> : null}
      {loading ? <ActivityIndicator accessibilityLabel={`Loading ${title}`} color={COLORS.primary} /> : null}
      {source ? (
        <Image accessibilityLabel={title} source={source} resizeMode="contain" style={styles.image} onError={onError} />
      ) : null}
      {error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${title}`} onPress={onRetry} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 8 },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  image: { width: '100%', aspectRatio: 4 / 3 },
  error: { color: COLORS.textSecondary, fontSize: 14 },
  retry: { alignSelf: 'flex-start', paddingVertical: 10 },
  retryText: { color: COLORS.primary, fontWeight: '600' },
});