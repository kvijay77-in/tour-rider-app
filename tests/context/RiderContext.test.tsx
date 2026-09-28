import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../../src/config/subscription.config', () => ({
  subscriptionConfig: {
    organizer: null,
  },
  isSingleSubscriptionMode: () => false,
}));

import { RiderProvider, useRider } from '../../src/context/RiderContext';

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/services/api/riderApi', () => ({
  getProfilePictureDownloadUrl: jest.fn(),
  getRiderProfile: jest.fn(),
  requestProfilePictureUploadUrl: jest.fn(),
  updateRiderProfile: jest.fn(),
}));

jest.mock('../../src/services/profileDefinitionsService', () => ({
  loadProfileDefinitionsWithFallback: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { useAuth } = jest.requireMock('../../src/context/AuthContext') as {
  useAuth: jest.Mock;
};

const { getProfilePictureDownloadUrl, getRiderProfile } = jest.requireMock(
  '../../src/services/api/riderApi',
) as {
  getProfilePictureDownloadUrl: jest.Mock;
  getRiderProfile: jest.Mock;
};

const { loadProfileDefinitionsWithFallback } = jest.requireMock('../../src/services/profileDefinitionsService') as {
  loadProfileDefinitionsWithFallback: jest.Mock;
};

describe('RiderContext profile picture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { profileId: 'P1', userId: 'U1', email: 'jane@example.com' } });
    loadProfileDefinitionsWithFallback.mockResolvedValue({
      definitions: {
        definitionsVersion: 'defs-v1',
        sections: [],
        orderedAttributes: [],
        attributesByKey: {},
        lovsById: {},
        rawEntries: [],
      },
      source: 'remote',
      refreshedAt: '2026-09-27T00:00:00.000Z',
    });
  });

  it('adds the pre-signed picture download URL to the loaded profile', async () => {
    getRiderProfile.mockResolvedValue({
      success: true,
      data: {
        profileId: 'P1',
        name: 'Jane Rider',
        email: 'jane@example.com',
        photoS3Key: 'profiles/P1/photo.jpg',
      },
      timestamp: '',
    });
    getProfilePictureDownloadUrl.mockResolvedValue({
      success: true,
      data: {
        downloadUrl: 'https://example.test/profile.jpg',
        photoS3Key: 'profiles/P1/photo.jpg',
        expiresIn: 300,
        profileId: 'P1',
      },
      timestamp: '',
    });

    let photoUrl: string | undefined;
    function Consumer() {
      photoUrl = useRider().profile?.photoUrl;
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <RiderProvider>
          <Consumer />
        </RiderProvider>,
      );
    });

    expect(getProfilePictureDownloadUrl).toHaveBeenCalledWith('P1');
    expect(photoUrl).toBe('https://example.test/profile.jpg');

    act(() => renderer.unmount());
  });

  it('marks the profile picture as access denied when its download URL returns 403', async () => {
    getRiderProfile.mockResolvedValue({
      success: true,
      data: {
        profileId: 'P1',
        name: 'Jane Rider',
        email: 'jane@example.com',
        photoS3Key: 'profiles/P1/photo.jpg',
      },
      timestamp: '',
    });
    getProfilePictureDownloadUrl.mockResolvedValue({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied',
      },
      timestamp: '',
    });

    let photoAccessDenied: boolean | undefined;
    function Consumer() {
      photoAccessDenied = useRider().profile?.photoAccessDenied;
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <RiderProvider>
          <Consumer />
        </RiderProvider>,
      );
    });

    expect(getProfilePictureDownloadUrl).toHaveBeenCalledWith('P1');
    expect(photoAccessDenied).toBe(true);

    act(() => renderer.unmount());
  });

  it('falls back to the profile response definitionsVersion when config does not include one', async () => {
    loadProfileDefinitionsWithFallback.mockResolvedValueOnce({
      definitions: {
        definitionsVersion: '',
        sections: [],
        orderedAttributes: [],
        attributesByKey: {},
        lovsById: {},
        rawEntries: [],
      },
      source: 'remote',
      refreshedAt: '2026-09-27T00:00:00.000Z',
    });
    getRiderProfile.mockResolvedValueOnce({
      success: true,
      data: {
        profileId: 'P1',
        name: 'Jane Rider',
        email: 'jane@example.com',
        definitionsVersion: 'profile-defs-v2',
      },
      timestamp: '',
    });

    let definitionsVersion: string | undefined;
    function Consumer() {
      definitionsVersion = useRider().profileDefinitions?.definitionsVersion;
      return null;
    }

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <RiderProvider>
          <Consumer />
        </RiderProvider>,
      );
    });

    expect(definitionsVersion).toBe('profile-defs-v2');

    act(() => renderer.unmount());
  });
});
