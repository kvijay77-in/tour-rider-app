import { buildProfileDefinitions, type AppConfigEntry, type ProfileDefinitions } from '../profile-schema';
import { getAppConfigEntries } from './api/configApi';
import { cacheProfileDefinitions, getCachedProfileDefinitions } from './profileConfigStore';

export interface LoadedProfileDefinitions {
  definitions: ProfileDefinitions;
  source: 'remote' | 'cache';
  refreshedAt: string | null;
}

export async function loadProfileDefinitionsWithFallback(
  fetchDefinitions: () => Promise<{ success: boolean; data?: { items: AppConfigEntry[]; definitionsVersion?: string }; error?: { message: string } }> = getAppConfigEntries,
  readCache: typeof getCachedProfileDefinitions = getCachedProfileDefinitions,
  writeCache: typeof cacheProfileDefinitions = cacheProfileDefinitions,
): Promise<LoadedProfileDefinitions> {
  try {
    const response = await fetchDefinitions();
    if (response.success) {
      const entries = response.data?.items ?? [];
      const definitionsVersion = response.data?.definitionsVersion;
      await writeCache(entries, definitionsVersion);
      return {
        definitions: buildProfileDefinitions(entries, definitionsVersion),
        source: 'remote',
        refreshedAt: new Date().toISOString(),
      };
    }

    throw new Error(response.error?.message ?? 'Failed to load profile definitions.');
  } catch (error) {
    const cached = await readCache();
    if (cached) {
      return {
        definitions: cached.definitions,
        source: 'cache',
        refreshedAt: cached.refreshedAt,
      };
    }

    throw error instanceof Error ? error : new Error('Failed to load profile definitions.');
  }
}
