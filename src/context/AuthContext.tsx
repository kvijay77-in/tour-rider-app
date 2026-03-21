/**
 * Auth Context — manages Cognito authentication state for riders.
 *
 * Provides login, sign-up, sign-out, and session state to the entire app.
 * Wires the JWT access token into apiClient for authenticated API calls.
 *
 * This is a DEDICATED Cognito user pool for riders — no group/role checking needed.
 *
 * See docs/SolutionDesign.md § Authentication.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signIn,
  signUp,
  signOut,
  fetchAuthSession,
  getCurrentUser,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';

import { setAuthTokenProvider, setAuthInvalidatedCallback } from '../services/api/apiClient';
import { logger } from '../utils/logger';

const TAG = 'AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  /** Cognito username */
  username: string;
  /** Cognito user sub (unique identifier) */
  userId: string;
  /** Email address from Cognito attributes */
  email: string;
  /** Linked rider profile ID (from custom:profileId attribute, if set) */
  profileId?: string;
}

interface AuthContextValue {
  /** The authenticated rider, or null if not logged in */
  user: AuthUser | null;
  /** True while checking for an existing session at startup */
  isLoading: boolean;
  /** True when a login, sign-up, or sign-out operation is in progress */
  isAuthenticating: boolean;
  /** Error message from the last auth operation */
  error: string | null;
  /** Sign in with email and password */
  login: (email: string, password: string) => Promise<void>;
  /** Create a new rider account */
  signUp: (
    email: string,
    password: string,
    attributes?: Record<string, string>,
  ) => Promise<void>;
  /** Confirm sign-up with verification code */
  confirmSignUpCode: (email: string, code: string) => Promise<void>;
  /** Sign out and clear session */
  logout: () => Promise<void>;
  /** Request a password reset code */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Confirm password reset with code and new password */
  confirmPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticating: false,
  error: null,
  login: async () => {},
  signUp: async () => {},
  confirmSignUpCode: async () => {},
  logout: async () => {},
  requestPasswordReset: async () => {},
  confirmPasswordReset: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build an AuthUser from the current Cognito session.
 */
async function buildAuthUser(
  session?: Awaited<ReturnType<typeof fetchAuthSession>>,
): Promise<AuthUser> {
  const currentUser = await getCurrentUser();
  const sess = session ?? await fetchAuthSession();
  const payload = sess.tokens?.idToken?.payload;

  return {
    username: currentUser.username,
    userId: currentUser.userId,
    email: (payload?.['email'] as string) ?? currentUser.username,
    profileId: (payload?.['custom:profileId'] as string) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wire the JWT token provider into apiClient so all API calls include auth
  useEffect(() => {
    setAuthTokenProvider(async () => {
      try {
        const session = await fetchAuthSession();
        return session.tokens?.accessToken?.toString() ?? null;
      } catch {
        return null;
      }
    });

    // Register callback for unrecoverable 401 — forces re-login
    setAuthInvalidatedCallback(() => {
      logger.warn(TAG, 'Auth invalidated by 401 — forcing logout');
      signOut().catch(() => {});
      setUser(null);
      setError('Your session has expired. Please sign in again.');
    });
  }, []);

  // Check for existing session on mount — validate against Cognito
  useEffect(() => {
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        logger.info(TAG, `Session found for ${currentUser.username}`);

        // Verify the session is still valid by forcing a token refresh
        const session = await fetchAuthSession({ forceRefresh: true });
        if (!session.tokens?.accessToken) {
          logger.warn(TAG, 'Session invalid — no access token after forceRefresh');
          await signOut().catch(() => {});
          setUser(null);
        } else {
          const authUser = await buildAuthUser(session);
          setUser(authUser);
        }
      } catch {
        // No valid session — clear any stale local state and require login
        logger.info(TAG, 'No existing session — login required');
        await signOut().catch(() => {});
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await signIn({
        username: email,
        password,
        options: { authFlowType: 'USER_PASSWORD_AUTH' },
      });

      if (result.isSignedIn) {
        const authUser = await buildAuthUser();
        setUser(authUser);
        logger.info(TAG, `Login successful for ${email}`);
        return;
      }

      // Unexpected step — treat as error
      setError(`Unexpected authentication step: ${result.nextStep.signInStep}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      logger.error(TAG, 'Login failed', err);
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const handleSignUp = useCallback(async (
    email: string,
    password: string,
    attributes?: Record<string, string>,
  ): Promise<void> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            ...attributes,
          },
        },
      });
      logger.info(TAG, `Sign-up initiated for ${email}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-up failed. Please try again.';
      logger.error(TAG, 'Sign-up failed', err);
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const confirmSignUpCode = useCallback(async (email: string, code: string): Promise<void> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      logger.info(TAG, `Sign-up confirmed for ${email}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Confirmation failed. Please try again.';
      logger.error(TAG, 'Sign-up confirmation failed', err);
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await signOut();
      logger.info(TAG, 'Logout successful');
    } catch {
      // Sign out locally even if the API call fails
      logger.warn(TAG, 'Sign-out API call failed — clearing local state');
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<void> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      await resetPassword({ username: email });
      logger.info(TAG, `Password reset requested for ${email}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password reset request failed.';
      logger.error(TAG, 'Password reset request failed', err);
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const handleConfirmPasswordReset = useCallback(async (
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
      logger.info(TAG, `Password reset confirmed for ${email}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password reset confirmation failed.';
      logger.error(TAG, 'Password reset confirmation failed', err);
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticating,
    error,
    login,
    signUp: handleSignUp,
    confirmSignUpCode,
    logout,
    requestPasswordReset,
    confirmPasswordReset: handleConfirmPasswordReset,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
