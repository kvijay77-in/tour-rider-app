import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { SelfCheckInPanel } from '../../../src/components/checkin/SelfCheckInPanel';
import { useTour } from '../../../src/hooks/useTour';
import { useRider } from '../../../src/hooks/useRider';
import { cancelSelfCheckIn, getRiderRideCheckIns, submitSelfCheckIn } from '../../../src/services/api/checkInApi';
import { getTodaysRide } from '../../../src/services/api/rideApi';
import { StageType } from '../../../src/constants/stages';
import { TourRiderStatus, TourStatus, type Tour } from '../../../src/types/tour';
import { RideStatus, type Ride } from '../../../src/types/ride';
import type { CheckIn } from '../../../src/types/checkin';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactModule = require('react') as typeof React;
    ReactModule.useEffect(callback, [callback]);
  },
}));

jest.mock('../../../src/hooks/useTour', () => ({ useTour: jest.fn() }));
jest.mock('../../../src/hooks/useRider', () => ({ useRider: jest.fn() }));
jest.mock('../../../src/services/api/checkInApi', () => ({
  cancelSelfCheckIn: jest.fn(),
  getRiderRideCheckIns: jest.fn(),
  submitSelfCheckIn: jest.fn(),
}));
jest.mock('../../../src/services/api/rideApi', () => ({ getTodaysRide: jest.fn() }));
jest.mock('../../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedUseTour = useTour as jest.MockedFunction<typeof useTour>;
const mockedUseRider = useRider as jest.MockedFunction<typeof useRider>;
const mockedGetTodaysRide = getTodaysRide as jest.MockedFunction<typeof getTodaysRide>;
const mockedGetRiderRideCheckIns = getRiderRideCheckIns as jest.MockedFunction<typeof getRiderRideCheckIns>;
const mockedSubmit = submitSelfCheckIn as jest.MockedFunction<typeof submitSelfCheckIn>;
const mockedCancel = cancelSelfCheckIn as jest.MockedFunction<typeof cancelSelfCheckIn>;

const activeTour: Tour = {
  tourId: 'TOUR-1',
  name: 'Test Tour',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: TourStatus.ACTIVE,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const enrollment = {
  tourId: 'TOUR-1',
  riderId: 'R1',
  profileId: 'profile-1',
  status: TourRiderStatus.ACTIVE,
};

function makeRide(overrides: Partial<Ride> = {}): Ride {
  return {
    rideId: 'RIDE-1',
    date: new Date().toISOString().slice(0, 10),
    rideNo: 1,
    name: 'Day 1',
    startLocation: 'A',
    finishLocation: 'B',
    totalDistance: 20,
    status: RideStatus.OPEN,
    stages: [{ stageId: 'STAGE-1', stageNumber: 1, type: StageType.START, name: 'Start' }],
    selfService: {
      quitRidingAllowed: false,
      notRidingAllowed: true,
      stages: [{ stageId: 'STAGE-1', stageNumber: 1, stageType: StageType.START, checkInAllowed: true }],
    },
    ...overrides,
  };
}

function makeCheckIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    checkInId: 'CI-1',
    riderId: 'R1',
    rideId: 'RIDE-1',
    stageNumber: 1,
    stageId: 'STAGE-1',
    timestamp: '2026-10-01T06:00:00Z',
    checkedInBy: 'profile-1',
    method: 'MANUAL',
    isNotRiding: false,
    isQuitRiding: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseTour.mockReturnValue({
    activeTour,
    enrollment,
    activeRides: [],
    activeTodaysRide: null,
    activeSnapshotRefreshedAt: null,
    isEnrolled: true,
    isLoading: false,
    loadActiveTour: jest.fn(),
    setActiveTour: jest.fn(),
  });
  mockedUseRider.mockReturnValue({
    profile: { profileId: 'profile-1' } as ReturnType<typeof useRider>['profile'],
    hasProfile: true,
    hasCompleteProfileForAccess: true,
    profileDefinitions: null,
    isLoading: false,
    isLoadingDefinitions: false,
    error: null,
    definitionsError: null,
    loadProfile: jest.fn(),
    updateProfile: jest.fn(),
    uploadProfilePicture: jest.fn(),
    refreshProfile: jest.fn(),
    refreshProfileDefinitions: jest.fn(),
  });
  mockedGetTodaysRide.mockResolvedValue({ success: true, data: makeRide(), timestamp: '' });
  mockedGetRiderRideCheckIns.mockResolvedValue({
    success: true,
    data: { tourId: 'TOUR-1', riderId: 'R1', rideNo: 1, checkIns: [], available: false },
    timestamp: '',
  });
  mockedSubmit.mockResolvedValue({ success: true, data: makeCheckIn(), timestamp: '' });
  mockedCancel.mockResolvedValue({ success: true, data: makeCheckIn(), timestamp: '' });
});

