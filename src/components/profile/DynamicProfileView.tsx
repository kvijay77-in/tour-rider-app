import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS } from '../../constants';
import { evaluateVisibleWhen, getAttributeDisplayValue, getAttributeValue, type ProfileDefinitions } from '../../profile-schema';
import type { RiderProfile } from '../../types/rider';

interface DynamicProfileViewProps {
  definitions: ProfileDefinitions;
  profile: RiderProfile;
  excludedKeys?: string[];
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
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
  profileValue: { fontSize: 14, lineHeight: 20, color: COLORS.textPrimary, flex: 1.4, textAlign: 'right' },
});

export default DynamicProfileView;
