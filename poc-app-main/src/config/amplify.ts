/**
 * AWS Amplify configuration.
 *
 * Accepts an optional OrgConfig for runtime configuration (setup deep link /
 * QR code flow). Falls back to EXPO_PUBLIC_* environment variables when no
 * OrgConfig is provided (dev-mode / mock-data convenience).
 *
 * See docs/SolutionDesign.md § Authentication and § App Distribution.
 */

import { Amplify } from 'aws-amplify';
import { OrgConfig } from '../types/config';
import { logger } from '../utils/logger';

const TAG = 'Amplify';

/**
 * Configure Amplify Auth with Cognito User Pool settings.
 *
 * @param orgConfig - Runtime org configuration from expo-secure-store.
 *   When omitted the function reads EXPO_PUBLIC_* env vars (dev fallback).
 */
export function configureAmplify(orgConfig?: OrgConfig): void {
  const userPoolId = orgConfig?.userPoolId ?? process.env.EXPO_PUBLIC_AWS_USER_POOL_ID ?? '';
  const userPoolClientId = orgConfig?.userPoolClientId ?? process.env.EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID ?? '';
  const identityPoolId = orgConfig?.identityPoolId ?? process.env.EXPO_PUBLIC_AWS_IDENTITY_POOL_ID ?? '';

  if (!userPoolId || !userPoolClientId) {
    logger.warn(
      TAG,
      'Missing Cognito configuration. Provide an OrgConfig or set EXPO_PUBLIC_AWS_USER_POOL_ID and EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID in .env',
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
