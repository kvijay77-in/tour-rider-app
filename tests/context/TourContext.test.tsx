import React from 'react';
import { act, renderAsync } from '@testing-library/react-native';

jest.mock('../../src/config/subscription.config', () => ({
  subscriptionConfig: {
    organizer: null,
    auth: {
      userPoolId: 'test-pool',
      userPoolClientId: 'test-client',
    },
    api: {
      baseUrl: 'https://example.test',
    },
  },
  isSingleSubscriptionMode: () => false,
}));

import { StageType } from '../../src/constants/stages';
import { TourProvider, useTour } from '../../src/context/TourContext';
import { RideStatus, type Ride } from '../../src/types/ride';
import { TourRiderStatus, TourStatus, type Tour, type TourRider } from '../../src/types/tour';

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/context/RiderContext', () => ({
  useRider: jest.fn(),
}));

jest.mock('../../src/services/api/tourApi', () => ({
  getActiveTour: jest.fn(),
  getTourRiderByProfile: jest.fn(),
}));

jest.mock('../../src/services/api/rideApi', () => ({
  getTourRides: jest.fn(),
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('../../src/services/activeTourStore', () => {
  const actual = jest.requireActual('../../src/services/activeTourStore');
  return {
    ...actual,
    cacheActiveTourSnapshot: jest.fn(),
    clearActiveTourCache: jest.fn(),
    getCachedActiveTourSnapshot: jest.fn(),
  };
});

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { useAuth } = jest.requireMock('../../src/context/AuthContext') as {
  useAuth: jest.Mock;
};

const { useRider } = jest.requireMock('../../src/context/RiderContext') as {
  useRider: jest.Mock;
};

const { getActiveTour, getTourRiderByProfile } = jest.requireMock('../../src/services/api/tourApi') as {
  getActiveTour: jest.Mock;
  getTourRiderByProfile: jest.Mock;
};

const { getTourRides } = jest.requireMock('../../src/services/api/rideApi') as {
  getTourRides: jest.Mock;
};

const {
  cacheActiveTourSnapshot,
  getCachedActiveTourSnapshot,
} = jest.requireMock('../../src/services/activeTourStore') as {
  cacheActiveTourSnapshot: jest.Mock;
  getCachedActiveTourSnapshot: jest.Mock;
};

const baseTour = (): Tour => ({
  tourId: 'TOT-2026',
  name: 'Tour of Tamilnadu 2026',
  startDate: '2026-02-10',
  endDate: '2026-02-17',
  status: TourStatus.ACTIVE,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
});

const baseEnrollment = (): TourRider => ({
  riderId: 'R57',
  profileId: 'PROFILE-1',
  status: TourRiderStatus.ACTIVE,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
});

const baseRide = (): Ride => ({
  rideId: 'RIDE001',
  date: '2026-02-12',
  rideNo: 1,
  name: 'Day 1',
  startLocation: 'Chennai',
  finishLocation: 'Pondicherry',
  totalDistance: 120,
  stages: [
    {
      stageId: 'S000',
      stageNumber: 0,
      type: StageType.START,
      name: 'Start',
    },
  ],
  status: RideStatus.ACTIVE,
});

function Consumer() {
  const { activeTour, activeRides, activeTodaysRide, enrollment, isEnrolled, isLoading } = useTour();

  return (
    React.createElement(
      'Text',
      { testID: 'payload' },
      JSON.stringify({
        activeTourId: activeTour?.tourId ?? null,
        enrollmentStatus: enrollment?.status ?? null,
        isEnrolled,
        activeRideIds: activeRides.map((ride) => ride.rideId),
        todaysRideId: activeTodaysRide?.rideId ?? null,
        isLoading,
      }),
    )
  );
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('TourProvider', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-02-12T09:00:00.000Z'));
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    useAuth.mockReturnValue({ user: { profileId: 'PROFILE-1' } });
    useRider.mockReturnValue({ hasProfile: true, isLoading: false });
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  it('refreshes the active snapshot once and exposes cached active ride data', async () => {
    const tour = baseTour();
    const enrollment = baseEnrollment();
    const ride = baseRide();
    const snapshot = {
      tour,
      enrollment,
      rides: [ride],
      refreshedAt: '2026-02-12T09:00:00.000Z',
    };

    getActiveTour.mockResolvedValue({ success: true, data: tour });
    getTourRiderByProfile.mockResolvedValue({ success: true, data: enrollment });
    getTourRides.mockResolvedValue({ success: true, data: { items: [ride] } });
    cacheActiveTourSnapshot.mockResolvedValue(undefined);
    getCachedActiveTourSnapshot.mockResolvedValue(snapshot);

    const renderer = await renderAsync(
      React.createElement(TourProvider, null, React.createElement(Consumer)),
    );

    await flushEffects();

    expect(getActiveTour).toHaveBeenCalledTimes(1);
    expect(getTourRiderByProfile).toHaveBeenCalledTimes(1);
    expect(getTourRides).toHaveBeenCalledTimes(1);
    expect(cacheActiveTourSnapshot).toHaveBeenCalledWith(snapshot);

    const payload = renderer.getByTestId('payload').props.children as string;
    const parsed = JSON.parse(payload) as {
      activeTourId: string | null;
      enrollmentStatus: string | null;
      isEnrolled: boolean;
      activeRideIds: string[];
    };

    expect(parsed.activeTourId).toBe('TOT-2026');
    expect(parsed.activeRideIds).toContain('RIDE001');
    expect(parsed.enrollmentStatus).toBe('ACTIVE');
    expect(parsed.isEnrolled).toBe(true);
  });

  it('keeps active tour and rides available when rider is not enrolled', async () => {
    const tour = baseTour();
    const ride = baseRide();
    const snapshot = {
      tour,
      enrollment: null,
      rides: [ride],
      refreshedAt: '2026-02-12T09:00:00.000Z',
    };

    getActiveTour.mockResolvedValue({ success: true, data: tour });
    getTourRiderByProfile.mockRejectedValue(new Error('Not enrolled'));
    getTourRides.mockResolvedValue({ success: true, data: { items: [ride] } });
    cacheActiveTourSnapshot.mockResolvedValue(undefined);
    getCachedActiveTourSnapshot.mockResolvedValue(snapshot);

    const renderer = await renderAsync(
      React.createElement(TourProvider, null, React.createElement(Consumer)),
    );

    await flushEffects();

    expect(getActiveTour).toHaveBeenCalledTimes(1);
    expect(getTourRiderByProfile).toHaveBeenCalledTimes(1);
    expect(getTourRides).toHaveBeenCalledTimes(1);
    expect(cacheActiveTourSnapshot).toHaveBeenCalledWith(snapshot);

    const payload = renderer.getByTestId('payload').props.children as string;
    const parsed = JSON.parse(payload) as {
      activeTourId: string | null;
      enrollmentStatus: string | null;
      isEnrolled: boolean;
      activeRideIds: string[];
    };

    expect(parsed.activeTourId).toBe('TOT-2026');
    expect(parsed.activeRideIds).toContain('RIDE001');
    expect(parsed.enrollmentStatus).toBeNull();
    expect(parsed.isEnrolled).toBe(false);
  });
});