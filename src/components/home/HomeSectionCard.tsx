/**
 * Reusable home section card with image background.
 */

import React from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { Card } from '../common/Card';
import { COLORS } from '../../constants';

export interface HomeSectionCardProps {
  title: string;
  subtitle?: string;
  imageSource?: ImageSourcePropType;
  onImageError?: () => void;
  imageError?: string;
  onRetry?: () => void;
  onPress: () => void;
}

function HomeSectionCardInner({
  title,
  subtitle,
  imageSource,
  onImageError,
  imageError,
  onRetry,
  onPress,
}: HomeSectionCardProps) {
  return (
    <View style={styles.touchable}>
      <TouchableOpacity
        style={styles.touchable}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Card style={styles.card}>
          <ImageBackground source={imageSource} onError={onImageError} style={styles.image} resizeMode="cover">
            <View style={styles.overlay}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
            </View>
          </ImageBackground>
        </Card>
      </TouchableOpacity>
      {imageError ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${title} image`} onPress={onRetry}>
          <Text style={styles.errorText}>Image unavailable. Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const HomeSectionCard = React.memo(HomeSectionCardInner);

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
  },
  card: {
    flex: 1,
    padding: 0,
    overflow: 'hidden',
  },
  image: {
    flex: 1,
    backgroundColor: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.primary,
    paddingVertical: 6,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  title: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.white,
    marginTop: 2,
  },
});

export default HomeSectionCard;
