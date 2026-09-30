/**
 * Auth Context — manages Cognito authentication state for riders.
 *
 * Provides login, sign-up, sign-out, and session state to the entire app.
 * Wires the JWT access token into apiClient for authenticated API calls.
 *
 * Supports two subscription modes:
 * - Single-subscription mode: Users directly sign up/login without invitation code
 * - Multi-subscription mode: Users must provide invitation code to identify organizer
 *
 * See docs/SolutionDesign.md § Authentication.
 * See docs/design-signup-approach.md for multi-organizer support details.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signIn,
  confirmSignIn,
  signUp,
  signOut,
  fetchAuthSession,
  getCurrentUser,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
  updatePassword,
} from 'aws-amplify/auth';

import { setAuthTokenProvider, setAuthInvalidatedCallback } from '../services/api/apiClient';
import { ApiError } from '../services/api/apiClient';
import { getLinkedProfileId } from '../services/api/riderApi';
import { unregisterPushTokenForCurrentUser } from '../services/push/pushService';
import { clearActiveTourCache } from '../services/activeTourStore';
import { clearProfileDefinitionsCache } from '../services/profileConfigStore';
import {
  ACCOUNT_DELETED_MESSAGE,
  deleteCurrentAccount,
} from '../services/accountDeletionService';
import { logger } from '../utils/logger';
import {
  subscriptionConfig,
  isSingleSubscriptionMode,
  type OrganizerConfig
} from '../config/subscription.config';
import {
  getActiveBackendKind,
  isReviewSessionActive,
  routeBackendForLogin,
  routeBackendToPrimary,
  routeBackendToReview,
  setReviewSessionActive,
} from '../config/reviewAccess';

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
  /** Linked rider profile ID resolved via riders/link endpoint */
  profileId?: string;
}

interface LoginOptions {
  /**
   * Skip linked-profile lookup during login bootstrap.
   * Used by sign-up verification flow before link creation is complete.
   */
  skipProfileLookup?: boolean;
}

interface PendingAuthChallenge {
  step: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED';
  email: string;
}

interface NamedError {
  name?: string;
  code?: string;
  message?: string;
}

type PostLoginRedirect = 'ProfileCreation' | null;

