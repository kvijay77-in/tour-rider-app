import React from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS } from '../../constants';
import { evaluateVisibleWhen, getAttributeDisplayValue, getAttributeValue, type ProfileDefinitions } from '../../profile-schema';
import { getProfileAttributeDownloadUrl } from '../../services/api/riderApi';
import { logger } from '../../utils/logger';
import type { RiderProfile } from '../../types/rider';

interface DynamicProfileViewProps {
  definitions: ProfileDefinitions;
  profile: RiderProfile;
  excludedKeys?: string[];
}

const TAG = 'DynamicProfileView';

function ProfileRow({
  label,
  value,
  actionLabel,
  onActionPress,
}: {
  label: string;
  value: string;
  actionLabel?: string;
  onActionPress?: () => void | Promise<void>;
}) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <View style={styles.profileValueContainer}>
        <Text style={styles.profileValue}>{value}</Text>
        {actionLabel && onActionPress ? (
          <TouchableOpacity
            onPress={() => void onActionPress()}
            style={styles.profileActionButton}
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel} ${label}`}
          >
            <Text style={styles.profileActionText}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function DynamicProfileView({ definitions, profile, excludedKeys = [] }: DynamicProfileViewProps) {
  const values = Object.fromEntries(definitions.orderedAttributes.map((attribute) => [attribute.key, getAttributeValue(profile, attribute)]));

  return (
    <View style={styles.profileSection}>
      {definitions.sections.map((section) => {
        const visibleAttributes = section.attributes.filter((attribute) => {
          if (excludedKeys.includes(attribute.key)) {
            return false;
          }

          return evaluateVisibleWhen(attribute.visibleWhen, values);
        });

        if (visibleAttributes.length === 0) {
          return null;
        }

        return (
          <View key={section.id}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <MaterialIcons name={(section.icon as keyof typeof MaterialIcons.glyphMap) ?? 'article'} size={19} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>{section.label}</Text>
            </View>
            {visibleAttributes.map((attribute) => (
              <ProfileRow
                key={attribute.key}
                label={attribute.label}
                value={getAttributeDisplayValue(attribute, values[attribute.key], definitions)}
                actionLabel={(attribute.type === 'FILE' || attribute.type === 'IMAGE') && values[attribute.key] ? 'View' : undefined}
                onActionPress={(attribute.type === 'FILE' || attribute.type === 'IMAGE') && values[attribute.key]
                  ? async () => {
                    try {
                      const response = await getProfileAttributeDownloadUrl(profile.profileId, attribute.key);
                      if (!response.success || !response.data?.downloadUrl) {
                        throw new Error(response.error?.message ?? 'Unable to open uploaded file.');
                      }

                      await Linking.openURL(response.data.downloadUrl);
                    } catch (error) {
                      logger.warn(TAG, 'Unable to open profile attribute file', error);
                      Alert.alert('Unable to open file', error instanceof Error ? error.message : 'Please try again.');
                    }
                  }
                  : undefined}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  profileSection: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 4,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  profileLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, flex: 1 },
  profileValueContainer: { flex: 1.4, alignItems: 'flex-end', gap: 6 },
  profileValue: { fontSize: 14, lineHeight: 20, color: COLORS.textPrimary, textAlign: 'right' },
  profileActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.gray[100],
  },
  profileActionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});

export default DynamicProfileView;
