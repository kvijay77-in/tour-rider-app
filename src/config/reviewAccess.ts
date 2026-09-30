/**
 * Store-reviewer backend routing.
 *
 * The Production app talks to the Prod backend. The single store-reviewer
 * account (EXPO_PUBLIC_REVIEW_USERNAME) exists only in the Dev rider pool, so
 * when that exact email signs in the app switches Amplify Auth and apiClient to
 * the Review (Dev) profile. Every other email stays on the primary backend.
 *
 * Routing is disabled (fail-safe) unless the reviewer username and the Review
 * pool, client and API URL are all configured. The Test app leaves the
 * EXPO_PUBLIC_REVIEW_* variables unset, so routing is always off there.
 *
 * See docs/design/app-variants-and-environments.md § Runtime routing.
 */

import * as SecureStore from 'expo-secure-store';

import { REVIEW_ACTIVE_KEY } from '../constants/storageKeys';
import { setApiBaseUrl } from '../services/api/apiClient';
import { logger } from '../utils/logger';
import { configureAmplifyForOrganizer } from './amplify';
import { subscriptionConfig, type OrganizerConfig } from './subscription.config';

const TAG = 'ReviewAccess';

export type BackendProfileKind = 'primary' | 'review';

interface ReviewAccessConfig {
  username: string;
  profile: OrganizerConfig;
}

let primaryProfile: OrganizerConfig | null = null;
let activeKind: BackendProfileKind = 'primary';

/**
 * Read the reviewer configuration. EXPO_PUBLIC_* values must be accessed as
 * direct `process.env.X` properties so Expo can inline them at build time.
 */
function getReviewAccessConfig(): ReviewAccessConfig | null {
  const username = process.env.EXPO_PUBLIC_REVIEW_USERNAME?.trim() ?? '';
  const cognitoPoolId = process.env.EXPO_PUBLIC_REVIEW_AWS_USER_POOL_ID?.trim() ?? '';
  const cognitoClientId = process.env.EXPO_PUBLIC_REVIEW_AWS_USER_POOL_WEB_CLIENT_ID?.trim() ?? '';
  const identityPoolId = process.env.EXPO_PUBLIC_REVIEW_AWS_IDENTITY_POOL_ID?.trim() ?? '';
  const apiBaseUrl = process.env.EXPO_PUBLIC_REVIEW_TOUR_DATA_API_BASE_URL?.trim() ?? '';

  if (!username || !cognitoPoolId || !cognitoClientId || !apiBaseUrl) {
    return null;
  }

  return {
    username,
    profile: {
      ...(primaryProfile?.organizerId ? { organizerId: primaryProfile.organizerId } : {}),
      organizerName: `${primaryProfile?.organizerName ?? 'Organizer'} (review)`,
      cognitoPoolId,
      cognitoClientId,
      ...(identityPoolId ? { identityPoolId } : {}),
      apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
    },
  };
}

function applyProfile(kind: BackendProfileKind, profile: OrganizerConfig): void {
  configureAmplifyForOrganizer(profile);
  setApiBaseUrl(profile.apiBaseUrl);
  activeKind = kind;
  logger.info(TAG, `Backend routed to ${kind} profile`);
}

/**
 * Remember the primary backend profile (configured at startup by configureAmplify).
 * Call once at app start after configureAmplify().
 */
export function initBackendRouting(): void {
  primaryProfile = subscriptionConfig.organizer ?? null;
  activeKind = 'primary';

  if (!primaryProfile) {
    logger.info(TAG, 'Review routing disabled: no primary organizer profile');
  } else if (!getReviewAccessConfig()) {
    logger.info(TAG, 'Review routing disabled: review configuration not set');
  } else {
    logger.info(TAG, 'Review routing enabled');
  }
}

/** True when both the primary profile and a complete review configuration exist. */
export function isReviewRoutingEnabled(): boolean {
  return Boolean(primaryProfile && getReviewAccessConfig());
}

/** Exact, case-insensitive match against the configured reviewer username. */
export function isReviewUsername(email: string): boolean {
  const config = primaryProfile ? getReviewAccessConfig() : null;
  if (!config) {
    return false;
  }
  return email.trim().toLowerCase() === config.username.toLowerCase();
}

/** Currently active backend profile kind. */
export function getActiveBackendKind(): BackendProfileKind {
  return activeKind;
}

/**
 * Ensure the primary backend is active. Reconfigures only when the Review
 * profile is currently applied.
 */
export function routeBackendToPrimary(): void {
  if (activeKind === 'primary' || !primaryProfile) {
    return;
  }
  applyProfile('primary', primaryProfile);
}

/**
 * Apply the Review backend profile. Returns false (and stays on primary) when
 * routing is disabled.
 */
export function routeBackendToReview(): boolean {
  const config = primaryProfile ? getReviewAccessConfig() : null;
  if (!config) {
    routeBackendToPrimary();
    return false;
  }
  if (activeKind !== 'review') {
    applyProfile('review', config.profile);
  }
  return true;
}

/**
 * Select the backend for a sign-in attempt. The reviewer email goes to the
 * Review profile; everyone else to the primary profile. Returns the active kind.
 */
export function routeBackendForLogin(email: string): BackendProfileKind {
  if (isReviewUsername(email)) {
    routeBackendToReview();
  } else {
    routeBackendToPrimary();
  }
  return activeKind;
}

/** Persist whether the signed-in session belongs to the Review backend. */
export async function setReviewSessionActive(active: boolean): Promise<void> {
  try {
    if (active) {
      await SecureStore.setItemAsync(REVIEW_ACTIVE_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(REVIEW_ACTIVE_KEY);
    }
  } catch (error) {
    logger.warn(TAG, 'Failed to persist review session flag', error);
  }
}

/** Whether the last signed-in session was a reviewer session. */
export async function isReviewSessionActive(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(REVIEW_ACTIVE_KEY)) === 'true';
  } catch (error) {
    logger.warn(TAG, 'Failed to read review session flag', error);
    return false;
  }
}
