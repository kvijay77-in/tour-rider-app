/**
 * Profile creation screen shown after first authenticated sign-in.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { DynamicProfileForm } from '../../components/profile/DynamicProfileForm';
import { COLORS } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { useRider } from '../../hooks/useRider';
import { ApiError, isValidationApiError } from '../../services/api/apiClient';
import { createRiderProfile, linkCognitoUser } from '../../services/api/riderApi';
import { logger } from '../../utils/logger';
import type { AppStackParamList } from '../../types/navigation';
import type { CreateRiderProfileRequest } from '../../types/rider';
import {
  buildProfileSavePayload,
  findAttributeByHandler,
  mergeDraftValuesWithDefinitions,
  validateProfileDraftValues,
  type ProfileDraftValues,
  type ProfileValidationErrors,
} from '../../profile-schema';

const TAG = 'ProfileCreationScreen';

type Props = NativeStackScreenProps<AppStackParamList, 'ProfileCreation'>;

function isDefinitionsChangedError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 409 && error.errorCode === 'PROFILE_DEFINITIONS_CHANGED';
}

export function ProfileCreationScreen({ navigation }: Props) {
  const { user, setLinkedProfileId, logout, isAuthenticating } = useAuth();
  const {
    uploadProfilePicture,
    refreshProfile,
    profileDefinitions,
    isLoadingDefinitions,
    definitionsError,
    refreshProfileDefinitions,
  } = useRider();
  const [values, setValues] = useState<ProfileDraftValues>({});
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoMimeType, setSelectedPhotoMimeType] = useState<string | undefined>();
  const [selectedPhotoBase64, setSelectedPhotoBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<ProfileValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileDefinitions) {
      return;
    }

    setValues((previous) => mergeDraftValuesWithDefinitions(previous, null, profileDefinitions, user));
  }, [profileDefinitions, user]);

  const photoAttribute = useMemo(
    () => (profileDefinitions ? findAttributeByHandler(profileDefinitions.orderedAttributes, 'PROFILE_PHOTO') : undefined),
    [profileDefinitions],
  );

  // Fields kept out of the form are also kept out of validation.
  const formExcludedKeys = useMemo(() => (photoAttribute ? [photoAttribute.key] : []), [photoAttribute]);

  const handleFieldChange = (field: string, value: unknown) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setFormErrors((previous) => Object.fromEntries(
      Object.entries(previous).filter(([key]) => key !== field && !key.startsWith(`${field}.`)),
    ));
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
      if (photoAttribute) {
        setFormErrors((previous) => ({ ...previous, [photoAttribute.key]: '' }));
      }
      logger.info(TAG, 'Profile photo selected during profile creation');
    } catch (error) {
      logger.error(TAG, 'Error selecting profile photo', error);
      Alert.alert('Error', 'Unable to select photo. Please try again.');
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!user) {
      setSubmitError('Authenticated user details are unavailable. Please sign in again.');
      return;
    }

    if (!profileDefinitions) {
      setSubmitError('Profile definitions are unavailable. Please retry.');
      return;
    }

    if (!profileDefinitions.definitionsVersion) {
      setSubmitError('The profile field version is unavailable right now. Please retry after refreshing.');
      return;
    }

    const errors = validateProfileDraftValues(profileDefinitions, values, { skipReadOnly: true, excludedKeys: formExcludedKeys });
    if (photoAttribute?.required && !selectedPhotoUri) {
      errors[photoAttribute.key] = 'Profile picture is required.';
    }
    setFormErrors(errors);
    if (Object.keys(errors).filter((key) => errors[key]).length > 0) return;

    setIsSubmitting(true);
    try {
      let profileId = user.profileId;
      if (!profileId) {
        const linkResponse = await linkCognitoUser(user.userId);
        profileId = linkResponse.data?.profileId;
        if (profileId) setLinkedProfileId(profileId);
      }
      if (!profileId) throw new Error('Failed to resolve profile identifier for profile creation.');

      const payload = buildProfileSavePayload({
        profile: null,
        definitions: profileDefinitions,
        values,
      }) as unknown as CreateRiderProfileRequest;
      payload.profileId = profileId;

      await createRiderProfile(payload);

      if (selectedPhotoUri) {
        await uploadProfilePicture(
          selectedPhotoUri,
          selectedPhotoMimeType,
          profileId,
          selectedPhotoBase64 ?? undefined,
        );
      }
      await refreshProfile();
      logger.info(TAG, 'Profile created successfully');
      navigation.replace('MainTabs', { successMessage: 'Profile created successfully' });
    } catch (error) {
      if (isDefinitionsChangedError(error)) {
        await refreshProfileDefinitions();
        Alert.alert('Profile updated', 'Profile definitions changed. Please review the fields and save again.');
        setSubmitError('Profile definitions changed. Please review the fields and save again.');
        return;
      }

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

  if (isLoadingDefinitions && !profileDefinitions) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="Loading profile fields..." />
      </SafeAreaView>
    );
  }

  if (!profileDefinitions) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredState}>
          <Text style={styles.centeredStateTitle}>Profile fields are unavailable</Text>
          <Text style={styles.centeredStateMessage}>{definitionsError ?? 'Unable to load the profile form right now.'}</Text>
          <Button title="Retry" onPress={refreshProfileDefinitions} variant="secondary" />
          <View style={styles.retrySpacing}>
            <Button title="Sign Out" onPress={handleLogout} variant="secondary" disabled={isAuthenticating} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

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

        {photoAttribute ? (
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>{photoAttribute.label}{photoAttribute.required ? ' *' : ''}</Text>
            <TouchableOpacity
              style={[styles.photoButton, formErrors[photoAttribute.key] ? styles.photoError : null]}
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
                <Text style={styles.photoHint}>{photoAttribute.helpText ?? 'JPEG or PNG, up to 5MB'}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {formErrors[photoAttribute.key] ? <Text style={styles.photoErrorText}>{formErrors[photoAttribute.key]}</Text> : null}
          </View>
        ) : null}

        <DynamicProfileForm
          definitions={profileDefinitions}
          values={values}
          errors={formErrors}
          disabled={isSubmitting}
          excludedKeys={formExcludedKeys}
          showAdminOnly={false}
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
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centeredStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  centeredStateMessage: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: 18,
    textAlign: 'center',
  },
  retrySpacing: {
    marginTop: 10,
    width: '100%',
  },
});

export default ProfileCreationScreen;
