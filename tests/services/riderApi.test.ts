/**
 * Unit tests for src/services/api/riderApi.ts
 */

import { createRiderProfile, getRiderProfile, updateRiderProfile } from '../../src/services/api/riderApi';
import { apiClient } from '../../src/services/api/apiClient';

jest.mock('../../src/services/api/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockedPut = apiClient.put as jest.MockedFunction<typeof apiClient.put>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createRiderProfile
// ---------------------------------------------------------------------------

describe('createRiderProfile', () => {
  it('posts to /v1/riders/profile with profile data', async () => {
    const data = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
    mockedPost.mockResolvedValueOnce({
      success: true,
      data: { profileId: 'P1', ...data },
      timestamp: '',
    });

    const result = await createRiderProfile(data);
    expect(mockedPost).toHaveBeenCalledWith('/v1/riders/profile', data);
    expect(result.success).toBe(true);
    expect(result.data?.profileId).toBe('P1');
  });
});

// ---------------------------------------------------------------------------
// getRiderProfile
// ---------------------------------------------------------------------------

describe('getRiderProfile', () => {
  it('fetches profile by ID', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { profileId: 'P1', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
      timestamp: '',
    });

    const result = await getRiderProfile('P1');
    expect(mockedGet).toHaveBeenCalledWith('/v1/riders/profile/P1');
    expect(result.data?.firstName).toBe('Jane');
  });

  it('encodes profile ID', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, timestamp: '' });
    await getRiderProfile('P/1');
    expect(mockedGet).toHaveBeenCalledWith(`/v1/riders/profile/${encodeURIComponent('P/1')}`);
  });
});

// ---------------------------------------------------------------------------
// updateRiderProfile
// ---------------------------------------------------------------------------

describe('updateRiderProfile', () => {
  it('puts updated fields to profile endpoint', async () => {
    const updates = { phone: '+61412345678' };
    mockedPut.mockResolvedValueOnce({
      success: true,
      data: { profileId: 'P1', phone: '+61412345678' },
      timestamp: '',
    });

    await updateRiderProfile('P1', updates);
    expect(mockedPut).toHaveBeenCalledWith('/v1/riders/profile/P1', updates);
  });
});
