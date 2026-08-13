/**
 * Unit tests for src/services/api/riderApi.ts
 */

import {
  createRiderProfile,
  getProfilePictureDownloadUrl,
  getRiderProfile,
  updateRiderProfile,
} from '../../src/services/api/riderApi';
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
    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+14155550100',
      emergencyContact: {
        name: 'Jane Doe',
        relation: 'Spouse',
        phone: '+14155550101',
      },
    };
    mockedPost.mockResolvedValueOnce({
      success: true,
      data: { profileId: 'P1', ...data },
      timestamp: '',
    });

    const result = await createRiderProfile('P1',data);
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
      data: { profileId: 'P1', name: 'Jane Smith', email: 'jane@example.com' },
      timestamp: '',
    });

    const result = await getRiderProfile('P1');
    expect(mockedGet).toHaveBeenCalledWith('/v1/riders/profile/P1', {
      isExpectedError: expect.any(Function),
    });
    expect(result.data?.name).toBe('Jane Smith');
  });

  it('encodes profile ID', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, timestamp: '' });
    await getRiderProfile('P/1');
    expect(mockedGet).toHaveBeenCalledWith(`/v1/riders/profile/${encodeURIComponent('P/1')}`, {
      isExpectedError: expect.any(Function),
    });
  });

  it('classifies 404 as expected for profile lookup', async () => {
    mockedGet.mockResolvedValueOnce({ success: false, error: { code: 'RIDERPROFILE_NOT_FOUND', message: 'not found' }, timestamp: '' });
    await getRiderProfile('P1');
    const options = mockedGet.mock.calls[0][1] as { isExpectedError?: (error: { statusCode: number }) => boolean };
    expect(options.isExpectedError?.({ statusCode: 404 })).toBe(true);
    expect(options.isExpectedError?.({ statusCode: 500 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getProfilePictureDownloadUrl
// ---------------------------------------------------------------------------

describe('getProfilePictureDownloadUrl', () => {
  it('fetches a pre-signed profile picture download URL', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: {
        downloadUrl: 'https://example.test/profile.jpg',
        photoS3Key: 'profiles/P1/photo.jpg',
        expiresIn: 300,
        profileId: 'P1',
      },
      timestamp: '',
    });

    const result = await getProfilePictureDownloadUrl('P/1');

    expect(mockedGet).toHaveBeenCalledWith('/v1/riders/profile/P%2F1/picture', {
      isExpectedError: expect.any(Function),
    });
    expect(result.data?.downloadUrl).toBe('https://example.test/profile.jpg');
  });

  it('returns an access-denied response instead of throwing on 403', async () => {
    mockedGet.mockResolvedValueOnce({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' },
      timestamp: '',
    });

    await expect(getProfilePictureDownloadUrl('P1')).resolves.toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied' },
    });
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
