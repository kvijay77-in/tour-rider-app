/**
 * Change password screen for authenticated riders.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants';
import { Button } from '../../components/common/Button';
import { PasswordInput } from '../../components/common/PasswordInput';
import { useAuth } from '../../hooks/useAuth';
import { getPasswordErrors, isNotEmpty, isValidPassword } from '../../utils/validation';
import { logger } from '../../utils/logger';

const TAG = 'ChangePasswordScreen';

export function ChangePasswordScreen() {
  const { changePassword, error, isAuthenticating } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setValidationError(null);
    setSuccessMessage(null);

    if (!isNotEmpty(oldPassword)) {
      setValidationError('Please enter your current password.');
      return;
    }

    if (!isValidPassword(newPassword)) {
      const passwordErrors = getPasswordErrors(newPassword);
      setValidationError(passwordErrors[0] ?? 'New password is invalid.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('New password and confirm password do not match.');
      return;
    }

    try {
      await changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Password changed successfully.');
      logger.info(TAG, 'Password changed successfully');
    } catch {
      logger.debug(TAG, 'Password change failed');
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
          contentContainerStyle={styles.container}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.subtitle}>Update your account password</Text>

          {displayError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <Text style={styles.label}>Current Password</Text>
            <PasswordInput
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Enter current password"
              placeholderTextColor={COLORS.textDisabled}
              textContentType="password"
              autoComplete="password"
              editable={!isAuthenticating}
              accessibilityLabel="Current password"
            />

            <Text style={styles.label}>New Password</Text>
            <PasswordInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Min 8 chars, uppercase, lowercase, number"
              placeholderTextColor={COLORS.textDisabled}
              textContentType="newPassword"
              editable={!isAuthenticating}
              accessibilityLabel="New password"
            />

            <Text style={styles.label}>Confirm New Password</Text>
            <PasswordInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={COLORS.textDisabled}
              textContentType="newPassword"
              editable={!isAuthenticating}
              accessibilityLabel="Confirm new password"
            />

            <Button
              title="Update Password"
              onPress={handleSubmit}
              loading={isAuthenticating}
              disabled={isAuthenticating}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
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
  successContainer: {
    backgroundColor: COLORS.success,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: COLORS.white,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default ChangePasswordScreen;
