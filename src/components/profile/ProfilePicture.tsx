/**
 * Profile picture with circular framing and placeholder avatar.
 */

import React from 'react';
import { TouchableOpacity, Image, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfilePictureProps {
  /** URL of the profile photo (shows placeholder when undefined/empty) */
  photoUrl?: string;
  /** Diameter of the circular image */
  size: number;
  /** Optional press handler (e.g. to change photo) */
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfilePicture({ photoUrl, size, onPress }: ProfilePictureProps) {
  const imageStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const content = photoUrl ? (
    <Image
      source={{ uri: photoUrl }}
      style={[styles.image, imageStyle]}
      accessibilityRole="image"
      accessibilityLabel="Profile picture"
    />
  ) : (
    <View style={[styles.placeholder, imageStyle]} accessibilityRole="image" accessibilityLabel="Default avatar">
      <Ionicons name="person-circle" size={size} color={COLORS.gray[300]} />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  image: {
    backgroundColor: COLORS.gray[100],
  },
  placeholder: {
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default ProfilePicture;
