/**
 * Unit tests for src/services/api/notificationApi.ts
 */

import {
  deletePushDevice,
  getNotifications,
  getUnreadNotificationCount,
  isNotificationsApiUnavailable,
  markAllNotificationsRead,
  registerPushDevice,
} from '../../src/services/api/notificationApi';
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
const mockedDelete = apiClient.delete as jest.MockedFunction<typeof apiClient.delete>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('push device endpoints', () => {
  it('registers push device token with platform', async () => {
    mockedPost.mockResolvedValueOnce({ success: true, timestamp: '' });

    await registerPushDevice('ExponentPushToken[abc]', 'ios');

    expect(mockedPost).toHaveBeenCalledWith('/v1/notifications/devices', {
      token: 'ExponentPushToken[abc]',
      platform: 'ios',
    });
  });

  it('deletes push device token with url encoding', async () => {
    mockedDelete.mockResolvedValueOnce({ success: true, timestamp: '' });

    await deletePushDevice('ExponentPushToken[a/b]');

    expect(mockedDelete).toHaveBeenCalledWith(
      `/v1/notifications/devices/${encodeURIComponent('ExponentPushToken[a/b]')}`,
    );
  });
});

describe('notification inbox endpoints', () => {
  it('gets notifications with query params', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, data: { items: [], unreadCount: 0 }, timestamp: '' });

    await getNotifications({ since: '2026-09-28T00:00:00.000Z', limit: 20 });

    expect(mockedGet).toHaveBeenCalledWith('/v1/notifications', {
      params: {
        since: '2026-09-28T00:00:00.000Z',
        limit: '20',
      },
      returnErrorResponseForStatuses: [404, 501],
    });
  });

  it('gets unread count with graceful not-deployed statuses', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, data: { unreadCount: 2 }, timestamp: '' });

    await getUnreadNotificationCount();

    expect(mockedGet).toHaveBeenCalledWith('/v1/notifications/unread-count', {
      returnErrorResponseForStatuses: [404, 501],
    });
  });

  it('marks all notifications read with optional readAt', async () => {
    mockedPut.mockResolvedValueOnce({ success: true, timestamp: '' });

    await markAllNotificationsRead({ readAt: '2026-09-28T10:00:00.000Z' });

    expect(mockedPut).toHaveBeenCalledWith('/v1/notifications/read', {
      readAt: '2026-09-28T10:00:00.000Z',
    });
  });
});

describe('isNotificationsApiUnavailable', () => {
  it('returns true for 404/501 response codes', () => {
    expect(isNotificationsApiUnavailable({
      success: false,
      error: { code: 'HTTP_404', message: 'missing' },
      timestamp: '',
    })).toBe(true);

    expect(isNotificationsApiUnavailable({
      success: false,
      error: { code: 'HTTP_501', message: 'not implemented' },
      timestamp: '',
    })).toBe(true);
  });

  it('returns false for other responses', () => {
    expect(isNotificationsApiUnavailable({ success: true, data: {}, timestamp: '' })).toBe(false);
    expect(isNotificationsApiUnavailable({
      success: false,
      error: { code: 'HTTP_500', message: 'server error' },
      timestamp: '',
    })).toBe(false);
  });
});
