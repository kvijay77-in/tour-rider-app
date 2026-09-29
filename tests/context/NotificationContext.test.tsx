import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { NotificationProvider, useNotifications } from '../../src/context/NotificationContext';

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/context/RiderContext', () => ({
  useRider: jest.fn(),
}));

jest.mock('../../src/services/api/notificationApi', () => ({
  getNotifications: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
  isNotificationsApiUnavailable: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

jest.mock('../../src/services/push/pushService', () => ({
  configureForegroundNotificationHandler: jest.fn(),
  registerPushTokenForCurrentUser: jest.fn(),
  unregisterPushTokenForCurrentUser: jest.fn(),
}));

jest.mock('../../src/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: jest.fn(() => false),
    navigate: jest.fn(),
  },
}));

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { useAuth } = jest.requireMock('../../src/context/AuthContext') as {
  useAuth: jest.Mock;
};

const { useRider } = jest.requireMock('../../src/context/RiderContext') as {
  useRider: jest.Mock;
};

const {
  getNotifications,
  getUnreadNotificationCount,
  isNotificationsApiUnavailable,
  markAllNotificationsRead,
} = jest.requireMock('../../src/services/api/notificationApi') as {
  getNotifications: jest.Mock;
  getUnreadNotificationCount: jest.Mock;
  isNotificationsApiUnavailable: jest.Mock;
  markAllNotificationsRead: jest.Mock;
};

const { addNotificationReceivedListener, addNotificationResponseReceivedListener } = jest.requireMock(
  'expo-notifications',
) as {
  addNotificationReceivedListener: jest.Mock;
  addNotificationResponseReceivedListener: jest.Mock;
};

const { unregisterPushTokenForCurrentUser } = jest.requireMock('../../src/services/push/pushService') as {
  unregisterPushTokenForCurrentUser: jest.Mock;
};

const { navigationRef } = jest.requireMock('../../src/navigation/navigationRef') as {
  navigationRef: {
    isReady: jest.Mock;
    navigate: jest.Mock;
  };
};

function Consumer() {
  const { unreadCount, items, isApiAvailable } = useNotifications();

  return React.createElement(
    'Text',
    null,
    JSON.stringify({ unreadCount, itemCount: items.length, isApiAvailable }),
  );
}

describe('NotificationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: { userId: 'u1' } });
    useRider.mockReturnValue({ hasProfile: true });
    isNotificationsApiUnavailable.mockReturnValue(false);
    getUnreadNotificationCount.mockResolvedValue({ success: true, data: { unreadCount: 0 }, timestamp: '' });
    markAllNotificationsRead.mockResolvedValue({ success: true, timestamp: '' });
    navigationRef.isReady.mockReturnValue(false);
  });

  it('loads notifications and unread count', async () => {
    getNotifications.mockResolvedValue({
      success: true,
      data: {
        items: [{
          notificationId: 'n1',
          ruleId: 'r1',
          title: 'Test',
          body: 'Body',
          priority: 'NORMAL',
          createdAt: '2026-09-28T10:00:00.000Z',
          isRead: false,
        }],
        unreadCount: 1,
      },
      timestamp: '',
    });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationProvider>
          <Consumer />
        </NotificationProvider>,
      );
    });

    const payload = renderer!.root.findByType('Text').props.children as string;
    const parsed = JSON.parse(payload) as {
      unreadCount: number;
      itemCount: number;
      isApiAvailable: boolean;
    };

    expect(parsed.unreadCount).toBe(1);
    expect(parsed.itemCount).toBe(1);
    expect(parsed.isApiAvailable).toBe(true);

    act(() => renderer!.unmount());
  });

  it('hides badge availability when API returns 404/501', async () => {
    getNotifications.mockResolvedValue({
      success: false,
      error: { code: 'HTTP_404', message: 'missing' },
      timestamp: '',
    });
    isNotificationsApiUnavailable.mockReturnValue(true);

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationProvider>
          <Consumer />
        </NotificationProvider>,
      );
    });

    const payload = renderer!.root.findByType('Text').props.children as string;
    const parsed = JSON.parse(payload) as {
      unreadCount: number;
      itemCount: number;
      isApiAvailable: boolean;
    };

    expect(parsed.unreadCount).toBe(0);
    expect(parsed.itemCount).toBe(0);
    expect(parsed.isApiAvailable).toBe(false);

    act(() => renderer!.unmount());
  });

  it('refreshes when a foreground push notification is received', async () => {
    getNotifications.mockResolvedValue({ success: true, data: { items: [], unreadCount: 0 }, timestamp: '' });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationProvider>
          <Consumer />
        </NotificationProvider>,
      );
    });

    const receivedListener = addNotificationReceivedListener.mock.calls[0][0] as (notification: unknown) => void;

    getNotifications.mockResolvedValueOnce({ success: true, data: { items: [], unreadCount: 1 }, timestamp: '' });

    await act(async () => {
      receivedListener({
        request: { content: { data: { channelId: 'urgent' } } },
      });
      await Promise.resolve();
    });

    expect(getNotifications).toHaveBeenCalledTimes(2);

    const payload = renderer!.root.findByType('Text').props.children as string;
    const parsed = JSON.parse(payload) as { unreadCount: number };
    expect(parsed.unreadCount).toBe(1);

    act(() => renderer!.unmount());
  });

  it('routes push tap responses through target allow-list', async () => {
    getNotifications.mockResolvedValue({ success: true, data: { items: [], unreadCount: 0 }, timestamp: '' });
    navigationRef.isReady.mockReturnValue(true);

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationProvider>
          <Consumer />
        </NotificationProvider>,
      );
    });

    const responseListener = addNotificationResponseReceivedListener.mock.calls[0][0] as (response: unknown) => void;

    await act(async () => {
      responseListener({
        notification: {
          request: {
            content: {
              data: {
                target: {
                  screen: 'PROFILE',
                },
              },
            },
          },
        },
      });
      await Promise.resolve();
    });

    expect(navigationRef.navigate).toHaveBeenCalledWith('ViewProfile');

    act(() => renderer!.unmount());
  });

  it('cleans up push token registration on provider unmount', async () => {
    getNotifications.mockResolvedValue({ success: true, data: { items: [], unreadCount: 0 }, timestamp: '' });

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <NotificationProvider>
          <Consumer />
        </NotificationProvider>,
      );
    });

    act(() => renderer!.unmount());

    expect(unregisterPushTokenForCurrentUser).toHaveBeenCalled();
  });
});
