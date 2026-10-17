/**
 * Dynamic Expo config — selects the app variant at build time.
 *
 * Static configuration stays in app.json. APP_VARIANT (set per EAS build
 * profile in eas.json) selects the store identity:
 * - production (default): com.tourrider.app, "Tour Rider", scheme tour-rider-app
 * - test: com.tourrider.app.dev, "Tour Rider (Test)", scheme tour-rider-app-dev
 *
 * See docs/design/app-variants-and-environments.md.
 */

import { ExpoConfig, ConfigContext } from 'expo/config';

const VARIANT = process.env.APP_VARIANT ?? 'production';
const IS_TEST = VARIANT === 'test';

const BASE_ID = 'com.tourrider.app';
const BASE_NAME = 'Tour Rider';
const BASE_SCHEME = 'tour-rider-app';
const ID = IS_TEST ? `${BASE_ID}.dev` : BASE_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_TEST ? `${BASE_NAME} (Test)` : BASE_NAME,
  slug: config.slug ?? BASE_SCHEME,
  scheme: IS_TEST ? `${BASE_SCHEME}-dev` : BASE_SCHEME,
  icon: IS_TEST ? './assets/icon-test.png' : './assets/icon.png',
  ios: { ...config.ios, bundleIdentifier: ID },
  android: {
    ...config.android,
    package: ID,
    adaptiveIcon: {
      ...config.android?.adaptiveIcon,
      foregroundImage: IS_TEST ? './assets/adaptive-icon-test.png' : './assets/adaptive-icon.png',
    },
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {})
  },
  extra: { ...config.extra, appVariant: VARIANT },
});
