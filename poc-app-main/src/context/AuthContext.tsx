/**
 * Auth Context — manages Cognito authentication state.
 *
 * Provides login, sign-out, and session state to the entire app.
 * Wires the JWT access token into apiClient for authenticated API calls.
 *
 * See docs/SolutionDesign.md § Authentication.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signIn,
  signOut,
  fetchAuthSession,
  confirmSignIn,
  getCurrentUser,
} from 'aws-amplify/auth';
import { setAuthTokenProvider, setAuthInvalidatedCallback } from '../services/api/apiClient';
import { UserRole } from '../types/models';
import { logger } from '../utils/logger';

const TAG = 'AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  username: string;
  userId: string;
  /** Role resolved from Cognito User Group membership */
  userRole: UserRole;
}

interface AuthContextValue {
  /** The authenticated user, or null if not logged in */
  user: AuthUser | null;
  /** True while checking for an existing session at startup */
  isLoading: boolean;
  /** True when a login or sign-out operation is in progress */
  isAuthenticating: boolean;
  /** Error message from the last auth operation */
  error: string | null;
  /**
   * Sign in with username and password.
   * Returns 'DONE' on success, 'NEW_PASSWORD_REQUIRED' if the user must change their temp password.
   */
  login: (username: string, password: string) => Promise<'DONE' | 'NEW_PASSWORD_REQUIRED'>;
  /** Complete the new-password challenge (first login with temp password) */
  completeNewPassword: (newPassword: string) => Promise<void>;
  /** Sign out and clear session */
  logout: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticating: false,
  error: null,
  login: async () => 'DONE',
  completeNewPassword: async () => {},
  logout: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
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

  /**
   * Resolve the user's role from Cognito User Group membership.
   *
   * Reads `cognito:groups` from the ID token payload. If the user belongs
   * to multiple groups, the first matching UserRole (by enum order) wins.
   * Returns `null` if no recognised role group is found.
   *
   * Accepts an optional pre-fetched session to avoid a redundant
   * fetchAuthSession() call when the caller already has one.
   */
  const resolveUserRole = useCallback(async (
    existingSession?: Awaited<ReturnType<typeof fetchAuthSession>>,
  ): Promise<UserRole | null> => {
    try {
      const session = existingSession ?? await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload;
      const groups: string[] = (payload?.['cognito:groups'] as string[] | undefined) ?? [];
      const validRoles = Object.values(UserRole) as string[];
      const matchedRole = groups.find((g) => validRoles.includes(g));
      if (matchedRole) {
        logger.info(TAG, `Resolved role from group: ${matchedRole}`);
        return matchedRole as UserRole;
      }
      logger.warn(TAG, `No recognised UserRole group found (groups: ${JSON.stringify(groups)})`);
      return null;
    } catch (err) {
      logger.warn(TAG, 'Failed to resolve user role from token', err);
      return null;
    }
  }, []);

  /** Sign out and show a "no role assigned" error. */
  const handleNoRole = useCallback(async () => {
    logger.warn(TAG, 'User has no role assigned — signing out');
    await signOut().catch(() => {});
    setUser(null);
    setError('No role has been assigned to your account. Please contact your tour administrator.');
  }, []);

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
      signOut().catch(() => {});
      setUser(null);
      setError('Your session has expired. Please sign in again.');
    });
  }, []);

  // Check for existing session on mount — validate against Cognito, not just local cache.
  // This catches cases where the user was signed out server-side (e.g. from Cognito console).
  useEffect(() => {
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        logger.info(TAG, `Session found for ${currentUser.username}`);
        // Verify the session is still valid with Cognito by forcing a token refresh
        const session = await fetchAuthSession({ forceRefresh: true });
        if (!session.tokens?.accessToken) {
          // Token refresh failed — session is invalid
          logger.warn(TAG, 'Session invalid — no access token after forceRefresh');
          await signOut().catch(() => {});
          setUser(null);
        } else {
          const userRole = await resolveUserRole(session);
          if (!userRole) {
            await handleNoRole();
          } else {
            setUser({
              username: currentUser.username,
              userId: currentUser.userId,
              userRole,
            });
          }
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
  }, [resolveUserRole, handleNoRole]);

  const login = useCallback(async (username: string, password: string): Promise<'DONE' | 'NEW_PASSWORD_REQUIRED'> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await signIn({
        username,
        password,
        options: { authFlowType: 'USER_PASSWORD_AUTH' },
      });

      if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        // User must set a new password (first login with temp password)
        return 'NEW_PASSWORD_REQUIRED';
      }

      if (result.isSignedIn) {
        const currentUser = await getCurrentUser();
        const userRole = await resolveUserRole();
        if (!userRole) {
          await handleNoRole();
          return 'DONE';
        }
        setUser({
          username: currentUser.username,
          userId: currentUser.userId,
          userRole,
        });
        return 'DONE';
      }

      // Unexpected step — treat as error
      setError(`Unexpected authentication step: ${result.nextStep.signInStep}`);
      return 'DONE';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, [resolveUserRole, handleNoRole]);

  const completeNewPassword = useCallback(async (newPassword: string): Promise<void> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await confirmSignIn({ challengeResponse: newPassword });
      if (result.isSignedIn) {
        const currentUser = await getCurrentUser();
        const userRole = await resolveUserRole();
        if (!userRole) {
          await handleNoRole();
          return;
        }
        setUser({
          username: currentUser.username,
          userId: currentUser.userId,
          userRole,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set new password.';
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, [resolveUserRole, handleNoRole]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await signOut();
    } catch {
      // Sign out locally even if the API call fails
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticating,
    error,
    login,
    completeNewPassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
