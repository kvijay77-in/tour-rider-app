/**
 * Subscription Configuration
 *
 * This module provides subscription-specific configuration for the app.
 * It supports two modes:
 *
 * 1. Single Subscription Mode (SUBSCRIPTION_MODE=single):
 *    - App is tied to a specific subscription at build time
 *    - No invitation URL required
 *    - Cognito pool and API URL are pre-configured
 *    - Users directly sign up/login without organizer selection
 *
 * 2. Multi Subscription Mode (SUBSCRIPTION_MODE=multi):
 *    - App supports multiple organizers via invitation URLs
 *    - Dynamic configuration based on invitation code validation
 *    - Requires user to provide invitation code to identify organizer
 *
 * See docs/Requirements.md § Authentication & Authorization for details.
 */

import { logger } from '../utils/logger';

const TAG = 'SubscriptionConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubscriptionMode = 'single' | 'multi';

/**
 * Organizer configuration details.
 * In single-subscription mode, these are loaded from environment variables at build time.
 * In multi-subscription mode, these are resolved dynamically from invitation validation.
 */
export interface OrganizerConfig {
  /** Unique identifier for the organizer (optional in single-subscription mode) */
  organizerId?: string;
  /** Display name of the organizer (optional in single-subscription mode) */
  organizerName?: string;
  /** AWS Cognito User Pool ID for the organizer's riders */
  cognitoPoolId: string;
  /** AWS Cognito User Pool Web Client ID */
  cognitoClientId: string;
  /** Optional: AWS Cognito Identity Pool ID */
  identityPoolId?: string;
  /** Base URL for the organizer's tour-data-api instance (without trailing slash) */
  apiBaseUrl: string;
}

/**
 * Subscription configuration for the app.
 */
export interface SubscriptionConfig {
  /** Operating mode: single or multi subscription */
  mode: SubscriptionMode;
  /** In single-subscription mode, the pre-configured organizer details */
  organizer?: OrganizerConfig;
}

// ---------------------------------------------------------------------------
// Configuration Loading
// ---------------------------------------------------------------------------

/**
 * Load subscription configuration from environment variables.
 *
 * Environment Variables:
 * - EXPO_PUBLIC_SUBSCRIPTION_MODE: 'single' or 'multi' (default: 'single')
 *
 * For single-subscription mode, also supports:
 * - EXPO_PUBLIC_ORGANIZER_ID: Optional organizer identifier for labels/logging
 * - EXPO_PUBLIC_ORGANIZER_NAME: Optional display name for labels/logging
 * - EXPO_PUBLIC_AWS_USER_POOL_ID: Cognito User Pool ID
 * - EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID: Cognito Client ID
 * - EXPO_PUBLIC_AWS_IDENTITY_POOL_ID: (Optional) Cognito Identity Pool ID
 * - EXPO_PUBLIC_TOUR_DATA_API_BASE_URL: API base URL
 */
function loadSubscriptionConfig(): SubscriptionConfig {
  const mode = (process.env.EXPO_PUBLIC_SUBSCRIPTION_MODE || 'single') as SubscriptionMode;

  if (mode !== 'single' && mode !== 'multi') {
    logger.warn(
      TAG,
      `Invalid SUBSCRIPTION_MODE '${mode}'. Defaulting to 'single'.`,
    );
    return { mode: 'single' };
  }

  if (mode === 'single') {
    // Single-subscription mode: load organizer config from env vars
    const organizerId = process.env.EXPO_PUBLIC_ORGANIZER_ID?.trim();
    const organizerName = process.env.EXPO_PUBLIC_ORGANIZER_NAME?.trim();
    const cognitoPoolId = process.env.EXPO_PUBLIC_AWS_USER_POOL_ID ?? '';
    const cognitoClientId = process.env.EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID ?? '';
    const identityPoolId = process.env.EXPO_PUBLIC_AWS_IDENTITY_POOL_ID ?? '';
    const apiBaseUrl = process.env.EXPO_PUBLIC_TOUR_DATA_API_BASE_URL ?? '';

    // Validate required fields
    if (!cognitoPoolId || !cognitoClientId || !apiBaseUrl) {
      logger.error(
        TAG,
        'Single-subscription mode requires AWS_USER_POOL_ID, AWS_USER_POOL_WEB_CLIENT_ID, and TOUR_DATA_API_BASE_URL',
      );
      throw new Error(
        'Incomplete subscription configuration. Check environment variables for single-subscription mode.',
      );
    }

    logger.info(TAG, 'Loaded single-subscription config from Expo public env vars');

    return {
      mode: 'single',
      organizer: {
        ...(organizerId ? { organizerId } : {}),
        ...(organizerName ? { organizerName } : {}),
        cognitoPoolId,
        cognitoClientId,
        ...(identityPoolId ? { identityPoolId } : {}),
        apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''), // Remove trailing slashes
      },
    };
  }

  // Multi-subscription mode: no pre-configured organizer
  logger.info(TAG, 'Running in multi-subscription mode (invitation-based)');
  return { mode: 'multi' };
}

// ---------------------------------------------------------------------------
// Exported Configuration
// ---------------------------------------------------------------------------

/**
 * Global subscription configuration for the app.
 * Loaded once at module initialization.
 */
export const subscriptionConfig: SubscriptionConfig = loadSubscriptionConfig();

/**
 * Check if the app is running in single-subscription mode.
 */
export function isSingleSubscriptionMode(): boolean {
  return subscriptionConfig.mode === 'single';
}

/**
 * Check if the app is running in multi-subscription mode.
 */
export function isMultiSubscriptionMode(): boolean {
  return subscriptionConfig.mode === 'multi';
}

/**
 * Get the pre-configured organizer (only available in single-subscription mode).
 * Throws an error if called in multi-subscription mode.
 */
export function getOrganizerConfig(): OrganizerConfig {
  if (subscriptionConfig.mode !== 'single' || !subscriptionConfig.organizer) {
    throw new Error(
      'getOrganizerConfig() can only be called in single-subscription mode',
    );
  }
  return subscriptionConfig.organizer;
}