interface AuthContextValue {
  /** The authenticated rider, or null if not logged in */
  user: AuthUser | null;
  /** Organizer information (pre-configured in single-subscription mode, or dynamically set in multi mode) */
  organizer: OrganizerConfig | null;
  /** True while checking for an existing session at startup */
  isLoading: boolean;
  /** True when a login, sign-up, or sign-out operation is in progress */
  isAuthenticating: boolean;
  /** Error message from the last auth operation */
  error: string | null;
  /** Informational message for the login screen (e.g. account deleted) */
  notice: string | null;
  /** Sign in with email and password */
  login: (email: string, password: string, options?: LoginOptions) => Promise<AuthUser | null>;
  /** Cognito challenge state for auth steps that require user input */
  pendingAuthChallenge: PendingAuthChallenge | null;
  /** Complete Cognito NEW_PASSWORD_REQUIRED challenge */
  completeNewPasswordChallenge: (newPassword: string, options?: LoginOptions) => Promise<AuthUser | null>;
  /** Cancel and clear pending sign-in challenge state */
  cancelPendingAuthChallenge: () => Promise<void>;
  /** Create a new rider account */
  signUp: (
    email: string,
    password: string,
    attributes?: Record<string, string>,
  ) => Promise<boolean>;
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
  /** Change password for currently authenticated user */
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  /**
   * Re-authenticate with the password and delete the rider's Cognito account.
   * Backend data is not changed. Throws AccountDeletionError on failure and
   * keeps the session.
   */
  deleteAccount: (password: string) => Promise<void>;
  /** Update linked profile ID on the current user state */
  setLinkedProfileId: (profileId?: string) => void;
  /** Post-login route used for one-time redirects after auth transitions */
  postLoginRedirect: PostLoginRedirect;
  /** Set one-time post-login redirect route */
  setPostLoginRedirect: (route: PostLoginRedirect) => void;
  /** Clear one-time post-login redirect route */
  clearPostLoginRedirect: () => void;
  /** Set organizer configuration dynamically (multi-subscription mode) */
  setOrganizerConfig: (config: OrganizerConfig) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue>({
  user: null,
  organizer: null,
  isLoading: true,
  isAuthenticating: false,
  error: null,
  notice: null,
  login: async () => {
    throw new Error('AuthContext not initialized');
  },
  pendingAuthChallenge: null,
  completeNewPasswordChallenge: async () => {
    throw new Error('AuthContext not initialized');
  },
  cancelPendingAuthChallenge: async () => {},
  signUp: async () => false,
  confirmSignUpCode: async () => {},
  logout: async () => {},
  requestPasswordReset: async () => {},
  confirmPasswordReset: async () => {},
  changePassword: async () => {},
  deleteAccount: async () => {
    throw new Error('AuthContext not initialized');
  },
  setLinkedProfileId: () => {},
  postLoginRedirect: null,
  setPostLoginRedirect: () => {},
  clearPostLoginRedirect: () => {},
  setOrganizerConfig: () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

function isUserAlreadyExistsError(error: unknown): boolean {
  const maybeError = error as NamedError;
  return maybeError?.name === 'UsernameExistsException' || maybeError?.code === 'UsernameExistsException';
}

function isInvalidCredentialsError(error: unknown): boolean {
  const maybeError = error as NamedError;
  return maybeError?.name === 'NotAuthorizedException' || maybeError?.code === 'NotAuthorizedException';
}

function isUserNotFoundError(error: unknown): boolean {
  const maybeError = error as NamedError;
  return maybeError?.name === 'UserNotFoundException' || maybeError?.code === 'UserNotFoundException';
}

function isUserAlreadyAuthenticatedError(error: unknown): boolean {
  const maybeError = error as NamedError;
  return maybeError?.name === 'UserAlreadyAuthenticatedException'
    || maybeError?.code === 'UserAlreadyAuthenticatedException';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build an AuthUser from the current Cognito session.
 */
async function resolveProfileIdForUser(sub: string): Promise<string | undefined> {
  try {
    const response = await getLinkedProfileId(sub);
    return response.data?.profileId;
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) {
      logger.info(TAG, `No linked profile found for Cognito user ${sub}`);
      return undefined;
    }

    logger.warn(TAG, `Failed to resolve linked profile for Cognito user ${sub}`, err);
    return undefined;
  }
}

async function buildAuthUser(
  session?: Awaited<ReturnType<typeof fetchAuthSession>>,
  options: LoginOptions = {},
): Promise<AuthUser> {
  const currentUser = await getCurrentUser();
  const sess = session ?? await fetchAuthSession();
  const payload = sess.tokens?.idToken?.payload;
  const profileId = options.skipProfileLookup
    ? undefined
    : await resolveProfileIdForUser(currentUser.userId);

  return {
    username: currentUser.username,
    userId: currentUser.userId,
    email: (payload?.['email'] as string) ?? currentUser.username,
    profileId,
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
  const [organizer, setOrganizer] = useState<OrganizerConfig | null>(
    // Initialize with pre-configured organizer in single-subscription mode
    isSingleSubscriptionMode() ? subscriptionConfig.organizer ?? null : null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAuthChallenge, setPendingAuthChallenge] = useState<PendingAuthChallenge | null>(null);
  const [postLoginRedirect, setPostLoginRedirect] = useState<PostLoginRedirect>(null);

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
      logger.info(TAG, 'Auth invalidated by 401 — resetting session to login flow');
      signOut().catch(() => {});
      setUser(null);
      setError('Your session has expired. Please sign in again.');
    });
  }, []);

