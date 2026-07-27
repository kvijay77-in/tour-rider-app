/**
 * Sign-up screen — two-step registration (form → verification code).
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
import { PasswordInput } from '../../components/common/PasswordInput';
import {
  isValidEmail,
  isValidPassword,
  getPasswordErrors,
  isNotEmpty,
} from '../../utils/validation';
import { linkCognitoUser } from '../../services/api/riderApi';
import { logger } from '../../utils/logger';
import type { AuthStackParamList } from '../../types/navigation';

const TAG = 'SignUpScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

type Step = 'registration' | 'verification';

export function SignUpScreen({ navigation }: Props) {
  const {
    signUp,
    confirmSignUpCode,
    login,
    setLinkedProfileId,
    setPostLoginRedirect,
    error,
    isAuthenticating,
  } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const verificationCodeInputRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>('registration');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Registration fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Verification field
  const [verificationCode, setVerificationCode] = useState('');

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

  const validateRegistration = (): boolean => {
    if (!isValidEmail(email)) {
      setValidationError('Please enter a valid email address.');
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
      const wasSignedUp = await signUp(email.trim(), password);
      if (!wasSignedUp) {
        return;
      }

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
      const normalizedEmail = email.trim();
      await confirmSignUpCode(normalizedEmail, verificationCode.trim());

      const authUser = await login(normalizedEmail, password, {
        skipProfileLookup: true,
      });
      if (!authUser) {
        return;
      }

      const linkResponse = await linkCognitoUser(authUser.userId);
      const linkedProfileId = linkResponse.data?.profileId;

      if (linkedProfileId) {
        setLinkedProfileId(linkedProfileId);
      }

      setPostLoginRedirect('ProfileCreation');

      logger.info(TAG, 'Account verified and linked successfully');
    } catch {
      logger.debug(TAG, 'Verification attempt failed');
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
            {step === 'registration' ? 'Create Account' : 'Verify Email'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'registration'
              ? 'Enter your email and password to create your account'
              : `Enter the verification code sent to ${email}`}
          </Text>

          {displayError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {step === 'registration' ? (
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

              <Text style={styles.label}>Password</Text>
              <PasswordInput
                ref={passwordInputRef}
                value={password}
                onChangeText={setPassword}
                placeholder="Min 8 chars, uppercase, lowercase, number"
                placeholderTextColor={COLORS.textDisabled}
                textContentType="newPassword"
                editable={!isAuthenticating}
                accessibilityLabel="Password"
                onFocus={() => scrollInputIntoView(passwordInputRef)}
              />

              <Text style={styles.label}>Confirm Password</Text>
              <PasswordInput
                ref={confirmPasswordInputRef}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.textDisabled}
                textContentType="newPassword"
                editable={!isAuthenticating}
                accessibilityLabel="Confirm password"
                onFocus={() => scrollInputIntoView(confirmPasswordInputRef)}
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
                ref={verificationCodeInputRef}
                style={styles.input}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="Enter 6-digit code"
                placeholderTextColor={COLORS.textDisabled}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                editable={!isAuthenticating}
                accessibilityLabel="Verification code"
                onFocus={() => scrollInputIntoView(verificationCodeInputRef)}
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
