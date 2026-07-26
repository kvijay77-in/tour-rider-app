/**
 * Tour registration screen — submit registration request for a tour.
 */

import React, { useRef, useState } from 'react';
import {
  findNodeHandle,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { submitTourRegistration } from '../../services/api/tourRegistrationApi';
import { logger } from '../../utils/logger';

const TAG = 'TourRegistrationScreen';

type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced';

const EXPERIENCE_LEVELS: ExperienceLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

interface RouteParams {
  tourId: string;
}

export function TourRegistrationScreen({ route, navigation }: {
  route: { params: RouteParams };
  navigation: { goBack: () => void };
}) {
  const { tourId } = route.params;
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const medicalConditionsInputRef = useRef<TextInput>(null);
  const specialRequirementsInputRef = useRef<TextInput>(null);

  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('Intermediate');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const scrollInputIntoView = (inputRef: React.RefObject<TextInput | null>) => {
    const inputNode = findNodeHandle(inputRef.current);

    if (!inputNode || !scrollViewRef.current) {
      return;
    }

    scrollViewRef.current.scrollResponderScrollNativeHandleToKeyboard(
      inputNode,
      96,
      true,
    );
  };

  const handleSubmit = async () => {
    if (!user?.profileId) {
      setError('Profile not found. Please complete your profile first.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await submitTourRegistration(tourId, {
        profileId: user.profileId,
        experienceLevel,
        medicalConditions: medicalConditions.trim() || undefined,
        specialRequirements: specialRequirements.trim() || undefined,
      });

      if (response.success) {
        setSuccess(true);
        logger.info(TAG, `Tour registration submitted for tour ${tourId}`);
      } else {
        setError(response.error?.message ?? 'Registration failed. Please try again.');
      }
    } catch (err) {
      logger.error(TAG, 'Error submitting tour registration', err);
      setError('Unable to submit registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.successTitle}>Registration Submitted!</Text>
          <Text style={styles.successText}>
            Your registration request has been submitted. The tour organizer will review and approve it.
          </Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.container}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Tour Registration</Text>
          <Text style={styles.subtitle}>Complete the form below to register for this tour.</Text>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <Text style={styles.label}>Experience Level</Text>
            <View style={styles.pickerRow}>
              {EXPERIENCE_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.pickerOption,
                    experienceLevel === level && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setExperienceLevel(level)}
                  disabled={isSubmitting}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: experienceLevel === level }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      experienceLevel === level && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Medical Conditions (optional)</Text>
            <TextInput
              ref={medicalConditionsInputRef}
              style={[styles.input, styles.textArea]}
              value={medicalConditions}
              onChangeText={setMedicalConditions}
              placeholder="Allergies, conditions, medications..."
              placeholderTextColor={COLORS.textDisabled}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isSubmitting}
              accessibilityLabel="Medical conditions"
              onFocus={() => scrollInputIntoView(medicalConditionsInputRef)}
            />

            <Text style={styles.label}>Special Requirements (optional)</Text>
            <TextInput
              ref={specialRequirementsInputRef}
              style={[styles.input, styles.textArea]}
              value={specialRequirements}
              onChangeText={setSpecialRequirements}
              placeholder="Dietary, accessibility, or other needs..."
              placeholderTextColor={COLORS.textDisabled}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isSubmitting}
              accessibilityLabel="Special requirements"
              onFocus={() => scrollInputIntoView(specialRequirementsInputRef)}
            />

            <Button
              title="Submit Registration"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
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
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.success,
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
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
  textArea: {
    minHeight: 80,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pickerOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  pickerOptionTextSelected: {
    color: COLORS.white,
  },
});

export default TourRegistrationScreen;
