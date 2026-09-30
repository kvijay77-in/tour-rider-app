/**
 * Build-time app variant (Test / Production).
 *
 * app.config.ts writes APP_VARIANT into `extra.appVariant`. Anything other
 * than 'test' is treated as production.
 *
 * See docs/design/app-variants-and-environments.md.
 */

import Constants from 'expo-constants';

export type AppVariant = 'test' | 'production';

export function getAppVariant(): AppVariant {
  return Constants.expoConfig?.extra?.appVariant === 'test' ? 'test' : 'production';
}

export function isTestVariant(): boolean {
  return getAppVariant() === 'test';
}
