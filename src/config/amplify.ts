/**
 * AWS Amplify configuration for the Tour Rider App.
 *
 * Configures Amplify Auth with a dedicated Cognito User Pool for riders
 * (separate from the tour-mgmt-app/Check-In App staff pool).
 *
 * Configuration is read from EXPO_PUBLIC_* environment variables.
 *
 * See docs/SolutionDesign.md § Authentication.
 */

import { Amplify } from 'aws-amplify';
import { logger } from '../utils/logger';

const TAG = 'Amplify';

/**
 * Configure Amplify Auth with Cognito User Pool settings.
 * Reads EXPO_PUBLIC_* env vars for the dedicated rider user pool.
 */
export function configureAmplify(): void {
  const userPoolId = process.env.EXPO_PUBLIC_AWS_USER_POOL_ID ?? '';
  const userPoolClientId = process.env.EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID ?? '';
  const identityPoolId = process.env.EXPO_PUBLIC_AWS_IDENTITY_POOL_ID ?? '';

  if (!userPoolId || !userPoolClientId) {
    logger.warn(
      TAG,
      'Missing Cognito configuration. Set EXPO_PUBLIC_AWS_USER_POOL_ID and EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID in .env',
    );
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        ...(identityPoolId ? { identityPoolId } : {}),
      },
    },
  });

  logger.info(TAG, `Configured for pool ${userPoolId}`);
}
