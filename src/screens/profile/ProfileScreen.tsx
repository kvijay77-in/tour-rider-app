/**
 * View/edit profile screen.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/common/Button';
import { PasswordInput } from '../../components/common/PasswordInput';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { DynamicProfileForm } from '../../components/profile/DynamicProfileForm';
import { DynamicProfileView } from '../../components/profile/DynamicProfileView';
import { ProfilePicture } from '../../components/profile/ProfilePicture';
import { COLORS } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { useRider } from '../../hooks/useRider';
import { ApiError } from '../../services/api/apiClient';
import { AccountDeletionError } from '../../services/accountDeletionService';
import { logger } from '../../utils/logger';
import {
  buildProfileSavePayload,
  createProfileDraftValues,
  findAttributeByHandler,
  getProfileCoreValue,
  mergeDraftValuesWithDefinitions,
  validateProfileDraftValues,
  type ProfileDraftValues,
  type ProfileValidationErrors,
} from '../../profile-schema';
import type { UpdateRiderProfileRequest } from '../../types/rider';

const TAG = 'ProfileScreen';

function isDefinitionsChangedError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 409 && error.errorCode === 'PROFILE_DEFINITIONS_CHANGED';
}

function hasProfileUpdates(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).some((key) => key !== 'definitionsVersion');
}

export function ProfileScreen() {
  const { logout, deleteAccount, isAuthenticating, user } = useAuth();
  const {
    profile,
    isLoading,
    error,
    updateProfile,
    uploadProfilePicture,
    refreshProfile,
    profileDefinitions,
    isLoadingDefinitions,
    definitionsError,
    refreshProfileDefinitions,
  } = useRider();
  const { width: screenWidth } = useWindowDimensions();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPhotoPreviewVisible, setIsPhotoPreviewVisible] = useState(false);
  const [photoAspectRatio, setPhotoAspectRatio] = useState(1);
  const [successMessageVisible, setSuccessMessageVisible] = useState(false);
  const [values, setValues] = useState<ProfileDraftValues>({});
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoMimeType, setSelectedPhotoMimeType] = useState<string | undefined>();
  const [selectedPhotoBase64, setSelectedPhotoBase64] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<ProfileValidationErrors>({});
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!successMessageVisible) return;
    const timer = setTimeout(() => setSuccessMessageVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [successMessageVisible]);

  useEffect(() => {
    if (!profileDefinitions) {
      return;
    }

    if (isEditing) {
      setValues((previous) => mergeDraftValuesWithDefinitions(previous, profile, profileDefinitions, user));
    } else {
      setValues(createProfileDraftValues(profile, profileDefinitions, user));
    }
  }, [isEditing, profile, profileDefinitions, user]);

  const photoAttribute = useMemo(
    () => (profileDefinitions ? findAttributeByHandler(profileDefinitions.orderedAttributes, 'PROFILE_PHOTO') : undefined),
    [profileDefinitions],
  );

  // Fields kept out of the edit form are also kept out of validation.
  const formExcludedKeys = useMemo(() => (photoAttribute ? [photoAttribute.key] : []), [photoAttribute]);

  const resetEditor = useCallback(() => {
    if (!profileDefinitions) {
      return;
    }

    setValues(createProfileDraftValues(profile, profileDefinitions, user));
    setSelectedPhotoUri(null);
    setSelectedPhotoMimeType(undefined);
    setSelectedPhotoBase64(null);
    setFormErrors({});
  }, [profile, profileDefinitions, user]);

  const handleFieldChange = (field: string, value: unknown) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setFormErrors((previous) => Object.fromEntries(
      Object.entries(previous).filter(([key]) => key !== field && !key.startsWith(`${field}.`)),
    ));
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
      if (photoAttribute) {
        setFormErrors((previous) => ({ ...previous, [photoAttribute.key]: '' }));
      }
      logger.info(TAG, 'Profile photo selected for profile update');
    } catch (pickError) {
      logger.error(TAG, 'Error selecting profile photo', pickError);
      Alert.alert('Error', 'Unable to select photo. Please try again.');
    }
  }, [photoAttribute]);

  const handleEdit = useCallback(() => {
    resetEditor();
    setIsEditing(true);
  }, [resetEditor]);

  const handleCancel = useCallback(() => {
    resetEditor();
    setIsEditing(false);
  }, [resetEditor]);

  const handleSave = useCallback(async () => {
    if (!profileDefinitions) {
      return;
    }

    if (!profileDefinitions.definitionsVersion) {
      Alert.alert('Profile fields unavailable', 'The profile field version is unavailable right now. Please refresh and try again.');
      return;
    }

    const hasPhoto = Boolean(selectedPhotoUri || profile?.photoUrl || profile?.photoS3Key);
    const errors = validateProfileDraftValues(profileDefinitions, values, { skipReadOnly: true, excludedKeys: formExcludedKeys });
    if (photoAttribute?.required && !hasPhoto) {
      errors[photoAttribute.key] = 'Profile picture is required.';
    }
    setFormErrors(errors);
    if (Object.keys(errors).filter((key) => errors[key]).length > 0) return;

    setIsSaving(true);
    try {
      const profileUpdates = buildProfileSavePayload({
        profile,
        definitions: profileDefinitions,
        values,
      }) as unknown as UpdateRiderProfileRequest;
      const hasDataUpdates = hasProfileUpdates(profileUpdates as unknown as Record<string, unknown>);
      const hasPhotoUpdate = Boolean(selectedPhotoUri);

      if (!hasDataUpdates && !hasPhotoUpdate) {
        logger.info(TAG, 'Profile save skipped because no changes were detected');
        setIsEditing(false);
        return;
      }

      if (hasDataUpdates) {
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
      if (isDefinitionsChangedError(saveError)) {
        await refreshProfileDefinitions();
        Alert.alert('Profile updated', 'Profile definitions changed. Please review the fields and save again.');
        return;
      }

      logger.error(TAG, 'Error updating profile', saveError);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [
    formExcludedKeys,
    photoAttribute,
    profile,
    profileDefinitions,
    refreshProfileDefinitions,
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

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalVisible(false);
    setDeletePassword('');
    setDeleteError(null);
  }, []);

  const handleDeleteAccountPress = useCallback(() => {
    Alert.alert(
      'Delete my account',
      'This permanently deletes your sign-in account. You will be signed out and will not be able to sign in with this email and password again. Your tour records held by the organizer are not removed by this action.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeletePassword('');
            setDeleteError(null);
            setIsDeleteModalVisible(true);
          },
        },
      ],
    );
  }, []);

  const handleConfirmDeleteAccount = useCallback(async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your password.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(deletePassword);
      // AuthContext clears the session; the root navigator shows Login.
    } catch (deleteAccountError) {
      if (deleteAccountError instanceof AccountDeletionError) {
        if (deleteAccountError.code === 'INVALID_PASSWORD') {
          setDeleteError(deleteAccountError.message);
          return;
        }
        closeDeleteModal();
        Alert.alert(
          deleteAccountError.code === 'OFFLINE' ? 'No connection' : 'Account not deleted',
          deleteAccountError.message,
        );
        return;
      }

      logger.error(TAG, 'Account deletion failed', deleteAccountError);
      closeDeleteModal();
      Alert.alert('Account not deleted', 'Account deletion failed. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [closeDeleteModal, deleteAccount, deletePassword]);

  const displayPhotoUrl = selectedPhotoUri ?? profile?.photoUrl;
  const displayName = String(getProfileCoreValue(profile, 'name') ?? 'Profile not available');
  const displayEmail = String(getProfileCoreValue(profile, 'email') ?? 'No email available');

  const handleOpenPhotoPreview = useCallback(() => {
    if (!displayPhotoUrl) return;

    Image.getSize(
      displayPhotoUrl,
      (width, height) => {
        if (width > 0 && height > 0) {
          setPhotoAspectRatio(width / height);
        }
        setIsPhotoPreviewVisible(true);
      },
      () => {
        setPhotoAspectRatio(1);
        setIsPhotoPreviewVisible(true);
      },
    );
  }, [displayPhotoUrl]);

  if ((isLoading && !profile) || (isLoadingDefinitions && !profileDefinitions)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner message="Loading profile..." />
      </SafeAreaView>
    );
  }

  if (!profileDefinitions) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.infoTitle}>Profile fields are unavailable.</Text>
          <Text style={styles.infoText}>{definitionsError ?? 'Unable to load the profile form right now.'}</Text>
          <Button title="Retry" onPress={refreshProfileDefinitions} variant="secondary" />
        </View>
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
            style={[styles.photoFrame, photoAttribute && formErrors[photoAttribute.key] ? styles.photoError : null]}
            onPress={isEditing ? handlePickPhoto : handleOpenPhotoPreview}
            disabled={isSaving || (!isEditing && !displayPhotoUrl)}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Change profile picture' : 'View larger profile picture'}
          >
            <ProfilePicture
              photoUrl={displayPhotoUrl}
              photoAccessDenied={profile?.photoAccessDenied && !selectedPhotoUri}
              size={100}
            />
            {isEditing ? (
              <View style={styles.cameraBadge}>
                <MaterialIcons name="photo-camera" size={17} color={COLORS.white} />
              </View>
            ) : null}
          </TouchableOpacity>
          {isEditing ? <Text style={styles.photoHint}>Tap the photo to change it</Text> : null}
          {isEditing && photoAttribute && formErrors[photoAttribute.key] ? <Text style={styles.photoErrorText}>{formErrors[photoAttribute.key]}</Text> : null}
          {profile && !isEditing ? (
            <>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.email}>{displayEmail}</Text>
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
            <DynamicProfileForm
              definitions={profileDefinitions}
              values={values}
              errors={formErrors}
              disabled={isSaving}
              excludedKeys={formExcludedKeys}
              showAdminOnly
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
            <DynamicProfileView
              definitions={profileDefinitions}
              profile={profile}
              excludedKeys={photoAttribute ? [photoAttribute.key, 'name', 'email'] : ['name', 'email']}
            />
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

        <View style={styles.deleteAccountContainer}>
          <TouchableOpacity
            onPress={handleDeleteAccountPress}
            disabled={isAuthenticating || isSaving || isDeleting}
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
            accessibilityHint="Permanently deletes your sign-in account after confirming your password"
          >
            <Text style={styles.deleteAccountText}>Delete my account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={isDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={isDeleting ? () => {} : closeDeleteModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.modalTitle} accessibilityRole="header">Confirm your password</Text>
            <Text style={styles.modalText}>
              Enter your password to permanently delete your account. You need to be online.
            </Text>
            <PasswordInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password"
              placeholderTextColor={COLORS.textDisabled}
              autoComplete="password"
              textContentType="password"
              editable={!isDeleting}
              accessibilityLabel="Password"
            />
            {deleteError ? (
              <Text style={styles.modalError} accessibilityRole="alert">{deleteError}</Text>
            ) : null}
            <View style={styles.buttonRow}>
              <View style={styles.buttonHalf}>
                <Button title="Cancel" onPress={closeDeleteModal} variant="secondary" disabled={isDeleting} />
              </View>
              <View style={styles.buttonHalf}>
                <Button
                  title="Delete"
                  onPress={handleConfirmDeleteAccount}
                  variant="danger"
                  loading={isDeleting}
                  disabled={isDeleting}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isPhotoPreviewVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsPhotoPreviewVisible(false)}
      >
        <View style={styles.photoPreview}>
          <TouchableOpacity
            style={styles.photoPreviewClose}
            onPress={() => setIsPhotoPreviewVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close profile picture"
          >
            <MaterialIcons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          {displayPhotoUrl ? (
            <Image
              source={{ uri: displayPhotoUrl }}
              style={{ width: screenWidth, height: screenWidth / photoAspectRatio }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel="Profile picture preview"
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
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
  photoPreview: {
    flex: 1,
    backgroundColor: COLORS.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreviewClose: {
    position: 'absolute',
    top: 44,
    right: 16,
    zIndex: 1,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary, marginTop: 12 },
  email: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  centered: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 24 },
  infoTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  errorContainer: { backgroundColor: COLORS.danger, padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: COLORS.white, fontSize: 14, textAlign: 'center' },
  infoText: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 12, textAlign: 'center' },
  profileSection: { marginBottom: 16 },
  editButtonContainer: { marginTop: 22 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  buttonHalf: { flex: 1 },
  logoutContainer: { marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: COLORS.border },
  deleteAccountContainer: { marginTop: 28, alignItems: 'center' },
  deleteAccountText: { color: COLORS.danger, fontSize: 15, fontWeight: '600', paddingVertical: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  modalText: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },
  modalError: { color: COLORS.danger, fontSize: 13, fontWeight: '600', marginTop: 4 },
});

export default ProfileScreen;
