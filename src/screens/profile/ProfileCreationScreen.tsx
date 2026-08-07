/**
 * Profile creation screen shown after first authenticated sign-in.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  Platform,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useRider } from '../../hooks/useRider';
import { createRiderProfile, linkCognitoUser } from '../../services/api/riderApi';
import { isNotEmpty, isValidPhone } from '../../utils/validation';
import { logger } from '../../utils/logger';
import type { AppStackParamList } from '../../types/navigation';
import type { RiderAddress } from '../../types/rider';

const TAG = 'ProfileCreationScreen';

type Props = NativeStackScreenProps<AppStackParamList, 'ProfileCreation'>;

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

function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
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

export function ProfileCreationScreen({ navigation }: Props) {
  const { user, setLinkedProfileId, logout, isAuthenticating } = useAuth();
  const { uploadProfilePicture, refreshProfile } = useRider();

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
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<GenderOption | null>(null);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoMimeType, setSelectedPhotoMimeType] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const email = user?.email ?? '';

  const dateLabel = useMemo(() => {
    if (!dateOfBirth) {
      return 'Select date of birth';
    }
    return formatDateForDisplay(dateOfBirth);
  }, [dateOfBirth]);

  const onChangeDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      setDateOfBirth(selectedDate);
      setFormErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
    }
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
      logger.info(TAG, 'Profile photo selected during profile creation');
    } catch (err) {
      logger.error(TAG, 'Error selecting profile photo', err);
      Alert.alert('Error', 'Unable to select photo. Please try again.');
    }
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!isNotEmpty(name)) {
      nextErrors.name = 'Name is required.';
    }

    if (!isValidPhone(phone)) {
      nextErrors.phone = 'Please enter a valid phone number.';
    }

    if (!dateOfBirth) {
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
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    if (!user) {
      setSubmitError('No authenticated user found. Please sign in again.');
      return;
    }

    if (!email) {
      setSubmitError('Authenticated user email is unavailable. Please sign in again.');
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let profileId = user.profileId;

      if (!profileId) {
        const linkResponse = await linkCognitoUser(user.userId);
        profileId = linkResponse.data?.profileId;
        if (profileId) {
          setLinkedProfileId(profileId);
        }
      }

      if (!profileId) {
        throw new Error('Failed to resolve profile identifier for profile creation.');
      }

      await createRiderProfile({
        profileId,
        name: name.trim(),
        email,
        phone: phone.trim(),
        dateOfBirth: formatDateForApi(dateOfBirth as Date),
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

      await refreshProfile();

      logger.info(TAG, 'Profile created successfully');
      navigation.replace('MainTabs', {
        successMessage: 'Profile created successfully',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create profile';
      logger.error(TAG, 'Profile creation failed', err);
      setSubmitError(message);
      Alert.alert('Profile creation failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out? Your unsaved profile details will be lost.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            logout().catch((err) => {
              logger.error(TAG, 'Error logging out from profile creation screen', err);
              Alert.alert('Sign out failed', 'Unable to sign out right now. Please try again.');
            });
          },
        },
      ],
    );
  };

  const inputStyle = (fieldError?: string) => ([
    styles.input,
    fieldError ? styles.inputError : null,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Your Profile</Text>
        <Text style={styles.subtitle}>Complete your rider profile to continue using the app.</Text>

        {submitError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={inputStyle(formErrors.name)}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setFormErrors((prev) => ({ ...prev, name: undefined }));
          }}
          editable={!isSubmitting}
          placeholder="Full name"
          placeholderTextColor={COLORS.textDisabled}
        />
        {formErrors.name ? <Text style={styles.fieldErrorText}>{formErrors.name}</Text> : null}

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={email}
          editable={false}
          placeholderTextColor={COLORS.textDisabled}
        />

        <Text style={styles.label}>Personal Code</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value="Assigned by tour organizer"
          editable={false}
          placeholderTextColor={COLORS.textDisabled}
        />

        <Text style={styles.label}>Phone *</Text>
        <TextInput
          style={inputStyle(formErrors.phone)}
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            setFormErrors((prev) => ({ ...prev, phone: undefined }));
          }}
          editable={!isSubmitting}
          placeholder="Phone number"
          keyboardType="phone-pad"
          placeholderTextColor={COLORS.textDisabled}
        />
        {formErrors.phone ? <Text style={styles.fieldErrorText}>{formErrors.phone}</Text> : null}

        <Text style={styles.label}>Date of Birth *</Text>
        <TouchableOpacity
          style={[
            styles.inputButton,
            formErrors.dateOfBirth ? styles.inputError : null,
          ]}
          onPress={() => setShowDatePicker(true)}
          disabled={isSubmitting}
          accessibilityRole="button"
        >
          <Text style={dateOfBirth ? styles.inputButtonText : styles.placeholderText}>{dateLabel}</Text>
        </TouchableOpacity>
        {formErrors.dateOfBirth ? <Text style={styles.fieldErrorText}>{formErrors.dateOfBirth}</Text> : null}

        {showDatePicker ? (
          <DateTimePicker
            value={dateOfBirth ?? new Date(1990, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={onChangeDate}
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
                disabled={isSubmitting}
              >
                <Text style={[styles.genderChipText, selected ? styles.genderChipTextSelected : null]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {formErrors.gender ? <Text style={styles.fieldErrorText}>{formErrors.gender}</Text> : null}

        <Text style={styles.label}>Address (Optional)</Text>
        <TextInput
          style={styles.input}
          value={addressLine1}
          onChangeText={setAddressLine1}
          editable={!isSubmitting}
          placeholder="Line 1"
          placeholderTextColor={COLORS.textDisabled}
        />
        <TextInput
          style={styles.input}
          value={addressLine2}
          onChangeText={setAddressLine2}
          editable={!isSubmitting}
          placeholder="Line 2"
          placeholderTextColor={COLORS.textDisabled}
        />
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          editable={!isSubmitting}
          placeholder="City"
          placeholderTextColor={COLORS.textDisabled}
        />
        <TextInput
          style={styles.input}
          value={state}
          onChangeText={setState}
          editable={!isSubmitting}
          placeholder="State"
          placeholderTextColor={COLORS.textDisabled}
        />
        <TextInput
          style={styles.input}
          value={country}
          onChangeText={setCountry}
          editable={!isSubmitting}
          placeholder="Country"
          placeholderTextColor={COLORS.textDisabled}
        />
        <TextInput
          style={styles.input}
          value={postalCode}
          onChangeText={setPostalCode}
          editable={!isSubmitting}
          placeholder="Postal code"
          placeholderTextColor={COLORS.textDisabled}
        />

        <Text style={styles.label}>Emergency Contact Name *</Text>
        <TextInput
          style={inputStyle(formErrors.emergencyContactName)}
          value={emergencyContactName}
          onChangeText={(value) => {
            setEmergencyContactName(value);
            setFormErrors((prev) => ({ ...prev, emergencyContactName: undefined }));
          }}
          editable={!isSubmitting}
          placeholder="Emergency contact name"
          placeholderTextColor={COLORS.textDisabled}
        />
        {formErrors.emergencyContactName ? <Text style={styles.fieldErrorText}>{formErrors.emergencyContactName}</Text> : null}

        <Text style={styles.label}>Emergency Contact Relationship *</Text>
        <TextInput
          style={inputStyle(formErrors.emergencyContactRelationship)}
          value={emergencyContactRelationship}
          onChangeText={(value) => {
            setEmergencyContactRelationship(value);
            setFormErrors((prev) => ({ ...prev, emergencyContactRelationship: undefined }));
          }}
          editable={!isSubmitting}
          placeholder="Relationship"
          placeholderTextColor={COLORS.textDisabled}
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
          editable={!isSubmitting}
          placeholder="Emergency contact phone"
          keyboardType="phone-pad"
          placeholderTextColor={COLORS.textDisabled}
        />
        {formErrors.emergencyContactPhone ? (
          <Text style={styles.fieldErrorText}>{formErrors.emergencyContactPhone}</Text>
        ) : null}

        <Text style={styles.label}>Profile Picture (Optional)</Text>
        <View style={styles.photoSection}>
          {selectedPhotoUri ? (
            <Image source={{ uri: selectedPhotoUri }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>No photo selected</Text>
            </View>
          )}
          <Button
            title={selectedPhotoUri ? 'Change Photo' : 'Select Photo'}
            onPress={handlePickPhoto}
            variant="secondary"
            disabled={isSubmitting}
          />
        </View>

        <View style={styles.submitContainer}>
          <Button
            title="Create Profile"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          />
        </View>

        <View style={styles.logoutContainer}>
          <Button
            title="Sign Out"
            onPress={handleLogout}
            variant="danger"
            loading={isAuthenticating}
            disabled={isSubmitting || isAuthenticating}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: COLORS.white,
    fontSize: 14,
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
  photoSection: {
    marginBottom: 16,
    gap: 10,
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.gray[100],
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  photoPlaceholderText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  submitContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  logoutContainer: {
    marginBottom: 24,
  },
});

export default ProfileCreationScreen;