/**
 * Home profile summary card.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '../../constants';
import { Card } from '../common/Card';
import { ProfilePicture } from '../profile/ProfilePicture';
import type { RiderProfile } from '../../types/rider';

export interface ProfileSummaryCardProps {
  profile: RiderProfile | null;
  onPress: () => void;
}

function ProfileSummaryCardInner({ profile, onPress }: ProfileSummaryCardProps) {
  const displayName = profile
    ? profile.name
    : 'Profile not available';

  return (
    <TouchableOpacity
      style={styles.touchable}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="View profile"
    >
      <Card style={styles.card}>
        <View style={styles.content}>
          <ProfilePicture photoUrl={profile?.photoUrl} size={72} />

          <View style={styles.textColumn}>
            <Text style={styles.title}>Your Profile</Text>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.detail} numberOfLines={1}>{profile?.email ?? 'No email available'}</Text>
            <Text style={styles.detail} numberOfLines={1}>{profile?.phone ?? 'No phone number added'}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export const ProfileSummaryCard = React.memo(ProfileSummaryCardInner);

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
  },
  card: {
    flex: 1,
    paddingVertical: 14,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  textColumn: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default ProfileSummaryCard;
