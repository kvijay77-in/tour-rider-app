/**
 * Unit tests for src/services/api/riderApi.ts
 */

import {
  createRiderProfile,
  getProfileAttributeDownloadUrl,
  getProfilePictureDownloadUrl,
  getRiderProfile,
  requestProfileAttributeUploadUrl,
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

describe('createRiderProfile', () => {
  it('posts to /v1/riders/profile with profile data', async () => {
    const data = {
      profileId: 'P1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+14155550100',
      emergencyContact: {
        name: 'Jane Doe',
        relation: 'Spouse',
        phone: '+14155550101',
      },
      definitionsVersion: 'defs-v1',
    };
    mockedPost.mockResolvedValueOnce({
      success: true,
      data: { ...data },
      timestamp: '',
    });

    const result = await createRiderProfile(data);

    expect(mockedPost).toHaveBeenCalledWith('/v1/riders/profile', data, {
      isExpectedError: expect.any(Function),
    });
    expect(result.success).toBe(true);
    expect(result.data?.profileId).toBe('P1');
  });
});

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

  it('classifies 404 as expected for profile lookup', async () => {
    mockedGet.mockResolvedValueOnce({ success: false, error: { code: 'RIDERPROFILE_NOT_FOUND', message: 'not found' }, timestamp: '' });
    await getRiderProfile('P1');
    const options = mockedGet.mock.calls[0][1] as { isExpectedError?: (error: { statusCode: number }) => boolean };
    expect(options.isExpectedError?.({ statusCode: 404 })).toBe(true);
    expect(options.isExpectedError?.({ statusCode: 500 })).toBe(false);
  });
});

describe('getProfilePictureDownloadUrl', () => {
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

describe('profile attribute file endpoints', () => {
  it('requests a presigned upload URL for a profile attribute file', async () => {
    mockedPost.mockResolvedValueOnce({ success: true, data: { uploadUrl: 'https://upload.test' }, timestamp: '' });

    await requestProfileAttributeUploadUrl('P1', 'medicalCertificate', 'application/pdf', 2048);

    expect(mockedPost).toHaveBeenCalledWith(
      '/v1/riders/profile/P1/attributes/medicalCertificate/upload',
      { contentType: 'application/pdf', sizeBytes: 2048 },
    );
  });

  it('requests a presigned download URL for a profile attribute file', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, data: { downloadUrl: 'https://download.test' }, timestamp: '' });

    await getProfileAttributeDownloadUrl('P1', 'medicalCertificate');

    expect(mockedGet).toHaveBeenCalledWith(
      '/v1/riders/profile/P1/attributes/medicalCertificate/download',
      {
        isExpectedError: expect.any(Function),
        returnErrorResponseForStatuses: [403],
      },
    );
  });

  it('encodes reserved characters in profile and attribute identifiers', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, timestamp: '' });
    mockedPost.mockResolvedValueOnce({ success: true, timestamp: '' });

    await requestProfileAttributeUploadUrl('P/1', 'medical/certificate');
    await getProfileAttributeDownloadUrl('P/1', 'medical/certificate');

    expect(mockedPost).toHaveBeenCalledWith(
      `/v1/riders/profile/${encodeURIComponent('P/1')}/attributes/${encodeURIComponent('medical/certificate')}/upload`,
      {},
    );
    expect(mockedGet).toHaveBeenCalledWith(
      `/v1/riders/profile/${encodeURIComponent('P/1')}/attributes/${encodeURIComponent('medical/certificate')}/download`,
      expect.objectContaining({
        isExpectedError: expect.any(Function),
      }),
    );
  });
});

describe('updateRiderProfile', () => {
  it('puts updated fields to profile endpoint', async () => {
    const updates = { phone: '+61412345678', definitionsVersion: 'defs-v1' };
    mockedPut.mockResolvedValueOnce({
      success: true,
      data: { profileId: 'P1', phone: '+61412345678' },
      timestamp: '',
    });

    await updateRiderProfile('P1', updates);
    expect(mockedPut).toHaveBeenCalledWith('/v1/riders/profile/P1', updates);
  });
});
