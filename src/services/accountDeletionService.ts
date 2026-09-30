/**
 * Rider account deletion (Apple App Store Guideline 5.1.1(v)).
 *
 * Deletes the rider's Cognito user only. Backend rider data (profile, tour
 * enrolments, check-ins) is NOT changed; backend PII deletion is a follow-up.
 *
 * Sequence:
 * 1. Re-authenticate with the rider's password against the active Cognito
 *    pool. This also proves the device is online; if it is not, nothing else
 *    happens.
 * 2. Unregister the push token.
 * 3. deleteUser() from aws-amplify/auth.
 * 4. Clear local data: Remember-Me credentials, review.active, active tour,
 *    profile definitions and tour history caches.
 *
 * If step 3 fails the session is kept, push registration is restored
 * (best effort) and the error is surfaced.
 *
 * See docs/design/app-variants-and-environments.md § Delete my account.
 */

import { Amplify } from 'aws-amplify';
import { deleteUser } from 'aws-amplify/auth';
import * as SecureStore from 'expo-secure-store';

import { REMEMBERED_CREDENTIALS_KEY } from '../constants/storageKeys';
import { setReviewSessionActive } from '../config/reviewAccess';
import { logger } from '../utils/logger';
import { clearActiveTourCache } from './activeTourStore';
import { clearProfileDefinitionsCache } from './profileConfigStore';
import { clearTourHistoryCache } from './tourHistoryStore';
import {
  registerPushTokenForCurrentUser,
  unregisterPushTokenForCurrentUser,
} from './push/pushService';

const TAG = 'AccountDeletion';
const REAUTH_TIMEOUT_MS = 15_000;

export const OFFLINE_DELETE_MESSAGE = 'You need to be online to delete your account';
export const ACCOUNT_DELETED_MESSAGE = 'Your account has been deleted';

export type AccountDeletionErrorCode = 'OFFLINE' | 'INVALID_PASSWORD' | 'FAILED';

export class AccountDeletionError extends Error {
  constructor(message: string, public readonly code: AccountDeletionErrorCode) {
    super(message);
    this.name = 'AccountDeletionError';
  }
}

interface CognitoTarget {
  endpoint: string;
  clientId: string;
}

function getActiveCognitoTarget(): CognitoTarget {
  const cognito = Amplify.getConfig().Auth?.Cognito;
  const userPoolId = cognito?.userPoolId ?? '';
  const clientId = cognito?.userPoolClientId ?? '';
  const region = userPoolId.split('_')[0];

  if (!userPoolId || !clientId || !region) {
    throw new AccountDeletionError('Authentication is not configured.', 'FAILED');
  }

  return { endpoint: `https://cognito-idp.${region}.amazonaws.com/`, clientId };
}

async function callCognito(
  target: CognitoTarget,
  action: 'InitiateAuth' | 'RevokeToken',
  body: Record<string, unknown>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REAUTH_TIMEOUT_MS);
  try {
    return await fetch(target.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verify the rider's password against the active Cognito pool without
 * touching the current Amplify session. Any tokens returned are revoked
 * immediately and never stored.
 *
 * @throws AccountDeletionError with code OFFLINE or INVALID_PASSWORD
 */
export async function reauthenticate(username: string, password: string): Promise<void> {
  const target = getActiveCognitoTarget();

  let response: Response;
  try {
    response = await callCognito(target, 'InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: target.clientId,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    });
  } catch (error) {
    logger.warn(TAG, 'Re-authentication request failed (offline?)', error);
    throw new AccountDeletionError(OFFLINE_DELETE_MESSAGE, 'OFFLINE');
  }

  const body = (await response.json().catch(() => ({}))) as {
    __type?: string;
    AuthenticationResult?: { RefreshToken?: string };
  };

  if (!response.ok) {
    const type = body.__type ?? '';
    if (type.includes('NotAuthorizedException') || type.includes('UserNotFoundException')) {
      throw new AccountDeletionError('Incorrect password. Please try again.', 'INVALID_PASSWORD');
    }
    logger.warn(TAG, `Re-authentication failed with status ${response.status}`);
    throw new AccountDeletionError('Unable to verify your password. Please try again.', 'FAILED');
  }

  const refreshToken = body.AuthenticationResult?.RefreshToken;
  if (refreshToken) {
    await callCognito(target, 'RevokeToken', { Token: refreshToken, ClientId: target.clientId })
      .catch((error) => logger.debug(TAG, 'Re-authentication token revoke failed', error));
  }
}

/** Remove all rider data stored on this device. Never throws. */
export async function clearLocalAccountData(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REMEMBERED_CREDENTIALS_KEY);
  } catch (error) {
    logger.warn(TAG, 'Failed to clear remembered credentials', error);
  }
  await setReviewSessionActive(false);
  await clearActiveTourCache();
  await clearProfileDefinitionsCache();
  await clearTourHistoryCache();
}

/**
 * Delete the signed-in rider's Cognito account after re-authentication.
 *
 * @throws AccountDeletionError — the session is kept on any failure
 */
export async function deleteCurrentAccount(username: string, password: string): Promise<void> {
  await reauthenticate(username, password);

  await unregisterPushTokenForCurrentUser();

  try {
    await deleteUser();
  } catch (error) {
    logger.error(TAG, 'Cognito deleteUser failed', error);
    void registerPushTokenForCurrentUser().catch(() => {});
    const message = error instanceof Error && error.message
      ? error.message
      : 'Account deletion failed. Please try again.';
    throw new AccountDeletionError(message, 'FAILED');
  }

  logger.info(TAG, 'Cognito account deleted');
  await clearLocalAccountData();
}
