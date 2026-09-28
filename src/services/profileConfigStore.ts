import * as SQLite from 'expo-sqlite';

import { logger } from '../utils/logger';
import { buildProfileDefinitions } from '../profile-schema';
import type { AppConfigEntry, ProfileDefinitions } from '../profile-schema';

const TAG = 'ProfileConfigStore';
const DATABASE_NAME = 'profile_config_cache.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let schemaPromise: Promise<void> | null = null;

interface CachedProfileDefinitionsRow {
  payload: string;
  refreshedAt: string;
}

interface CachedProfileDefinitionsPayload {
  entries: AppConfigEntry[];
  definitionsVersion?: string;
}

export interface CachedProfileDefinitions {
  definitions: ProfileDefinitions;
  refreshedAt: string;
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  if (!schemaPromise) {
    schemaPromise = databasePromise.then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cached_profile_definitions (
          singletonId INTEGER PRIMARY KEY NOT NULL CHECK (singletonId = 1),
          payload TEXT NOT NULL,
          refreshedAt TEXT NOT NULL
        );
      `);
    });
  }

  await schemaPromise;
  return databasePromise;
}

export async function cacheProfileDefinitions(
  entries: AppConfigEntry[],
  definitionsVersion?: string,
): Promise<void> {
  try {
    const db = await getDatabase();
    const refreshedAt = new Date().toISOString();
    await db.runAsync(
      'INSERT OR REPLACE INTO cached_profile_definitions (singletonId, payload, refreshedAt) VALUES (1, ?, ?)',
      JSON.stringify({
        entries,
        ...(definitionsVersion ? { definitionsVersion } : {}),
      } satisfies CachedProfileDefinitionsPayload),
      refreshedAt,
    );
  } catch (error) {
    logger.warn(TAG, 'Failed to cache profile definitions');
    logger.debug(TAG, 'Profile definitions cache write failure', error);
  }
}

export async function getCachedProfileDefinitions(): Promise<CachedProfileDefinitions | null> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<CachedProfileDefinitionsRow>(
      'SELECT payload, refreshedAt FROM cached_profile_definitions WHERE singletonId = 1 LIMIT 1',
    );
    const [row] = rows;

    if (!row) {
      return null;
    }

    const parsedPayload = JSON.parse(row.payload) as AppConfigEntry[] | CachedProfileDefinitionsPayload;
    const entries = Array.isArray(parsedPayload) ? parsedPayload : parsedPayload.entries;
    const definitionsVersion = Array.isArray(parsedPayload) ? undefined : parsedPayload.definitionsVersion;
    return {
      definitions: buildProfileDefinitions(entries, definitionsVersion),
      refreshedAt: row.refreshedAt,
    };
  } catch (error) {
    logger.warn(TAG, 'Unable to read cached profile definitions');
    logger.debug(TAG, 'Profile definitions cache read failure', error);
    return null;
  }
}

export async function clearProfileDefinitionsCache(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execAsync('DELETE FROM cached_profile_definitions;');
  } catch (error) {
    logger.warn(TAG, 'Failed to clear profile definitions cache');
    logger.debug(TAG, 'Profile definitions cache clear failure', error);
  }
}
