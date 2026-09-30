/**
 * AuthContext tests — store-reviewer routing, sign-out and account deletion.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockCalls: string[] = [];

jest.mock('aws-amplify/auth', () => ({
  signIn: jest.fn(),
  confirmSignIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  fetchAuthSession: jest.fn(),
  getCurrentUser: jest.fn(),
  confirmSignUp: jest.fn(),
  resetPassword: jest.fn(),
  confirmResetPassword: jest.fn(),
  updatePassword: jest.fn(),
}));
jest.mock('../../src/config/subscription.config', () => ({
  subscriptionConfig: { mode: 'single', organizer: null },
  isSingleSubscriptionMode: () => false,
}));
jest.mock('../../src/config/reviewAccess', () => ({
  getActiveBackendKind: jest.fn(() => 'primary'),
  isReviewSessionActive: jest.fn(async () => false),
  routeBackendForLogin: jest.fn((email: string) => { mockCalls.push(`routeForLogin:${email}`); }),
  routeBackendToPrimary: jest.fn(() => { mockCalls.push('routePrimary'); }),
  routeBackendToReview: jest.fn(() => { mockCalls.push('routeReview'); return true; }),
  setReviewSessionActive: jest.fn(async (active: boolean) => { mockCalls.push(`reviewActive:${active}`); }),
}));
jest.mock('../../src/services/api/apiClient', () => ({
  setAuthTokenProvider: jest.fn(),
  setAuthInvalidatedCallback: jest.fn(),
  ApiError: class ApiError extends Error {},
}));
jest.mock('../../src/services/api/riderApi', () => ({
  getLinkedProfileId: jest.fn(async () => ({ data: { profileId: 'P1' } })),
}));
jest.mock('../../src/services/push/pushService', () => ({
  unregisterPushTokenForCurrentUser: jest.fn(async () => { mockCalls.push('unregisterPush'); }),
}));
jest.mock('../../src/services/activeTourStore', () => ({
  clearActiveTourCache: jest.fn(async () => {}),
}));
jest.mock('../../src/services/profileConfigStore', () => ({
  clearProfileDefinitionsCache: jest.fn(async () => {}),
}));
jest.mock('../../src/services/accountDeletionService', () => ({
  ACCOUNT_DELETED_MESSAGE: 'Your account has been deleted',
  deleteCurrentAccount: jest.fn(),
}));
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { AuthProvider, useAuth } from '../../src/context/AuthContext';

const auth = jest.requireMock('aws-amplify/auth') as Record<string, jest.Mock>;
const reviewAccess = jest.requireMock('../../src/config/reviewAccess') as Record<string, jest.Mock>;
const { deleteCurrentAccount } = jest.requireMock('../../src/services/accountDeletionService') as {
  deleteCurrentAccount: jest.Mock;
};

type AuthValue = ReturnType<typeof useAuth>;

async function renderAuth(): Promise<{ current: () => AuthValue }> {
  let latest: AuthValue | null = null;
  function Probe() {
    latest = useAuth();
    return null;
  }
  await act(async () => {
    TestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  return { current: () => latest as unknown as AuthValue };
}

const SESSION = { tokens: { accessToken: { toString: () => 'token' }, idToken: { payload: { email: 'rider@example.com' } } } };

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCalls.length = 0;
    reviewAccess.getActiveBackendKind.mockReturnValue('primary');
    reviewAccess.isReviewSessionActive.mockResolvedValue(false);
    auth.getCurrentUser.mockRejectedValue(new Error('no session'));
    auth.signOut.mockImplementation(async () => { mockCalls.push('signOut'); });
    auth.fetchAuthSession.mockResolvedValue(SESSION);
  });

  function signedIn() {
    auth.getCurrentUser.mockResolvedValue({ username: 'rider-sub', userId: 'U1' });
  }

  it('routes the backend before signIn and persists the review flag', async () => {
    const ctx = await renderAuth();
    mockCalls.length = 0;
    reviewAccess.getActiveBackendKind.mockReturnValue('review');
    auth.signIn.mockImplementation(async () => {
      mockCalls.push('signIn');
      return { isSignedIn: true, nextStep: { signInStep: 'DONE' } };
    });
    signedIn();

    await act(async () => {
      await ctx.current().login('reviewer@example.com', 'pw');
    });

    expect(mockCalls.slice(0, 3)).toEqual([
      'routeForLogin:reviewer@example.com',
      'signIn',
      'reviewActive:true',
    ]);
    expect(ctx.current().user?.userId).toBe('U1');
  });

  it('signs out and retries once on UserAlreadyAuthenticatedException', async () => {
    const ctx = await renderAuth();
    mockCalls.length = 0;
    auth.signIn
      .mockRejectedValueOnce(Object.assign(new Error('already'), { name: 'UserAlreadyAuthenticatedException' }))
      .mockResolvedValueOnce({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });
    signedIn();

    await act(async () => {
      await ctx.current().login('rider@example.com', 'pw');
    });

    expect(auth.signIn).toHaveBeenCalledTimes(2);
    expect(mockCalls).toContain('signOut');
    expect(mockCalls).toContain('reviewActive:false');
  });

  it('routes sign-up, confirmation and password reset to the primary pool', async () => {
    const ctx = await renderAuth();

    await act(async () => {
      await ctx.current().signUp('new@example.com', 'pw');
      await ctx.current().confirmSignUpCode('new@example.com', '123456');
      await ctx.current().requestPasswordReset('new@example.com');
      await ctx.current().confirmPasswordReset('new@example.com', '123456', 'pw2');
    });

    expect(reviewAccess.routeBackendToPrimary.mock.invocationCallOrder[0])
      .toBeLessThan(auth.signUp.mock.invocationCallOrder[0]);
    expect(reviewAccess.routeBackendToPrimary.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(reviewAccess.routeBackendForLogin).not.toHaveBeenCalled();
  });

  it('applies the Review profile before restoring a reviewer session', async () => {
    reviewAccess.isReviewSessionActive.mockResolvedValue(true);
    auth.getCurrentUser.mockImplementation(async () => {
      mockCalls.push('getCurrentUser');
      return { username: 'reviewer', userId: 'R1' };
    });

    const ctx = await renderAuth();

    expect(mockCalls.indexOf('routeReview')).toBeLessThan(mockCalls.indexOf('getCurrentUser'));
    expect(ctx.current().user?.userId).toBe('R1');
  });

  it('logout unregisters push, signs out, clears review flag, then routes to primary', async () => {
    signedIn();
    const ctx = await renderAuth();
    mockCalls.length = 0;

    await act(async () => {
      await ctx.current().logout();
    });

    expect(mockCalls).toEqual(['unregisterPush', 'signOut', 'reviewActive:false', 'routePrimary']);
    expect(ctx.current().user).toBeNull();
  });

  it('deleteAccount clears the session and shows the deleted notice', async () => {
    signedIn();
    const ctx = await renderAuth();
    deleteCurrentAccount.mockResolvedValue(undefined);

    await act(async () => {
      await ctx.current().deleteAccount('pw');
    });

    expect(deleteCurrentAccount).toHaveBeenCalledWith('rider-sub', 'pw');
    expect(ctx.current().user).toBeNull();
    expect(ctx.current().notice).toBe('Your account has been deleted');
  });

  it('deleteAccount keeps the session when deletion fails', async () => {
    signedIn();
    const ctx = await renderAuth();
    deleteCurrentAccount.mockRejectedValue(new Error('boom'));

    await act(async () => {
      await expect(ctx.current().deleteAccount('pw')).rejects.toThrow('boom');
    });

    expect(ctx.current().user?.userId).toBe('U1');
    expect(ctx.current().notice).toBeNull();
  });
});
