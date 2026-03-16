/**
 * Organisation config service — decode, verify, persist, and retrieve
 * runtime org configuration delivered via setup deep link or QR code.
 *
 * Uses expo-secure-store (Android Keystore / iOS Keychain) for persistence
 * and @aws-crypto/sha256-js (transitive dep of AWS SDK) for HMAC-SHA256
 * signature verification.
 *
 * See docs/SolutionDesign.md § App Distribution — Runtime Configuration.
 */

import * as SecureStore from 'expo-secure-store';
import { Sha256 } from '@aws-crypto/sha256-js';
import { OrgConfig } from '../../types/config';
import { logger } from '../../utils/logger';

const TAG = 'OrgConfigService';

/** Key used in expo-secure-store */
const STORE_KEY = 'org_config';

/**
 * HMAC signing key — baked into the app at build time via EXPO_PUBLIC_SETUP_HMAC_KEY.
 * The same key is used by the publisher's setup-link generator tool to sign
 * the payload, and by the app to verify it.
 */
function getHmacKey(): string {
  const key = process.env.EXPO_PUBLIC_SETUP_HMAC_KEY ?? '';
  if (!key) {
    logger.warn(TAG, 'EXPO_PUBLIC_SETUP_HMAC_KEY is not set — signature verification will fail');
  }
  return key;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/**
 * Load the stored OrgConfig from secure storage.
 * Returns `null` if no config is stored or the stored value is corrupt.
 */
export async function loadOrgConfig(): Promise<OrgConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) {
      logger.debug(TAG, 'No stored org config found');
      return null;
    }
    const config: OrgConfig = JSON.parse(raw);
    if (!isValidOrgConfig(config)) {
      logger.warn(TAG, 'Stored org config is invalid — discarding');
      await SecureStore.deleteItemAsync(STORE_KEY);
      return null;
    }
    logger.info(TAG, `Loaded org config for ${config.orgCode}`);
    return config;
  } catch (err) {
    logger.error(TAG, 'Failed to load org config from secure store', err);
    return null;
  }
}

/**
 * Persist an OrgConfig to secure storage.
 */
export async function saveOrgConfig(config: OrgConfig): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(config));
  logger.info(TAG, `Saved org config for ${config.orgCode}`);
}

/**
 * Remove the stored OrgConfig (e.g. to allow reconfiguration).
 */
export async function deleteOrgConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
  logger.info(TAG, 'Deleted stored org config');
}

// ---------------------------------------------------------------------------
// Setup link payload verification
// ---------------------------------------------------------------------------

/**
 * Verify the HMAC-SHA256 signature of a setup link payload and decode it.
 *
 * @param payloadB64 - The raw Base64-encoded JSON payload from the URL.
 * @param signatureHex - The hex-encoded HMAC-SHA256 signature from the URL.
 * @returns decoded OrgConfig on success, or an error message string on failure.
 */
export async function verifyAndDecodeSetupPayload(
  payloadB64: string,
  signatureHex: string,
): Promise<{ ok: true; config: OrgConfig } | { ok: false; error: string }> {
  // 1. Compute expected HMAC of the payload string
  const hmacKey = getHmacKey();
  if (!hmacKey) {
    return { ok: false, error: 'App is not configured with a signing key.' };
  }

  try {
    const expectedHex = await computeHmacHex(hmacKey, payloadB64);

    // 2. Constant-time comparison to prevent timing attacks
    if (!timingSafeEqual(expectedHex, signatureHex.toLowerCase())) {
      logger.warn(TAG, 'HMAC signature mismatch — rejecting setup payload');
      return { ok: false, error: 'Invalid signature — the setup link may be tampered with.' };
    }

    // 3. Decode and validate payload
    const json = atob(payloadB64);
    const config: OrgConfig = JSON.parse(json);

    if (!isValidOrgConfig(config)) {
      return { ok: false, error: 'Setup link contains an invalid configuration.' };
    }

    return { ok: true, config };
  } catch (err) {
    logger.error(TAG, 'Error verifying setup payload', err);
    return { ok: false, error: 'Failed to decode setup link. It may be malformed.' };
  }
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

/**
 * Compute HMAC-SHA256(key, message) and return the result as a lowercase hex string.
 * Uses @aws-crypto/sha256-js which is already in node_modules as a transitive dep.
 */
async function computeHmacHex(key: string, message: string): Promise<string> {
  const hmac = new Sha256(key);
  hmac.update(message);
  const digest = await hmac.digest();
  return uint8ArrayToHex(digest);
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Both strings must be lowercase hex of equal length for a fair comparison.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidOrgConfig(obj: unknown): obj is OrgConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.orgCode === 'string' && o.orgCode.length > 0 &&
    typeof o.orgName === 'string' && o.orgName.length > 0 &&
    typeof o.awsRegion === 'string' && o.awsRegion.length > 0 &&
    typeof o.userPoolId === 'string' && o.userPoolId.length > 0 &&
    typeof o.userPoolClientId === 'string' && o.userPoolClientId.length > 0 &&
    typeof o.apiBaseUrl === 'string' && o.apiBaseUrl.length > 0
  );
}