  // Log organizer info at startup
  useEffect(() => {
    if (organizer) {
      const organizerLabel = organizer.organizerName ?? organizer.organizerId ?? 'configured organizer';
      logger.info(
        TAG,
        `Running with organizer: ${organizerLabel}`,
      );
    }
  }, [organizer]);

  // Check for existing session on mount — validate against Cognito
  useEffect(() => {
    (async () => {
      try {
        // A reviewer session lives in the Review (Dev) pool — select it before
        // reading the stored session so Amplify looks up the right tokens.
        if (await isReviewSessionActive()) {
          if (!routeBackendToReview()) {
            await setReviewSessionActive(false);
          }
        }

        const currentUser = await getCurrentUser();
        logger.info(TAG, `Session found for ${currentUser.username}`);

        // Read the current session; if token is missing, fall back to login flow.
        const session = await fetchAuthSession();
        if (!session.tokens?.accessToken) {
          logger.info(TAG, 'Session invalid — no access token found, starting fresh login flow');
          await signOut().catch(() => {});
          await setReviewSessionActive(false);
          routeBackendToPrimary();
          setUser(null);
        } else {
          const authUser = await buildAuthUser(session);
          setUser(authUser);
        }
      } catch {
        // No valid session — clear any stale local state and require login
        logger.info(TAG, 'No existing session — login required');
        await signOut().catch(() => {});
        await setReviewSessionActive(false);
        routeBackendToPrimary();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setOrganizerConfig = useCallback((config: OrganizerConfig) => {
    setOrganizer(config);
    logger.info(TAG, `Organizer config updated: ${config.organizerName ?? config.organizerId ?? 'configured organizer'}`);
  }, []);

  const login = useCallback(async (
    email: string,
    password: string,
    options: LoginOptions = {},
  ): Promise<AuthUser | null> => {
    setIsAuthenticating(true);
    setError(null);
    setNotice(null);
    try {
      routeBackendForLogin(email);

      const attemptSignIn = () => signIn({
        username: email,
        password,
        options: { authFlowType: 'USER_PASSWORD_AUTH' },
      });

      let result: Awaited<ReturnType<typeof signIn>>;
      try {
        result = await attemptSignIn();
      } catch (signInError) {
        if (!isUserAlreadyAuthenticatedError(signInError)) {
          throw signInError;
        }
        logger.info(TAG, 'Stale session found during sign-in — signing out and retrying once');
        await signOut().catch(() => {});
        result = await attemptSignIn();
      }

      if (result.isSignedIn) {
        await setReviewSessionActive(getActiveBackendKind() === 'review');
        const authUser = await buildAuthUser(undefined, options);
        setUser(authUser);
        setPendingAuthChallenge(null);
        setPostLoginRedirect(null);
        logger.info(TAG, `Login successful for ${email}`);
        return authUser;
      }

      if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setPendingAuthChallenge({
          step: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED',
          email: email.trim(),
        });
        setError(null);
        logger.info(TAG, `Password change required for ${email}`);
        return null;
      }

      // Unexpected step — surface to UI without throwing
      const message = `Unexpected authentication step: ${result.nextStep.signInStep}`;
      setError(message);
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';

      if (isInvalidCredentialsError(err) || isUserNotFoundError(err)) {
        setError(message);
        return null;
      }

      logger.error(TAG, 'Login failed', err);
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const completeNewPasswordChallenge = useCallback(async (
    newPassword: string,
    options: LoginOptions = {},
  ): Promise<AuthUser | null> => {
    setIsAuthenticating(true);
    setError(null);

    if (!pendingAuthChallenge || pendingAuthChallenge.step !== 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      setIsAuthenticating(false);
      setError('Password change session has expired. Please sign in again.');
      return null;
    }

    try {
      routeBackendForLogin(pendingAuthChallenge.email);
      const result = await confirmSignIn({ challengeResponse: newPassword });

      if (!result.isSignedIn) {
        const message = `Unexpected authentication step: ${result.nextStep.signInStep}`;
        setError(message);
        return null;
      }

      await setReviewSessionActive(getActiveBackendKind() === 'review');

      const authUser = await buildAuthUser(undefined, options);
      setUser(authUser);
      setPendingAuthChallenge(null);
      setPostLoginRedirect(null);
      logger.info(TAG, `Password challenge completed for ${pendingAuthChallenge.email}`);
      return authUser;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password change failed. Please try again.';
      setError(message);
      logger.error(TAG, 'Password challenge completion failed', err);
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, [pendingAuthChallenge]);

  const cancelPendingAuthChallenge = useCallback(async (): Promise<void> => {
    try {
      await signOut();
    } catch {
      logger.warn(TAG, 'Challenge cancel sign-out failed — clearing local state');
    } finally {
      setUser(null);
      setError(null);
      setPostLoginRedirect(null);
      setPendingAuthChallenge(null);
    }
  }, []);

  const handleSignUp = useCallback(async (
    email: string,
    password: string,
    attributes?: Record<string, string>,
  ): Promise<boolean> => {
    setIsAuthenticating(true);
    setError(null);
    setNotice(null);
    try {
      // Sign-up always goes to the primary pool (never the Review pool).
      routeBackendToPrimary();
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
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-up failed. Please try again.';

      if (isUserAlreadyExistsError(err)) {
        setError(message);
        return false;
      }

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
      routeBackendToPrimary();
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
      await unregisterPushTokenForCurrentUser();
      await signOut();
      logger.info(TAG, 'Logout successful');
    } catch {
      // Sign out locally even if the API call fails
      logger.warn(TAG, 'Sign-out API call failed — clearing local state');
    } finally {
      await setReviewSessionActive(false);
      routeBackendToPrimary();
      await clearActiveTourCache();
      await clearProfileDefinitionsCache();
      setUser(null);
      setError(null);
      setPostLoginRedirect(null);
      setPendingAuthChallenge(null);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<void> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      routeBackendToPrimary();
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
      routeBackendToPrimary();
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

  const changePassword = useCallback(async (
    oldPassword: string,
    newPassword: string,
  ): Promise<void> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      await updatePassword({ oldPassword, newPassword });
      logger.info(TAG, 'Password changed successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password change failed.';
      logger.error(TAG, 'Password change failed', err);
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const deleteAccount = useCallback(async (password: string): Promise<void> => {
    if (!user) {
      throw new Error('You must be signed in to delete your account.');
    }

    // Throws AccountDeletionError and keeps the session on failure.
    await deleteCurrentAccount(user.username, password);

    routeBackendToPrimary();
    setUser(null);
    setError(null);
    setPostLoginRedirect(null);
    setPendingAuthChallenge(null);
    setNotice(ACCOUNT_DELETED_MESSAGE);
    logger.info(TAG, 'Account deleted — returned to login');
  }, [user]);

  const setLinkedProfileId = useCallback((profileId?: string) => {
    setUser((previousUser) => {
      if (!previousUser) {
        return previousUser;
      }

      return {
        ...previousUser,
        profileId,
      };
    });
  }, []);

  const clearPostLoginRedirect = useCallback(() => {
    setPostLoginRedirect(null);
  }, []);

  const value: AuthContextValue = {
    user,
    organizer,
    isLoading,
    isAuthenticating,
    error,
    notice,
    login,
    pendingAuthChallenge,
    completeNewPasswordChallenge,
    cancelPendingAuthChallenge,
    signUp: handleSignUp,
    confirmSignUpCode,
    logout,
    requestPasswordReset,
    confirmPasswordReset: handleConfirmPasswordReset,
    changePassword,
    deleteAccount,
    setLinkedProfileId,
    postLoginRedirect,
    setPostLoginRedirect,
    clearPostLoginRedirect,
    setOrganizerConfig,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
