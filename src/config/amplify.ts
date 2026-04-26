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

import { Amplify } from 'aws-amplify';
import { logger } from '../utils/logger';
import {
  subscriptionConfig,
  isSingleSubscriptionMode,
  type OrganizerConfig,
} from './subscription.config';

const TAG = 'Amplify';

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
      Auth: {
        Cognito: {
          userPoolId: organizer.cognitoPoolId,
          userPoolClientId: organizer.cognitoClientId,
          ...(organizer.identityPoolId ? { identityPoolId: organizer.identityPoolId } : {}),
        },
      },
    });

    logger.info(
      TAG,
      `Configured for ${organizer.organizerName} (single-subscription mode)`,
    );
  } else {
    // Multi-subscription mode: log that dynamic configuration is expected
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
    Auth: {
      Cognito: {
        userPoolId: organizer.cognitoPoolId,
        userPoolClientId: organizer.cognitoClientId,
        ...(organizer.identityPoolId ? { identityPoolId: organizer.identityPoolId } : {}),
      },
    },
  });

  logger.info(
    TAG,
    `Dynamically configured for ${organizer.organizerName} (${organizer.organizerId})`,
  );
}
