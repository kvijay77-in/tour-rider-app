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
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const VARIANT = process.env.APP_VARIANT ?? 'production';
const IS_TEST = VARIANT === 'test';

const BASE_ID = 'com.tourrider.app';
const BASE_NAME = 'Tour Rider';
const BASE_SCHEME = 'tour-rider-app';
const ID = IS_TEST ? `${BASE_ID}.dev` : BASE_ID;

/** EAS file variables resolve to a path; a string variable holds the JSON itself, so write it to a file. */
function resolveGoogleServicesFile(): string | undefined {
  const value = process.env.GOOGLE_SERVICES_JSON?.trim();
  if (!value) return undefined;
  if (!value.startsWith('{')) {
    if (!existsSync(resolve(__dirname, value))) {
      throw new Error(
        `GOOGLE_SERVICES_JSON is "${value}", which does not exist. Recreate it as an EAS variable of type "file" (not "string") with the file contents.`,
      );
    }
    return value;
  }
  const dir = join(__dirname, '.eas-generated');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'google-services.json');
  writeFileSync(file, value);
  return file;
}

const GOOGLE_SERVICES_FILE = resolveGoogleServicesFile();

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
    ...(GOOGLE_SERVICES_FILE ? { googleServicesFile: GOOGLE_SERVICES_FILE } : {}),
  },
  extra: { ...config.extra, appVariant: VARIANT },
});
