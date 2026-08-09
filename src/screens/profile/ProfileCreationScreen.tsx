/**
 * Profile creation screen shown after first authenticated sign-in.
 */

import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/common/Button';
import { ProfileFormFields } from '../../components/profile/ProfileFormFields';
import { COLORS } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { useRider } from '../../hooks/useRider';
import { ApiError, isValidationApiError } from '../../services/api/apiClient';
import { createRiderProfile, linkCognitoUser } from '../../services/api/riderApi';
import { logger } from '../../utils/logger';
import {
  combinePhoneNumber,
  createProfileFormValues,
  validateProfileForm,
  type ProfileFormErrors,
  type ProfileFormField,
  type ProfileFormValues,
} from '../../utils/profileForm';
import type { AppStackParamList } from '../../types/navigation';

const TAG = 'ProfileCreationScreen';

type Props = NativeStackScreenProps<AppStackParamList, 'ProfileCreation'>;

function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

export function ProfileCreationScreen({ navigation }: Props) {
  const { user, setLinkedProfileId, logout, isAuthenticating } = useAuth();
  const { uploadProfilePicture, refreshProfile } = useRider();
  const [values, setValues] = useState<ProfileFormValues>(() => createProfileFormValues());
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoMimeType, setSelectedPhotoMimeType] = useState<string | undefined>();
  const [selectedPhotoBase64, setSelectedPhotoBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<ProfileFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const email = user?.email ?? '';

  const handleFieldChange = <Key extends keyof ProfileFormValues>(
    field: Key,
    value: ProfileFormValues[Key],
    errorField?: ProfileFormField,
  ) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (errorField) setFormErrors((previous) => ({ ...previous, [errorField]: undefined }));
  };

  const handlePickPhoto = async () => {
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
      logger.info(TAG, 'Profile photo selected during profile creation');
    } catch (error) {
      logger.error(TAG, 'Error selecting profile photo', error);
      Alert.alert('Error', 'Unable to select photo. Please try again.');
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!user || !email) {
      setSubmitError('Authenticated user details are unavailable. Please sign in again.');
      return;
    }

    const errors = validateProfileForm(values, Boolean(selectedPhotoUri));
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      let profileId = user.profileId;
      if (!profileId) {
        const linkResponse = await linkCognitoUser(user.userId);
        profileId = linkResponse.data?.profileId;
        if (profileId) setLinkedProfileId(profileId);
      }
      if (!profileId) throw new Error('Failed to resolve profile identifier for profile creation.');

      await createRiderProfile( profileId, {
        profileId,
        name: values.name.trim(),
        email,
        phone: combinePhoneNumber(values.phoneCallingCode, values.phoneNumber),
        dateOfBirth: formatDateForApi(values.dateOfBirth as Date),
        gender: values.gender ?? undefined,
        address: {
          line1: values.addressLine1.trim(),
          ...(values.addressLine2.trim() ? { line2: values.addressLine2.trim() } : {}),
          city: values.city.trim(),
          state: values.state.trim(),
          country: values.country,
          postalCode: values.postalCode.trim(),
        },
        emergencyContact: {
          name: values.emergencyContactName.trim(),
          relation: values.emergencyContactRelationship.trim(),
          phone: combinePhoneNumber(values.emergencyPhoneCallingCode, values.emergencyContactPhone),
        },
      });

      await uploadProfilePicture(
        selectedPhotoUri,
        selectedPhotoMimeType,
        profileId,
        selectedPhotoBase64 ?? undefined,
      );
      await refreshProfile();
      logger.info(TAG, 'Profile created successfully');
      navigation.replace('MainTabs', { successMessage: 'Profile created successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create profile';
      if (isValidationApiError(error)) {
        logger.info(TAG, 'Profile creation validation failed', {
          message: error.message,
          statusCode: error.statusCode,
          errorCode: error.errorCode,
        });
      } else if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
        logger.info(TAG, 'Profile creation request rejected', {
          message: error.message,
          statusCode: error.statusCode,
          errorCode: error.errorCode,
        });
      } else {
        logger.error(TAG, 'Profile creation failed', error);
      }
      setSubmitError(message);
      Alert.alert('Profile creation failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Your unsaved profile details will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout().catch((error) => {
          logger.error(TAG, 'Error logging out from profile creation screen', error);
          Alert.alert('Sign out failed', 'Unable to sign out right now. Please try again.');
        }),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>RIDER PROFILE</Text>
          <Text style={styles.title}>Tell us about yourself</Text>
          <Text style={styles.subtitle}>Complete each required field to continue.</Text>
        </View>

        {submitError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Profile picture *</Text>
          <TouchableOpacity
            style={[styles.photoButton, formErrors.photo ? styles.photoError : null]}
            onPress={handlePickPhoto}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Select profile picture"
          >
            {selectedPhotoUri ? (
              <Image source={{ uri: selectedPhotoUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <MaterialIcons name="add-a-photo" size={30} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.photoCopy}>
              <Text style={styles.photoTitle}>{selectedPhotoUri ? 'Change photo' : 'Add a profile photo'}</Text>
              <Text style={styles.photoHint}>JPEG or PNG, up to 5MB</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {formErrors.photo ? <Text style={styles.photoErrorText}>Profile picture is required.</Text> : null}
        </View>

        <ProfileFormFields
          email={email}
          values={values}
          errors={formErrors}
          disabled={isSubmitting}
          onChange={handleFieldChange}
        />

        <View style={styles.actions}>
          <Button title="Create Profile" onPress={handleSubmit} loading={isSubmitting} disabled={isSubmitting} />
          <Button
            title="Sign Out"
            onPress={handleLogout}
            variant="secondary"
            loading={isAuthenticating}
            disabled={isSubmitting || isAuthenticating}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingHorizontal: 18, paddingBottom: 36 },
  heading: { paddingTop: 18, paddingBottom: 22 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 7 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, marginTop: 7 },
  errorContainer: { backgroundColor: COLORS.danger, borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { color: COLORS.white, fontSize: 14 },
  photoSection: { marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  photoButton: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
  },
  photoError: { borderColor: COLORS.danger, borderWidth: 2 },
  photoPreview: { width: 66, height: 66, borderRadius: 33 },
  photoPlaceholder: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: COLORS.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCopy: { flex: 1, paddingHorizontal: 13 },
  photoTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  photoHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  photoErrorText: { marginTop: 8, color: COLORS.danger, fontSize: 13, fontWeight: '600' },
  actions: { gap: 10, marginTop: 24 },
});

export default ProfileCreationScreen;