describe('SelfCheckInPanel', () => {
  it('loads the current ride and posts only the confirmed stage body, then refreshes', async () => {
    const onRefresh = jest.fn();
    const { getByLabelText, getByText } = render(<SelfCheckInPanel onRefresh={onRefresh} />);

    fireEvent.press(await waitFor(() => getByLabelText('Check in at Start')));
    fireEvent.press(getByText('Confirm'));

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalledWith('TOUR-1', 'RIDE-1', { stageNumber: 1 }));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(mockedGetTodaysRide).toHaveBeenCalledTimes(2);
    expect(mockedGetRiderRideCheckIns).toHaveBeenCalledTimes(2);
  });

  it('posts the exact Not Riding body after confirmation', async () => {
    const { getByText } = render(<SelfCheckInPanel />);

    fireEvent.press(await waitFor(() => getByText('Not Riding')));
    fireEvent.press(getByText('Confirm'));

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalledWith('TOUR-1', 'RIDE-1', { isNotRiding: true }));
  });

  it('shows the Quit Riding safety notice and locks actions after the record is active', async () => {
    mockedGetTodaysRide.mockResolvedValue({
      success: true,
      data: makeRide({
        status: RideStatus.STARTED,
        selfService: {
          quitRidingAllowed: true,
          notRidingAllowed: false,
          stages: [{ stageId: 'STAGE-1', stageNumber: 1, stageType: StageType.START, checkInAllowed: true }],
        },
      }),
      timestamp: '',
    });
    mockedGetRiderRideCheckIns.mockResolvedValueOnce({
      success: true,
      data: { tourId: 'TOUR-1', riderId: 'R1', rideNo: 1, checkIns: [], available: false },
      timestamp: '',
    }).mockResolvedValueOnce({
      success: true,
      data: {
        tourId: 'TOUR-1', riderId: 'R1', rideNo: 1,
        checkIns: [makeCheckIn({ isQuitRiding: true })], available: true,
      },
      timestamp: '',
    });
    const { getByText, queryByLabelText } = render(<SelfCheckInPanel />);

    fireEvent.press(await waitFor(() => getByText('Quit Riding')));
    expect(getByText(/Organisers' advice/)).toBeTruthy();
    expect(getByText(/safe transport for you and your bike/)).toBeTruthy();
    expect(getByText('This cannot be undone from the app.')).toBeTruthy();
    expect(getByText('Only the organisers can cancel a Quit Riding check-in, after making sure you are safe to continue.')).toBeTruthy();
    fireEvent.press(getByText('Confirm'));

    await waitFor(() => expect(mockedSubmit).toHaveBeenCalledWith('TOUR-1', 'RIDE-1', { isQuitRiding: true }));
    expect(await waitFor(() => getByText('You have quit this ride.'))).toBeTruthy();
    expect(queryByLabelText('Check in at Start')).toBeNull();
    expect(queryByLabelText('Cancel Quit Riding check-in')).toBeNull();
  });

  it('offers cancel for the caller-owned staff record and refreshes after an API error', async () => {
    mockedGetRiderRideCheckIns.mockResolvedValue({
      success: true,
      data: {
        tourId: 'TOUR-1', riderId: 'R1', rideNo: 1,
        checkIns: [makeCheckIn()], available: true,
      },
      timestamp: '',
    });
    mockedCancel.mockResolvedValue({
      success: false,
      error: { code: 'SELF_CHECKIN_NOT_ALLOWED', message: 'Rejected' },
      timestamp: '',
    });
    const { getByLabelText, getByText } = render(<SelfCheckInPanel />);

    fireEvent.press(await waitFor(() => getByLabelText('Cancel Start check-in')));
    fireEvent.press(getByText('Cancel check-in'));

    await waitFor(() => expect(mockedCancel).toHaveBeenCalledWith('TOUR-1', 'RIDE-1', 'CI-1'));
    expect(await waitFor(() => getByText('Self check-in is not available for this ride or stage.'))).toBeTruthy();
    expect(mockedGetTodaysRide).toHaveBeenCalledTimes(2);
    expect(mockedGetRiderRideCheckIns).toHaveBeenCalledTimes(2);
  });

  it('restores an allowed check-in action after a successful cancellation refresh', async () => {
    mockedGetRiderRideCheckIns.mockResolvedValueOnce({
      success: true,
      data: {
        tourId: 'TOUR-1', riderId: 'R1', rideNo: 1,
        checkIns: [makeCheckIn()], available: true,
      },
      timestamp: '',
    }).mockResolvedValueOnce({
      success: true,
      data: { tourId: 'TOUR-1', riderId: 'R1', rideNo: 1, checkIns: [], available: false },
      timestamp: '',
    });
    const { getByLabelText, getByText, queryByLabelText } = render(<SelfCheckInPanel />);

    fireEvent.press(await waitFor(() => getByLabelText('Cancel Start check-in')));
    fireEvent.press(getByText('Cancel check-in'));

    await waitFor(() => expect(mockedCancel).toHaveBeenCalledWith('TOUR-1', 'RIDE-1', 'CI-1'));
    expect(await waitFor(() => getByLabelText('Check in at Start'))).toBeTruthy();
    expect(queryByLabelText('Cancel Start check-in')).toBeNull();
  });

  it('does not load actions for an unregistered rider or a ride other than today', async () => {
    mockedUseTour.mockReturnValue({
      activeTour,
      enrollment: null,
      activeRides: [],
      activeTodaysRide: null,
      activeSnapshotRefreshedAt: null,
      isEnrolled: false,
      isLoading: false,
      loadActiveTour: jest.fn(),
      setActiveTour: jest.fn(),
    });
    const unregistered = render(<SelfCheckInPanel />);
    expect(unregistered.toJSON()).toBeNull();
    expect(mockedGetTodaysRide).not.toHaveBeenCalled();

    mockedUseTour.mockReturnValue({
      activeTour,
      enrollment,
      activeRides: [],
      activeTodaysRide: null,
      activeSnapshotRefreshedAt: null,
      isEnrolled: true,
      isLoading: false,
      loadActiveTour: jest.fn(),
      setActiveTour: jest.fn(),
    });
    const staleRide = render(<SelfCheckInPanel expectedRideId="RIDE-OTHER" />);
    await waitFor(() => expect(mockedGetRiderRideCheckIns).not.toHaveBeenCalled());
    expect(staleRide.queryByText('Today\'s ride check-in')).toBeNull();
  });
});