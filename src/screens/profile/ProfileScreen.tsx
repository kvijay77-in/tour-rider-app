/**
 * View/edit profile screen.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ProfileFormFields } from '../../components/profile/ProfileFormFields';
import { ProfilePicture } from '../../components/profile/ProfilePicture';
import { COLORS } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { useRider } from '../../hooks/useRider';
import { formatDate } from '../../utils/dateFormatter';
import { logger } from '../../utils/logger';
import {
  combinePhoneNumber,
  createProfileFormValues,
  validateProfileForm,
  type ProfileFormErrors,
  type ProfileFormField,
  type ProfileFormValues,
} from '../../utils/profileForm';
import type { RiderAddress, RiderEmergencyContact, UpdateRiderProfileRequest } from '../../types/rider';

const TAG = 'ProfileScreen';

function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function formatAddress(address?: RiderAddress): string {
  if (!address) return '—';
  const segments = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.country,
    address.postalCode,
  ].filter((segment): segment is string => Boolean(segment?.trim()));
  return segments.length ? segments.join(', ') : '—';
}

function buildProfileUpdatePayload(
  profile: NonNullable<ReturnType<typeof useRider>['profile']>,
  values: ProfileFormValues,
): UpdateRiderProfileRequest {
  const payload: UpdateRiderProfileRequest = {};
  const name = values.name.trim();
  const phone = combinePhoneNumber(values.phoneCallingCode, values.phoneNumber);
  const dateOfBirth = formatDateForApi(values.dateOfBirth as Date);
  const gender = values.gender ?? undefined;
  const address: RiderAddress = {
    line1: values.addressLine1.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    country: values.country,
    postalCode: values.postalCode.trim(),
  };
  const addressLine2 = values.addressLine2.trim();
  if (addressLine2) {
    address.line2 = addressLine2;
  }

  const emergencyContact: RiderEmergencyContact = {
    name: values.emergencyContactName.trim(),
    relation: values.emergencyContactRelationship.trim(),
    phone: combinePhoneNumber(values.emergencyPhoneCallingCode, values.emergencyContactPhone),
  };

  if (name !== profile.name) {
    payload.name = name;
  }

  if (phone !== (profile.phone ?? '')) {
    payload.phone = phone;
  }

  if (dateOfBirth !== (profile.dateOfBirth ?? '')) {
    payload.dateOfBirth = dateOfBirth;
  }

  if (gender !== profile.gender) {
    payload.gender = gender;
  }

  const currentAddress: RiderAddress = {
    line1: profile.address?.line1 ?? '',
    city: profile.address?.city ?? '',
    state: profile.address?.state ?? '',
    country: profile.address?.country ?? '',
    postalCode: profile.address?.postalCode ?? '',
  };
  if (profile.address?.line2?.trim()) {
    currentAddress.line2 = profile.address.line2.trim();
  }

  if (JSON.stringify(address) !== JSON.stringify(currentAddress)) {
    payload.address = address;
  }

  const currentEmergencyContact: RiderEmergencyContact = {
    name: profile.emergencyContact?.name ?? '',
    relation: profile.emergencyContact?.relation ?? '',
    phone: profile.emergencyContact?.phone ?? '',
  };

  if (JSON.stringify(emergencyContact) !== JSON.stringify(currentEmergencyContact)) {
    payload.emergencyContact = emergencyContact;
  }

  return payload;
}

export function ProfileScreen() {
  const { logout, isAuthenticating } = useAuth();
  const { profile, isLoading, error, updateProfile, uploadProfilePicture, refreshProfile } = useRider();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessageVisible, setSuccessMessageVisible] = useState(false);
  const [values, setValues] = useState<ProfileFormValues>(() => createProfileFormValues());
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoMimeType, setSelectedPhotoMimeType] = useState<string | undefined>();
  const [selectedPhotoBase64, setSelectedPhotoBase64] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<ProfileFormErrors>({});

  useEffect(() => {
    if (!successMessageVisible) return;
    const timer = setTimeout(() => setSuccessMessageVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [successMessageVisible]);

  const resetEditor = useCallback(() => {
    setValues(createProfileFormValues(profile));
    setSelectedPhotoUri(null);
    setSelectedPhotoMimeType(undefined);
    setSelectedPhotoBase64(null);
    setFormErrors({});
  }, [profile]);

  const handleFieldChange = <Key extends keyof ProfileFormValues>(
    field: Key,
    value: ProfileFormValues[Key],
    errorField?: ProfileFormField,
  ) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errorField) setFormErrors((previous) => ({ ...previous, [errorField]: undefined }));
  };

  const handlePickPhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Media library permission is required to select a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset?.uri) return;
      if (!asset.base64) {
        Alert.alert('Invalid photo', 'Unable to read image data. Please select another photo.');
        return;
      }

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Invalid photo', 'Profile picture must be 5MB or smaller.');
        return;
      }

      setSelectedPhotoUri(asset.uri);
      setSelectedPhotoMimeType(asset.mimeType ?? 'image/jpeg');
      setSelectedPhotoBase64(asset.base64);
      setFormErrors((previous) => ({ ...previous, photo: undefined }));
      logger.info(TAG, 'Profile photo selected for profile update');
    } catch (pickError) {
      logger.error(TAG, 'Error selecting profile photo', pickError);
      Alert.alert('Error', 'Unable to select photo. Please try again.');
    }
  }, []);

  const handleEdit = useCallback(() => {
    resetEditor();
    setIsEditing(true);
  }, [resetEditor]);

  const handleCancel = useCallback(() => {
    resetEditor();
    setIsEditing(false);
  }, [resetEditor]);

  const handleSave = useCallback(async () => {
    if (!profile) {
      return;
    }

    const hasPhoto = Boolean(selectedPhotoUri || profile?.photoUrl || profile?.photoS3Key);
    const errors = validateProfileForm(values, hasPhoto);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      const profileUpdates = buildProfileUpdatePayload(profile, values);
      const hasProfileUpdates = Object.keys(profileUpdates).length > 0;
      const hasPhotoUpdate = Boolean(selectedPhotoUri);

      if (!hasProfileUpdates && !hasPhotoUpdate) {
        logger.info(TAG, 'Profile save skipped because no changes were detected');
        setIsEditing(false);
        return;
      }

      if (hasProfileUpdates) {
        await updateProfile(profileUpdates);
      }

      if (hasPhotoUpdate) {
        await uploadProfilePicture(
          selectedPhotoUri,
          selectedPhotoMimeType,
          profile?.profileId,
          selectedPhotoBase64 ?? undefined,
        );
      }

      setIsEditing(false);
      setSuccessMessageVisible(true);
      logger.info(TAG, 'Profile updated');
    } catch (saveError) {
      logger.error(TAG, 'Error updating profile', saveError);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [
    profile,
    selectedPhotoBase64,
    selectedPhotoMimeType,
    selectedPhotoUri,
    updateProfile,
    uploadProfilePicture,
    values,
  ]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      logger.info(TAG, 'User logged out');
    } catch (logoutError) {
      logger.error(TAG, 'Error logging out', logoutError);
    }
  }, [logout]);

  const displayPhotoUrl = selectedPhotoUri ?? profile?.photoUrl;
  const formattedAddress = useMemo(() => formatAddress(profile?.address), [profile?.address]);

  if (isLoading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="Loading profile..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {successMessageVisible ? (
          <View style={styles.successBanner}>
            <MaterialIcons name="check-circle" size={19} color={COLORS.white} />
            <Text style={styles.successBannerText}>Profile updated successfully</Text>
          </View>
        ) : null}

        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.photoFrame, formErrors.photo ? styles.photoError : null]}
            onPress={isEditing ? handlePickPhoto : undefined}
            disabled={!isEditing || isSaving}
            accessibilityRole={isEditing ? 'button' : 'image'}
            accessibilityLabel={isEditing ? 'Change profile picture' : 'Profile picture'}
          >
            <ProfilePicture photoUrl={displayPhotoUrl} size={100} />
            {isEditing ? (
              <View style={styles.cameraBadge}>
                <MaterialIcons name="photo-camera" size={17} color={COLORS.white} />
              </View>
            ) : null}
          </TouchableOpacity>
          {isEditing ? <Text style={styles.photoHint}>Tap the photo to change it</Text> : null}
          {isEditing && formErrors.photo ? <Text style={styles.photoErrorText}>Profile picture is required.</Text> : null}
          {profile && !isEditing ? (
            <>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.email}>{profile.email}</Text>
            </>
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
          <>
            <ProfileFormFields
              email={profile.email}
              values={values}
              errors={formErrors}
              disabled={isSaving}
              onChange={handleFieldChange}
            />
            <View style={styles.buttonRow}>
              <View style={styles.buttonHalf}>
                <Button title="Cancel" onPress={handleCancel} variant="secondary" disabled={isSaving} />
              </View>
              <View style={styles.buttonHalf}>
                <Button title="Save Profile" onPress={handleSave} loading={isSaving} disabled={isSaving} />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.profileSection}>
            <ProfileRow label="Personal Code" value={profile.personalCode ?? 'Not assigned'} />
            <ProfileRow label="Email" value={profile.email} />
            <ProfileRow label="Phone" value={profile.phone ?? '—'} />
            <ProfileRow label="Date of Birth" value={profile.dateOfBirth ? formatDate(profile.dateOfBirth) : '—'} />
            <ProfileRow label="Gender" value={profile.gender ?? '—'} />
            <ProfileRow label="Address" value={formattedAddress} />
            <View style={styles.subheadingRow}>
              <MaterialIcons name="contact-phone" size={19} color={COLORS.primary} />
              <Text style={styles.subheading}>Emergency contact</Text>
            </View>
            <ProfileRow label="Name" value={profile.emergencyContact?.name ?? '—'} />
            <ProfileRow label="Relation" value={profile.emergencyContact?.relation ?? '—'} />
            <ProfileRow label="Phone" value={profile.emergencyContact?.phone ?? '—'} />
            <View style={styles.editButtonContainer}>
              <Button title="Edit Profile" onPress={handleEdit} />
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
    </SafeAreaView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingHorizontal: 18, paddingBottom: 36 },
  successBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.success,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  successBannerText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  header: { alignItems: 'center', paddingTop: 22, paddingBottom: 22 },
  photoFrame: { borderRadius: 54, borderWidth: 4, borderColor: COLORS.surface, padding: 2 },
  photoError: { borderColor: COLORS.danger },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  photoHint: { marginTop: 9, color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  photoErrorText: { marginTop: 8, color: COLORS.danger, fontSize: 13, fontWeight: '600' },
  name: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginTop: 12 },
  email: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  centered: { alignItems: 'center', paddingVertical: 24 },
  errorContainer: { backgroundColor: COLORS.danger, padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: COLORS.white, fontSize: 14, textAlign: 'center' },
  infoText: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 12 },
  profileSection: { marginBottom: 16 },
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
  subheadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 4 },
  subheading: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  editButtonContainer: { marginTop: 22 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  buttonHalf: { flex: 1 },
  logoutContainer: { marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: COLORS.border },
});

export default ProfileScreen;