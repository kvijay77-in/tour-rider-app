/**
 * Enforced password change screen for Cognito NEW_PASSWORD_REQUIRED challenge.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS } from '../../constants';
import { Button } from '../../components/common/Button';
import { PasswordInput } from '../../components/common/PasswordInput';
import { useAuth } from '../../hooks/useAuth';
import { getPasswordErrors, isValidPassword } from '../../utils/validation';
import { logger } from '../../utils/logger';
import type { AuthStackParamList } from '../../types/navigation';

const TAG = 'EnforcedPasswordChangeScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'EnforcedPasswordChange'>;

export function EnforcedPasswordChangeScreen({ navigation, route }: Props) {
  const {
    completeNewPasswordChallenge,
    cancelPendingAuthChallenge,
    pendingAuthChallenge,
    error,
    isAuthenticating,
  } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const email = useMemo(
    () => route.params?.email ?? pendingAuthChallenge?.email,
    [route.params?.email, pendingAuthChallenge?.email],
  );

  const handleSubmit = async () => {
    setValidationError(null);

    if (!isValidPassword(newPassword)) {
      const passwordErrors = getPasswordErrors(newPassword);
      setValidationError(passwordErrors[0] ?? 'New password is invalid.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('New password and confirm password do not match.');
      return;
    }

    const authenticatedUser = await completeNewPasswordChallenge(newPassword);
    if (authenticatedUser) {
      logger.info(TAG, 'Enforced password change completed');
    }
  };

  const handleCancel = async () => {
    await cancelPendingAuthChallenge();
    setNewPassword('');
    setConfirmPassword('');
    setValidationError(null);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
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
          <Text style={styles.subtitle}>Password change has been enforced.</Text>
          <Text style={styles.helpText}>Use your temporary password to sign in, then set a new password.</Text>
          {email ? <Text style={styles.emailText}>Account: {email}</Text> : null}

          {displayError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
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

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                void handleCancel();
              }}
              disabled={isAuthenticating}
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  emailText: {
    fontSize: 13,
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
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 10,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EnforcedPasswordChangeScreen;
