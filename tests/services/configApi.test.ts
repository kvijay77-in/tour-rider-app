import { getAppConfigEntries } from '../../src/services/api/configApi';
import { apiClient } from '../../src/services/api/apiClient';

jest.mock('../../src/services/api/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

describe('getAppConfigEntries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns definitionsVersion from the config payload', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [{ configType: 'RIDER_PROFILE_SECTION', configId: 'personal', enabled: true, version: 1, config: { label: 'Personal', order: 1 } }],
        definitionsVersion: 'server-defs-v1',
      },
      timestamp: '',
    });

    const response = await getAppConfigEntries();

    expect(response.success).toBe(true);
    expect(response.data?.definitionsVersion).toBe('server-defs-v1');
    expect(response.data?.items).toHaveLength(1);
  });
});
