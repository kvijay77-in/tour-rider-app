/**
 * Sign-up screen — two-step registration (form → verification code).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import {
  isValidEmail,
  isValidName,
  isValidPhone,
  isValidPassword,
  getPasswordErrors,
  isNotEmpty,
} from '../../utils/validation';
import { logger } from '../../utils/logger';
import type { AuthStackParamList } from '../../types/navigation';

const TAG = 'SignUpScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

type Step = 'registration' | 'verification';

export function SignUpScreen({ navigation }: Props) {
  const { signUp, confirmSignUpCode, error, isAuthenticating } = useAuth();

  const [step, setStep] = useState<Step>('registration');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Registration fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Verification field
  const [verificationCode, setVerificationCode] = useState('');

  const validateRegistration = (): boolean => {
    if (!isValidName(firstName)) {
      setValidationError('Please enter a valid first name (at least 2 characters).');
      return false;
    }
    if (!isValidName(lastName)) {
      setValidationError('Please enter a valid last name (at least 2 characters).');
      return false;
    }
    if (!isValidEmail(email)) {
      setValidationError('Please enter a valid email address.');
      return false;
    }
    if (phone && !isValidPhone(phone)) {
      setValidationError('Please enter a valid phone number.');
      return false;
    }
    if (!isValidPassword(password)) {
      const errors = getPasswordErrors(password);
      setValidationError(errors[0] ?? 'Invalid password.');
      return false;
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleSignUp = async () => {
    setValidationError(null);
    if (!validateRegistration()) return;

    try {
      await signUp(email.trim(), password, {
        given_name: firstName.trim(),
        family_name: lastName.trim(),
        ...(phone ? { phone_number: phone.trim() } : {}),
      });
      setStep('verification');
      logger.info(TAG, 'Sign-up initiated — verification code sent');
    } catch {
      logger.debug(TAG, 'Sign-up attempt failed');
    }
  };

  const handleVerify = async () => {
    setValidationError(null);
    if (!isNotEmpty(verificationCode)) {
      setValidationError('Please enter the verification code.');
      return;
    }

    try {
      await confirmSignUpCode(email.trim(), verificationCode.trim());
      logger.info(TAG, 'Account verified successfully');
      navigation.navigate('Login');
    } catch {
      logger.debug(TAG, 'Verification attempt failed');
    }
  };

  const displayError = validationError ?? error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>
            {step === 'registration' ? 'Create Account' : 'Verify Email'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'registration'
              ? 'Fill in your details to get started'
              : `Enter the verification code sent to ${email}`}
          </Text>

          {displayError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {step === 'registration' ? (
            <View style={styles.form}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={COLORS.textDisabled}
                autoCapitalize="words"
                textContentType="givenName"
                editable={!isAuthenticating}
                accessibilityLabel="First name"
              />

              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={COLORS.textDisabled}
                autoCapitalize="words"
                textContentType="familyName"
                editable={!isAuthenticating}
                accessibilityLabel="Last name"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                editable={!isAuthenticating}
                accessibilityLabel="Email address"
              />

              <Text style={styles.label}>Phone (optional)</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 234 567 8900"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                editable={!isAuthenticating}
                accessibilityLabel="Phone number"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min 8 chars, uppercase, lowercase, number"
                placeholderTextColor={COLORS.textDisabled}
                secureTextEntry
                textContentType="newPassword"
                editable={!isAuthenticating}
                accessibilityLabel="Password"
              />

              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.textDisabled}
                secureTextEntry
                textContentType="newPassword"
                editable={!isAuthenticating}
                accessibilityLabel="Confirm password"
              />

              <Button
                title="Sign Up"
                onPress={handleSignUp}
                loading={isAuthenticating}
                disabled={isAuthenticating}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={styles.input}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="Enter 6-digit code"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                editable={!isAuthenticating}
                accessibilityLabel="Verification code"
              />

              <Button
                title="Verify"
                onPress={handleVerify}
                loading={isAuthenticating}
                disabled={isAuthenticating}
              />
            </View>
          )}

          <View style={styles.links}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={isAuthenticating}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>Already have an account? Sign In</Text>
            </TouchableOpacity>
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
  form: {
    marginBottom: 24,
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
  links: {
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default SignUpScreen;
