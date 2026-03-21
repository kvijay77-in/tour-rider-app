/**
 * Unit tests for src/services/api/notificationApi.ts
 */

import { getTourNotifications, markNotificationRead } from '../../src/services/api/notificationApi';
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
const mockedPut = apiClient.put as jest.MockedFunction<typeof apiClient.put>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getTourNotifications', () => {
  it('calls GET /v1/tours/{tourId}/notifications', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { items: [{ notificationId: 'N1', title: 'Test' }] },
      timestamp: '',
    });

    const result = await getTourNotifications('T1');
    expect(mockedGet).toHaveBeenCalledWith('/v1/tours/T1/notifications', { params: undefined });
    expect(result.data?.items).toHaveLength(1);
  });

  it('forwards query params', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, data: { items: [] }, timestamp: '' });
    await getTourNotifications('T1', { unreadOnly: 'true' });
    expect(mockedGet).toHaveBeenCalledWith('/v1/tours/T1/notifications', { params: { unreadOnly: 'true' } });
  });
});

describe('markNotificationRead', () => {
  it('calls PUT to mark notification as read', async () => {
    mockedPut.mockResolvedValueOnce({
      success: true,
      data: { notificationId: 'N1', isRead: true },
      timestamp: '',
    });

    await markNotificationRead('T1', 'N1');
    expect(mockedPut).toHaveBeenCalledWith(
      '/v1/tours/T1/notifications/N1',
      { isRead: true },
    );
  });

  it('encodes IDs with special characters', async () => {
    mockedPut.mockResolvedValueOnce({ success: true, timestamp: '' });
    await markNotificationRead('T/1', 'N/1');
    const path = mockedPut.mock.calls[0][0];
    expect(path).toContain(encodeURIComponent('T/1'));
    expect(path).toContain(encodeURIComponent('N/1'));
  });
});
