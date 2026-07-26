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

const TAG = 'ProfileCreationScreen';

type Props = NativeStackScreenProps<AppStackParamList, 'ProfileCreation'>;

type GenderOption = 'Male' | 'Female' | 'Other' | 'Prefer not to say';

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

export function ProfileCreationScreen({ navigation }: Props) {
  const { user, setLinkedProfileId } = useAuth();
  const { uploadProfilePicture, refreshProfile } = useRider();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<GenderOption | null>(null);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPhotoMimeType, setSelectedPhotoMimeType] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (!isNotEmpty(firstName) || !isNotEmpty(lastName)) {
      setError('First name and last name are required.');
      return false;
    }

    if (!isValidPhone(phone)) {
      setError('Please enter a valid phone number.');
      return false;
    }

    if (!dateOfBirth) {
      setError('Date of birth is required.');
      return false;
    }

    if (!gender) {
      setError('Gender is required.');
      return false;
    }

    if (!isNotEmpty(emergencyContactName) || !isNotEmpty(emergencyContactRelationship)) {
      setError('Emergency contact name and relationship are required.');
      return false;
    }

    if (!isValidPhone(emergencyContactPhone)) {
      setError('Please enter a valid emergency contact phone number.');
      return false;
    }

    if (!email) {
      setError('Authenticated user email is unavailable. Please sign in again.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    setError(null);

    if (!user) {
      setError('No authenticated user found. Please sign in again.');
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
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        phone: phone.trim(),
        dateOfBirth: formatDateForApi(dateOfBirth as Date),
        gender: gender ?? undefined,
        address: address.trim() || undefined,
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactRelationship: emergencyContactRelationship.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
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
      setError(message);
      Alert.alert('Profile creation failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Your Profile</Text>
        <Text style={styles.subtitle}>Complete your rider profile to continue using the app.</Text>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          editable={!isSubmitting}
          placeholder="First name"
          placeholderTextColor={COLORS.textDisabled}
        />

        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          editable={!isSubmitting}
          placeholder="Last name"
          placeholderTextColor={COLORS.textDisabled}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={email}
          editable={false}
          placeholderTextColor={COLORS.textDisabled}
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          editable={!isSubmitting}
          placeholder="Phone number"
          keyboardType="phone-pad"
          placeholderTextColor={COLORS.textDisabled}
        />

        <Text style={styles.label}>Date of Birth</Text>
        <TouchableOpacity
          style={styles.inputButton}
          onPress={() => setShowDatePicker(true)}
          disabled={isSubmitting}
          accessibilityRole="button"
        >
          <Text style={dateOfBirth ? styles.inputButtonText : styles.placeholderText}>{dateLabel}</Text>
        </TouchableOpacity>

        {showDatePicker ? (
          <DateTimePicker
            value={dateOfBirth ?? new Date(1990, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={onChangeDate}
          />
        ) : null}

        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map((option) => {
            const selected = gender === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.genderChip, selected ? styles.genderChipSelected : null]}
                onPress={() => setGender(option)}
                disabled={isSubmitting}
              >
                <Text style={[styles.genderChipText, selected ? styles.genderChipTextSelected : null]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Address (Optional)</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          editable={!isSubmitting}
          placeholder="Address"
          placeholderTextColor={COLORS.textDisabled}
        />

        <Text style={styles.label}>Emergency Contact Name</Text>
        <TextInput
          style={styles.input}
          value={emergencyContactName}
          onChangeText={setEmergencyContactName}
          editable={!isSubmitting}
          placeholder="Emergency contact name"
          placeholderTextColor={COLORS.textDisabled}
        />

        <Text style={styles.label}>Emergency Contact Relationship</Text>
        <TextInput
          style={styles.input}
          value={emergencyContactRelationship}
          onChangeText={setEmergencyContactRelationship}
          editable={!isSubmitting}
          placeholder="Relationship"
          placeholderTextColor={COLORS.textDisabled}
        />

        <Text style={styles.label}>Emergency Contact Phone</Text>
        <TextInput
          style={styles.input}
          value={emergencyContactPhone}
          onChangeText={setEmergencyContactPhone}
          editable={!isSubmitting}
          placeholder="Emergency contact phone"
          keyboardType="phone-pad"
          placeholderTextColor={COLORS.textDisabled}
        />

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
    marginBottom: 14,
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
    marginBottom: 14,
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
    marginBottom: 14,
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
    marginBottom: 24,
  },
});

export default ProfileCreationScreen;
