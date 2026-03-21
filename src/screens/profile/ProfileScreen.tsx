/**
 * Profile screen — view/edit rider profile and sign out.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Button } from '../../components/common/Button';
import { ProfilePicture } from '../../components/profile/ProfilePicture';
import { useAuth } from '../../hooks/useAuth';
import { useRider } from '../../hooks/useRider';
import { logger } from '../../utils/logger';

const TAG = 'ProfileScreen';

export function ProfileScreen() {
  const { logout, isAuthenticating } = useAuth();
  const { profile, isLoading, error, updateProfile, refreshProfile } = useRider();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [emergencyName, setEmergencyName] = useState(profile?.emergencyContactName ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergencyContactPhone ?? '');

  const handleEdit = useCallback(() => {
    // Sync local state with current profile before editing
    setFirstName(profile?.firstName ?? '');
    setLastName(profile?.lastName ?? '');
    setPhone(profile?.phone ?? '');
    setAddress(profile?.address ?? '');
    setEmergencyName(profile?.emergencyContactName ?? '');
    setEmergencyPhone(profile?.emergencyContactPhone ?? '');
    setIsEditing(true);
  }, [profile]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
      });
      setIsEditing(false);
      logger.info(TAG, 'Profile updated');
    } catch (err) {
      logger.error(TAG, 'Error updating profile', err);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [firstName, lastName, phone, address, emergencyName, emergencyPhone, updateProfile]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      logger.info(TAG, 'User logged out');
    } catch (err) {
      logger.error(TAG, 'Error logging out', err);
    }
  }, [logout]);

  if (isLoading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="Loading profile..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <ProfilePicture
              photoUrl={profile?.photoUrl}
              size={96}
            />
            {profile ? (
              <Text style={styles.name}>
                {profile.firstName} {profile.lastName}
              </Text>
            ) : null}
            {profile?.email ? (
              <Text style={styles.email}>{profile.email}</Text>
            ) : null}
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!profile ? (
            <View style={styles.centered}>
              <Text style={styles.infoText}>Profile not available.</Text>
              <Button title="Retry" onPress={refreshProfile} variant="secondary" />
            </View>
          ) : isEditing ? (
            <View style={styles.form}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholderTextColor={COLORS.textDisabled}
                editable={!isSaving}
                accessibilityLabel="First name"
              />

              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholderTextColor={COLORS.textDisabled}
                editable={!isSaving}
                accessibilityLabel="Last name"
              />

              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="phone-pad"
                editable={!isSaving}
                accessibilityLabel="Phone number"
              />

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Address"
                placeholderTextColor={COLORS.textDisabled}
                editable={!isSaving}
                accessibilityLabel="Address"
              />

              <Text style={styles.label}>Emergency Contact Name</Text>
              <TextInput
                style={styles.input}
                value={emergencyName}
                onChangeText={setEmergencyName}
                placeholder="Emergency contact name"
                placeholderTextColor={COLORS.textDisabled}
                editable={!isSaving}
                accessibilityLabel="Emergency contact name"
              />

              <Text style={styles.label}>Emergency Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                placeholder="Emergency contact phone"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="phone-pad"
                editable={!isSaving}
                accessibilityLabel="Emergency contact phone"
              />

              <View style={styles.buttonRow}>
                <View style={styles.buttonHalf}>
                  <Button
                    title="Cancel"
                    onPress={handleCancel}
                    variant="secondary"
                    disabled={isSaving}
                  />
                </View>
                <View style={styles.buttonHalf}>
                  <Button
                    title="Save"
                    onPress={handleSave}
                    loading={isSaving}
                    disabled={isSaving}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.profileSection}>
              <ProfileRow label="Email" value={profile.email} />
              <ProfileRow label="Phone" value={profile.phone ?? '—'} />
              <ProfileRow label="Address" value={profile.address ?? '—'} />
              <ProfileRow label="Emergency Contact" value={profile.emergencyContactName ?? '—'} />
              <ProfileRow label="Emergency Phone" value={profile.emergencyContactPhone ?? '—'} />

              <View style={styles.editButtonContainer}>
                <Button title="Edit Profile" onPress={handleEdit} variant="secondary" />
              </View>
            </View>
          )}

          <View style={styles.logoutContainer}>
            <Button
              title="Sign Out"
              onPress={handleLogout}
              variant="danger"
              loading={isAuthenticating}
              disabled={isAuthenticating || isSaving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Profile row helper
// ---------------------------------------------------------------------------

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  email: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorContainer: {
    backgroundColor: COLORS.danger,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.white,
    fontSize: 14,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  profileSection: {
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  profileValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  editButtonContainer: {
    marginTop: 16,
  },
  form: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonHalf: {
    flex: 1,
  },
  logoutContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

export default ProfileScreen;
