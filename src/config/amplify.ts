/**
 * AWS Amplify configuration for the Tour Rider App.
 *
 * Supports two operating modes:
 *
 * 1. Single Subscription Mode (SUBSCRIPTION_MODE=single):
 *    - Amplify is configured once at app initialization with pre-configured Cognito pool
 *    - No dynamic configuration needed
 *
 * 2. Multi Subscription Mode (SUBSCRIPTION_MODE=multi):
 *    - Amplify is configured dynamically after invitation code validation
 *    - Configuration can be updated at runtime to switch between organizers
 *
 * See docs/SolutionDesign.md § Authentication.
 * See docs/design-signup-approach.md for multi-organizer support details.
 */

import { Amplify, type ResourcesConfig } from 'aws-amplify';
import { logger } from '../utils/logger';
import {
  subscriptionConfig,
  isSingleSubscriptionMode,
  type OrganizerConfig,
} from './subscription.config';

const TAG = 'Amplify';

interface EnvCognitoConfig {
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId?: string;
}

function getEnvCognitoConfig(): EnvCognitoConfig | null {
  const userPoolId = process.env.EXPO_PUBLIC_AWS_USER_POOL_ID ?? '';
  const userPoolClientId = process.env.EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID ?? '';
  const identityPoolId = process.env.EXPO_PUBLIC_AWS_IDENTITY_POOL_ID ?? '';

  if (!userPoolId || !userPoolClientId) {
    return null;
  }

  return {
    userPoolId,
    userPoolClientId,
    ...(identityPoolId ? { identityPoolId } : {}),
  };
}

/**
 * Builds the Amplify Auth config. Amplify's types require `identityPoolId` to be
 * either absent (user pool only) or a string (user pool + identity pool), so an
 * optional/undefined value must be handled as two distinct shapes.
 */
function buildAuthConfig({
  userPoolId,
  userPoolClientId,
  identityPoolId,
}: EnvCognitoConfig): NonNullable<ResourcesConfig['Auth']> {
  if (identityPoolId) {
    return { Cognito: { userPoolId, userPoolClientId, identityPoolId } };
  }

  return { Cognito: { userPoolId, userPoolClientId } };
}

/**
 * Configure Amplify Auth with Cognito User Pool settings.
 *
 * In single-subscription mode, uses pre-configured organizer settings.
 * In multi-subscription mode, requires dynamic configuration (call configureAmplifyForOrganizer).
 */
export function configureAmplify(): void {
  if (isSingleSubscriptionMode()) {
    // Single-subscription mode: configure with pre-loaded organizer settings
    const { organizer } = subscriptionConfig;
    if (!organizer) {
      logger.error(TAG, 'Single-subscription mode but organizer config is missing');
      return;
    }

    Amplify.configure({
      Auth: buildAuthConfig({
        userPoolId: organizer.cognitoPoolId,
        userPoolClientId: organizer.cognitoClientId,
        identityPoolId: organizer.identityPoolId,
      }),
    });

    logger.info(
      TAG,
      `Configured for ${organizer.organizerName} (single-subscription mode)`,
    );
  } else {
    const envCognitoConfig = getEnvCognitoConfig();

    if (envCognitoConfig) {
      // Dev/test fallback: allow direct auth in multi mode when env values are present.
      Amplify.configure({
        Auth: buildAuthConfig(envCognitoConfig),
      });

      logger.warn(
        TAG,
        'Running in multi-subscription mode with env fallback Cognito config. This is intended for local development/testing only.',
      );
      return;
    }

    // Multi-subscription mode: dynamic configuration is expected before auth calls
    logger.info(
      TAG,
      'Running in multi-subscription mode. Amplify will be configured dynamically after invitation validation.',
    );
  }
}

/**
 * Dynamically configure Amplify Auth for a specific organizer.
 * Used in multi-subscription mode after invitation code validation.
 *
 * @param organizer - The organizer configuration to use
 */
export function configureAmplifyForOrganizer(organizer: OrganizerConfig): void {
  Amplify.configure({
    Auth: buildAuthConfig({
      userPoolId: organizer.cognitoPoolId,
      userPoolClientId: organizer.cognitoClientId,
      identityPoolId: organizer.identityPoolId,
    }),
  });

  logger.info(
    TAG,
    `Dynamically configured for ${organizer.organizerName} (${organizer.organizerId})`,
  );
}
