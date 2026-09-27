jest.mock('../../src/services/api/configApi', () => ({
  getAppConfigEntries: jest.fn(),
}));

jest.mock('../../src/services/profileConfigStore', () => ({
  cacheProfileDefinitions: jest.fn(),
  getCachedProfileDefinitions: jest.fn(),
}));

import { loadProfileDefinitionsWithFallback } from '../../src/services/profileDefinitionsService';
import type { AppConfigEntry } from '../../src/profile-schema';

const remoteEntries: AppConfigEntry[] = [
  {
    configType: 'RIDER_PROFILE_SECTION',
    configId: 'personal',
    enabled: true,
    version: 1,
    config: { label: 'Personal', order: 10 },
  },
];

describe('loadProfileDefinitionsWithFallback', () => {
  it('returns the cached copy when the fetch fails', async () => {
    const writeCache = jest.fn();
    const result = await loadProfileDefinitionsWithFallback(
      async () => {
        throw new Error('Network unavailable');
      },
      async () => ({
        definitions: {
          definitionsVersion: 'cached-version',
          sections: [],
          orderedAttributes: [],
          attributesByKey: {},
          lovsById: {},
          rawEntries: remoteEntries,
        },
        refreshedAt: '2026-09-27T00:00:00.000Z',
      }),
      writeCache,
    );

    expect(result.source).toBe('cache');
    expect(result.definitions.definitionsVersion).toBe('cached-version');
    expect(writeCache).not.toHaveBeenCalled();
  });
});
