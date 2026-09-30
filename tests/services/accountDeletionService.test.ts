/**
 * Unit tests for src/services/accountDeletionService.ts
 */

import {
  AccountDeletionError,
  OFFLINE_DELETE_MESSAGE,
  deleteCurrentAccount,
} from '../../src/services/accountDeletionService';

const mockCalls: string[] = [];

jest.mock('aws-amplify', () => ({
  Amplify: {
    getConfig: () => ({
      Auth: { Cognito: { userPoolId: 'ap-south-1_POOL', userPoolClientId: 'client-1' } },
    }),
  },
}));
jest.mock('aws-amplify/auth', () => ({
  deleteUser: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async (key: string) => { mockCalls.push(`secureDelete:${key}`); }),
}));
jest.mock('../../src/config/reviewAccess', () => ({
  setReviewSessionActive: jest.fn(async (active: boolean) => { mockCalls.push(`reviewActive:${active}`); }),
}));
jest.mock('../../src/services/activeTourStore', () => ({
  clearActiveTourCache: jest.fn(async () => { mockCalls.push('clearActiveTour'); }),
}));
jest.mock('../../src/services/profileConfigStore', () => ({
  clearProfileDefinitionsCache: jest.fn(async () => { mockCalls.push('clearProfileDefinitions'); }),
}));
jest.mock('../../src/services/tourHistoryStore', () => ({
  clearTourHistoryCache: jest.fn(async () => { mockCalls.push('clearTourHistory'); }),
}));
jest.mock('../../src/services/push/pushService', () => ({
  unregisterPushTokenForCurrentUser: jest.fn(async () => { mockCalls.push('unregisterPush'); }),
  registerPushTokenForCurrentUser: jest.fn(async () => { mockCalls.push('registerPush'); return null; }),
}));
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { deleteUser } = jest.requireMock('aws-amplify/auth') as { deleteUser: jest.Mock };

const mockFetch = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = mockFetch;

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('deleteCurrentAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCalls.length = 0;
    deleteUser.mockImplementation(async () => { mockCalls.push('deleteUser'); });
  });

  it('re-authenticates, unregisters push, deletes the Cognito user, then clears local data', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, { AuthenticationResult: { RefreshToken: 'rt' } }))
      .mockResolvedValueOnce(jsonResponse(200, {}));

    await deleteCurrentAccount('rider@example.com', 'secret');

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://cognito-idp.ap-south-1.amazonaws.com/');
    expect(init.headers['X-Amz-Target']).toBe('AWSCognitoIdentityProviderService.InitiateAuth');
    expect(JSON.parse(init.body)).toEqual({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: 'client-1',
      AuthParameters: { USERNAME: 'rider@example.com', PASSWORD: 'secret' },
    });
    expect(mockFetch.mock.calls[1][1].headers['X-Amz-Target']).toBe('AWSCognitoIdentityProviderService.RevokeToken');

    expect(mockCalls).toEqual([
      'unregisterPush',
      'deleteUser',
      'secureDelete:auth.rememberedCredentials',
      'reviewActive:false',
      'clearActiveTour',
      'clearProfileDefinitions',
      'clearTourHistory',
    ]);
  });

  it('does nothing when offline', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

    const promise = deleteCurrentAccount('rider@example.com', 'secret');
    await expect(promise).rejects.toMatchObject({ code: 'OFFLINE', message: OFFLINE_DELETE_MESSAGE });
    expect(mockCalls).toEqual([]);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password without deleting anything', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(400, { __type: 'NotAuthorizedException' }));

    await expect(deleteCurrentAccount('rider@example.com', 'wrong')).rejects.toMatchObject({
      code: 'INVALID_PASSWORD',
    });
    expect(mockCalls).toEqual([]);
  });

  it('keeps the session and local data when deleteUser fails', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { AuthenticationResult: {} }));
    deleteUser.mockRejectedValueOnce(new Error('Service unavailable'));

    const error = await deleteCurrentAccount('rider@example.com', 'secret').catch((e) => e);

    expect(error).toBeInstanceOf(AccountDeletionError);
    expect(error).toMatchObject({ code: 'FAILED', message: 'Service unavailable' });
    expect(mockCalls).toEqual(['unregisterPush', 'registerPush']);
  });
});
