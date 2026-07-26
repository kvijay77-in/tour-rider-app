/**
 * Forgot-password screen — two-step (enter email → enter code + new password).
 */

import React, { useRef, useState } from 'react';
import {
  findNodeHandle,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { isValidEmail, isNotEmpty, isValidPassword, getPasswordErrors } from '../../utils/validation';
import { logger } from '../../utils/logger';
import type { AuthStackParamList } from '../../types/navigation';

const TAG = 'ForgotPasswordScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

type Step = 'requestCode' | 'resetPassword';

export function ForgotPasswordScreen({ navigation }: Props) {
  const { requestPasswordReset, confirmPasswordReset, error, isAuthenticating } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);
  const newPasswordInputRef = useRef<TextInput>(null);
  const confirmNewPasswordInputRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>('requestCode');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

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

  const handleRequestCode = async () => {
    setValidationError(null);
    if (!isValidEmail(email)) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    try {
      await requestPasswordReset(email.trim());
      setStep('resetPassword');
      logger.info(TAG, 'Password reset code requested');
    } catch {
      logger.debug(TAG, 'Password reset request failed');
    }
  };

  const handleResetPassword = async () => {
    setValidationError(null);
    if (!isNotEmpty(code)) {
      setValidationError('Please enter the verification code.');
      return;
    }
    if (!isValidPassword(newPassword)) {
      const errors = getPasswordErrors(newPassword);
      setValidationError(errors[0] ?? 'Invalid password.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    try {
      await confirmPasswordReset(email.trim(), code.trim(), newPassword);
      logger.info(TAG, 'Password reset successful');
      navigation.navigate('Login');
    } catch {
      logger.debug(TAG, 'Password reset confirmation failed');
    }
  };

  const displayError = validationError ?? error;

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
          <Text style={styles.title}>
            {step === 'requestCode' ? 'Forgot Password' : 'Reset Password'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'requestCode'
              ? 'Enter your email to receive a reset code'
              : `Enter the code sent to ${email} and your new password`}
          </Text>

          {displayError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {step === 'requestCode' ? (
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                ref={emailInputRef}
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
                onFocus={() => scrollInputIntoView(emailInputRef)}
              />

              <Button
                title="Send Reset Code"
                onPress={handleRequestCode}
                loading={isAuthenticating}
                disabled={isAuthenticating}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                ref={codeInputRef}
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Enter 6-digit code"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                editable={!isAuthenticating}
                accessibilityLabel="Verification code"
                onFocus={() => scrollInputIntoView(codeInputRef)}
              />

              <Text style={styles.label}>New Password</Text>
              <TextInput
                ref={newPasswordInputRef}
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Min 8 chars, uppercase, lowercase, number"
                placeholderTextColor={COLORS.textDisabled}
                secureTextEntry
                textContentType="newPassword"
                editable={!isAuthenticating}
                accessibilityLabel="New password"
                onFocus={() => scrollInputIntoView(newPasswordInputRef)}
              />

              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                ref={confirmNewPasswordInputRef}
                style={styles.input}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder="Re-enter your new password"
                placeholderTextColor={COLORS.textDisabled}
                secureTextEntry
                textContentType="newPassword"
                editable={!isAuthenticating}
                accessibilityLabel="Confirm new password"
                onFocus={() => scrollInputIntoView(confirmNewPasswordInputRef)}
              />

              <Button
                title="Reset Password"
                onPress={handleResetPassword}
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
              <Text style={styles.linkText}>Back to Sign In</Text>
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
    justifyContent: 'center',
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

export default ForgotPasswordScreen;
