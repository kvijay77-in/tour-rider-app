/**
 * View/edit profile screen.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ProfilePicture } from '../../components/profile/ProfilePicture';
import { Button } from '../../components/common/Button';
import { COLORS } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { useRider } from '../../hooks/useRider';
import { formatDate } from '../../utils/dateFormatter';
import { isNotEmpty, isValidPhone } from '../../utils/validation';
import { logger } from '../../utils/logger';
import type { RiderAddress } from '../../types/rider';

const TAG = 'ProfileScreen';

type GenderOption = 'Male' | 'Female' | 'Other' | 'Prefer not to say';

type FormErrors = Partial<Record<
  | 'name'
  | 'phone'
  | 'dateOfBirth'
  | 'gender'
  | 'emergencyContactName'
  | 'emergencyContactRelationship'
  | 'emergencyContactPhone',
  string
>>;

const GENDER_OPTIONS: GenderOption[] = ['Male', 'Female', 'Other', 'Prefer not to say'];

function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function toDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function buildAddressPayload(
  line1: string,
  line2: string,
  city: string,
  state: string,
  country: string,
  postalCode: string,
): RiderAddress | undefined {
  const normalizedLine1 = line1.trim();
  const normalizedLine2 = line2.trim();
  const normalizedCity = city.trim();
  const normalizedState = state.trim();
  const normalizedCountry = country.trim();
  const normalizedPostalCode = postalCode.trim();

  if (
    !normalizedLine1
    && !normalizedLine2
    && !normalizedCity
    && !normalizedCountry
    && !normalizedState
    && !normalizedPostalCode
  ) {
    return undefined;
  }

  return {
    ...(normalizedLine1 ? { line1: normalizedLine1 } : {}),
    ...(normalizedLine2 ? { line2: normalizedLine2 } : {}),
    ...(normalizedCity ? { city: normalizedCity } : {}),
    ...(normalizedState ? { state: normalizedState } : {}),
    ...(normalizedCountry ? { country: normalizedCountry } : {}),
    ...(normalizedPostalCode ? { postalcode: normalizedPostalCode } : {}),
  };
}

function formatAddress(address?: RiderAddress): string {
  if (!address) {
    return '—';
  }

  const segments = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.country,
    address.postalcode,
  ].filter((segment): segment is string => Boolean(segment && segment.trim()));

  if (!segments.length) {
    return '—';
  }

  return segments.join(', ');
}

export function ProfileScreen() {
  const { logout, isAuthenticating } = useAuth();
  const {
    profile,
    isLoading,
    error,
    updateProfile,
    uploadProfilePicture,
    refreshProfile,
  } = useRider();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessageVisible, setSuccessMessageVisible] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [gender, setGender] = useState<GenderOption | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoMimeType, setSelectedPhotoMimeType] = useState<string | undefined>(undefined);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!successMessageVisible) {
      return;
    }

    const timer = setTimeout(() => {
      setSuccessMessageVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [successMessageVisible]);

  const syncEditorStateFromProfile = useCallback(() => {
    setName(profile?.name ?? '');
    setPhone(profile?.phone ?? '');
    setAddressLine1(profile?.address?.line1 ?? '');
    setAddressLine2(profile?.address?.line2 ?? '');
    setCity(profile?.address?.city ?? '');
    setState(profile?.address?.state ?? '');
    setCountry(profile?.address?.country ?? '');
    setPostalCode(profile?.address?.postalcode ?? '');
    setEmergencyContactName(profile?.emergencyContact?.name ?? '');
    setEmergencyContactRelationship(profile?.emergencyContact?.relation ?? '');
    setEmergencyContactPhone(profile?.emergencyContact?.phone ?? '');
    setGender((profile?.gender as GenderOption) ?? null);
    setDateOfBirth(toDate(profile?.dateOfBirth));
    setSelectedPhotoUri(null);
    setSelectedPhotoMimeType(undefined);
    setFormErrors({});
  }, [profile]);

  const onDateValueChange = (_event: DateTimePickerChangeEvent, selectedDate: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }

    setDateOfBirth(selectedDate);
    setFormErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
  };

  const onDateDismiss = () => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
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
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) {
        return;
      }

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Invalid photo', 'Profile picture must be 5MB or smaller.');
        return;
      }

      setSelectedPhotoUri(asset.uri);
      setSelectedPhotoMimeType(asset.mimeType ?? 'image/jpeg');
      logger.info(TAG, 'Profile photo selected for profile update');
    } catch (err) {
      logger.error(TAG, 'Error selecting profile photo', err);
      Alert.alert('Error', 'Unable to select photo. Please try again.');
    }
  }, []);

  const handleEdit = useCallback(() => {
    syncEditorStateFromProfile();
    setIsEditing(true);
  }, [syncEditorStateFromProfile]);

  const handleCancel = useCallback(() => {
    syncEditorStateFromProfile();
    setIsEditing(false);
  }, [syncEditorStateFromProfile]);

  const validateEdit = useCallback((): boolean => {
    const nextErrors: FormErrors = {};

    if (!isNotEmpty(name)) {
      nextErrors.name = 'Name is required.';
    }

    if (!isValidPhone(phone)) {
      nextErrors.phone = 'Please enter a valid phone number.';
    }

    if (dateOfBirth === null) {
      nextErrors.dateOfBirth = 'Date of birth is required.';
    }

    if (!gender) {
      nextErrors.gender = 'Gender is required.';
    }

    if (!isNotEmpty(emergencyContactName)) {
      nextErrors.emergencyContactName = 'Emergency contact name is required.';
    }

    if (!isNotEmpty(emergencyContactRelationship)) {
      nextErrors.emergencyContactRelationship = 'Emergency relationship is required.';
    }

    if (!isValidPhone(emergencyContactPhone)) {
      nextErrors.emergencyContactPhone = 'Please enter a valid emergency contact phone number.';
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [
    name,
    phone,
    dateOfBirth,
    gender,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactPhone,
  ]);

  const handleSave = useCallback(async () => {
    if (!validateEdit()) {
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        dateOfBirth: dateOfBirth ? formatDateForApi(dateOfBirth) : undefined,
        gender: gender ?? undefined,
        address: buildAddressPayload(addressLine1, addressLine2, city, state, country, postalCode),
        emergencyContact: {
          name: emergencyContactName.trim(),
          relation: emergencyContactRelationship.trim(),
          phone: emergencyContactPhone.trim(),
        },
      });

      if (selectedPhotoUri) {
        await uploadProfilePicture(selectedPhotoUri, selectedPhotoMimeType);
      }

      setIsEditing(false);
      setSuccessMessageVisible(true);
      logger.info(TAG, 'Profile updated');
    } catch (err) {
      logger.error(TAG, 'Error updating profile', err);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    phone,
    dateOfBirth,
    gender,
    addressLine1,
    addressLine2,
    city,
    state,
    country,
    postalCode,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactPhone,
    selectedPhotoUri,
    selectedPhotoMimeType,
    updateProfile,
    uploadProfilePicture,
    validateEdit,
  ]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      logger.info(TAG, 'User logged out');
    } catch (err) {
      logger.error(TAG, 'Error logging out', err);
    }
  }, [logout]);

  const displayPhotoUrl = useMemo(() => {
    return selectedPhotoUri ?? profile?.photoUrl;
  }, [selectedPhotoUri, profile?.photoUrl]);

  const formattedAddress = useMemo(() => formatAddress(profile?.address), [profile?.address]);

  const inputStyle = (fieldError?: string) => ([
    styles.input,
    fieldError ? styles.inputError : null,
  ]);

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
            <Text style={styles.successBannerText}>Profile updated successfully</Text>
          </View>
        ) : null}

        <View style={styles.header}>
          <ProfilePicture photoUrl={displayPhotoUrl} size={96} onPress={isEditing ? handlePickPhoto : undefined} />
          {isEditing ? (
            <TouchableOpacity onPress={handlePickPhoto} disabled={isSaving}>
              <Text style={styles.changePhotoText}>{selectedPhotoUri ? 'Change photo' : 'Upload photo'}</Text>
            </TouchableOpacity>
          ) : null}

          {profile ? (
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
          <View style={styles.form}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={inputStyle(formErrors.name)}
              value={name}
              onChangeText={(value) => {
                setName(value);
                setFormErrors((prev) => ({ ...prev, name: undefined }));
              }}
              editable={!isSaving}
            />
            {formErrors.name ? <Text style={styles.fieldErrorText}>{formErrors.name}</Text> : null}

            <Text style={styles.label}>Email *</Text>
            <TextInput style={[styles.input, styles.readOnlyInput]} value={profile.email} editable={false} />

            <Text style={styles.label}>Personal Code</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={profile.personalCode ?? 'Assigned by tour organizer'}
              editable={false}
            />

            <Text style={styles.label}>Phone *</Text>
            <TextInput
              style={inputStyle(formErrors.phone)}
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                setFormErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              keyboardType="phone-pad"
              editable={!isSaving}
            />
            {formErrors.phone ? <Text style={styles.fieldErrorText}>{formErrors.phone}</Text> : null}

            <Text style={styles.label}>Date of Birth *</Text>
            <TouchableOpacity
              style={[
                styles.inputButton,
                formErrors.dateOfBirth ? styles.inputError : null,
              ]}
              onPress={() => setShowDatePicker(true)}
              disabled={isSaving}
            >
              <Text style={dateOfBirth ? styles.inputButtonText : styles.placeholderText}>
                {dateOfBirth ? formatDate(dateOfBirth.toISOString()) : 'Select date of birth'}
              </Text>
            </TouchableOpacity>
            {formErrors.dateOfBirth ? <Text style={styles.fieldErrorText}>{formErrors.dateOfBirth}</Text> : null}

            {showDatePicker ? (
              <DateTimePicker
                value={dateOfBirth ?? new Date(1990, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onValueChange={onDateValueChange}
                onDismiss={onDateDismiss}
                onNeutralButtonPress={onDateDismiss}
              />
            ) : null}

            <Text style={styles.label}>Gender *</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((option) => {
                const selected = gender === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.genderChip,
                      selected ? styles.genderChipSelected : null,
                      formErrors.gender ? styles.inputError : null,
                    ]}
                    onPress={() => {
                      setGender(option);
                      setFormErrors((prev) => ({ ...prev, gender: undefined }));
                    }}
                    disabled={isSaving}
                  >
                    <Text style={[styles.genderChipText, selected ? styles.genderChipTextSelected : null]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {formErrors.gender ? <Text style={styles.fieldErrorText}>{formErrors.gender}</Text> : null}

            <Text style={styles.label}>Address (Optional)</Text>
            <TextInput style={styles.input} value={addressLine1} onChangeText={setAddressLine1} editable={!isSaving} placeholder="Line 1" />
            <TextInput style={styles.input} value={addressLine2} onChangeText={setAddressLine2} editable={!isSaving} placeholder="Line 2" />
            <TextInput style={styles.input} value={city} onChangeText={setCity} editable={!isSaving} placeholder="City" />
            <TextInput style={styles.input} value={state} onChangeText={setState} editable={!isSaving} placeholder="State" />
            <TextInput style={styles.input} value={country} onChangeText={setCountry} editable={!isSaving} placeholder="Country" />
            <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} editable={!isSaving} placeholder="Postal code" />

            <Text style={styles.label}>Emergency Contact Name *</Text>
            <TextInput
              style={inputStyle(formErrors.emergencyContactName)}
              value={emergencyContactName}
              onChangeText={(value) => {
                setEmergencyContactName(value);
                setFormErrors((prev) => ({ ...prev, emergencyContactName: undefined }));
              }}
              editable={!isSaving}
            />
            {formErrors.emergencyContactName ? (
              <Text style={styles.fieldErrorText}>{formErrors.emergencyContactName}</Text>
            ) : null}

            <Text style={styles.label}>Emergency Contact Relationship *</Text>
            <TextInput
              style={inputStyle(formErrors.emergencyContactRelationship)}
              value={emergencyContactRelationship}
              onChangeText={(value) => {
                setEmergencyContactRelationship(value);
                setFormErrors((prev) => ({ ...prev, emergencyContactRelationship: undefined }));
              }}
              editable={!isSaving}
            />
            {formErrors.emergencyContactRelationship ? (
              <Text style={styles.fieldErrorText}>{formErrors.emergencyContactRelationship}</Text>
            ) : null}

            <Text style={styles.label}>Emergency Contact Phone *</Text>
            <TextInput
              style={inputStyle(formErrors.emergencyContactPhone)}
              value={emergencyContactPhone}
              onChangeText={(value) => {
                setEmergencyContactPhone(value);
                setFormErrors((prev) => ({ ...prev, emergencyContactPhone: undefined }));
              }}
              keyboardType="phone-pad"
              editable={!isSaving}
            />
            {formErrors.emergencyContactPhone ? (
              <Text style={styles.fieldErrorText}>{formErrors.emergencyContactPhone}</Text>
            ) : null}

            {selectedPhotoUri ? (
              <Image source={{ uri: selectedPhotoUri }} style={styles.photoPreview} />
            ) : null}

            <View style={styles.buttonRow}>
              <View style={styles.buttonHalf}>
                <Button title="Cancel" onPress={handleCancel} variant="secondary" disabled={isSaving} />
              </View>
              <View style={styles.buttonHalf}>
                <Button title="Save" onPress={handleSave} loading={isSaving} disabled={isSaving} />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.profileSection}>
            <ProfileRow label="Personal Code" value={profile.personalCode ?? 'Not assigned'} />
            <ProfileRow label="Email" value={profile.email} />
            <ProfileRow label="Phone" value={profile.phone ?? '—'} />
            <ProfileRow label="Date of Birth" value={profile.dateOfBirth ? formatDate(profile.dateOfBirth) : '—'} />
            <ProfileRow label="Gender" value={profile.gender ?? '—'} />
            <ProfileRow label="Address" value={formattedAddress} />
            <ProfileRow label="Emergency Contact Name" value={profile.emergencyContact?.name ?? '—'} />
            <ProfileRow
              label="Emergency Relationship"
              value={profile.emergencyContact?.relation ?? '—'}
            />
            <ProfileRow label="Emergency Contact Phone" value={profile.emergencyContact?.phone ?? '—'} />

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
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  successBanner: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  successBannerText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 12,
  },
  changePhotoText: {
    marginTop: 8,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 10,
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
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    flex: 1,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  fieldErrorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginBottom: 10,
  },
  readOnlyInput: {
    backgroundColor: COLORS.gray[100],
    color: COLORS.textSecondary,
  },
  inputButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  inputButtonText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  placeholderText: {
    fontSize: 16,
    color: COLORS.textDisabled,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  genderChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  genderChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderChipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  genderChipTextSelected: {
    color: COLORS.white,
  },
  photoPreview: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignSelf: 'center',
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
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

export default ProfileScreen;