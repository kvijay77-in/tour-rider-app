/**
 * Login screen — email/password authentication.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { COLORS, REMEMBERED_CREDENTIALS_KEY } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { PasswordInput } from '../../components/common/PasswordInput';
import { isValidEmail, isNotEmpty } from '../../utils/validation';
import { logger } from '../../utils/logger';
import type { AuthStackParamList } from '../../types/navigation';

const TAG = 'LoginScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const {
    login,
    error,
    notice,
    isAuthenticating,
    pendingAuthChallenge,
    cancelPendingAuthChallenge,
  } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const challengeAlertShownRef = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadRememberedCredentials = async () => {
      try {
        const rawValue = await SecureStore.getItemAsync(REMEMBERED_CREDENTIALS_KEY);
        if (!rawValue || !isMounted) {
          return;
        }

        const credentials = JSON.parse(rawValue) as { email?: string; password?: string };
        if (credentials.email && credentials.password) {
          setEmail(credentials.email);
          setPassword(credentials.password);
          setRememberMe(true);
        }
      } catch (error) {
        logger.warn(TAG, 'Failed to load remembered credentials', error);
      }
    };

    loadRememberedCredentials().catch((error) => {
      logger.warn(TAG, 'Remembered credentials loading failed', error);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingAuthChallenge || challengeAlertShownRef.current) {
      if (!pendingAuthChallenge) {
        challengeAlertShownRef.current = false;
      }
      return;
    }

    challengeAlertShownRef.current = true;
    Alert.alert(
      'Password Change Required',
      'Password change has been enforced. Change password to login.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            void (async () => {
              await cancelPendingAuthChallenge();
              setEmail('');
              setPassword('');
              setRememberMe(false);
              setValidationError(null);
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            })();
          },
        },
        {
          text: 'OK',
          onPress: () => {
            navigation.navigate('EnforcedPasswordChange', {
              email: pendingAuthChallenge.email,
            });
          },
        },
      ],
      { cancelable: false },
    );
  }, [pendingAuthChallenge, cancelPendingAuthChallenge, navigation]);

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

  const handleLogin = async () => {
    setValidationError(null);

    if (!isValidEmail(email)) {
      setValidationError('Please enter a valid email address.');
      return;
    }
    if (!isNotEmpty(password)) {
      setValidationError('Please enter your password.');
      return;
    }

    try {
      const authenticatedUser = await login(email.trim(), password);
      if (!authenticatedUser) {
        return;
      }

      if (rememberMe) {
        // Accepted tradeoff: credentials are persisted in SecureStore for convenience.
        await SecureStore.setItemAsync(
          REMEMBERED_CREDENTIALS_KEY,
          JSON.stringify({ email: email.trim(), password }),
        );
      } else {
        await SecureStore.deleteItemAsync(REMEMBERED_CREDENTIALS_KEY);
      }

      logger.info(TAG, 'Login successful');
    } catch {
      // Error is handled by AuthContext and exposed via `error`
      logger.debug(TAG, 'Login attempt failed');
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
          <View style={styles.header}>
            <Text style={styles.appTitle}>Tour Rider</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          {notice && !displayError ? (
            <View style={styles.noticeContainer} accessibilityRole="alert">
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {displayError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

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
              placeholder="Enter your password"
              placeholderTextColor={COLORS.textDisabled}
              autoComplete="password"
              textContentType="password"
              editable={!isAuthenticating}
              accessibilityLabel="Password"
              onFocus={() => scrollInputIntoView(passwordInputRef)}
            />

            <TouchableOpacity
              style={styles.rememberMeRow}
              onPress={() => setRememberMe((previousValue) => !previousValue)}
              disabled={isAuthenticating}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe, disabled: isAuthenticating }}
            >
              <Ionicons
                name={rememberMe ? 'checkbox-outline' : 'square-outline'}
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.rememberMeText}>Remember Me</Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isAuthenticating}
              disabled={isAuthenticating}
            />
          </View>

          <View style={styles.links}>
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={isAuthenticating}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('SignUp')}
              disabled={isAuthenticating}
              accessibilityRole="link"
            >
              <Text style={styles.linkText}>Create an Account</Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
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
  noticeContainer: {
    backgroundColor: COLORS.success,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  noticeText: {
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
    gap: 12,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  rememberMeText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  linkText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default LoginScreen;
