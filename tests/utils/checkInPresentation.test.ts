import {
  canCancelCheckIn,
  getAvailableSelfCheckInActions,
  getCheckInApiErrorMessage,
  getCheckInMethodLabel,
  getCheckInSummary,
  getRideCheckInCardState,
  sortCheckIns,
} from '../../src/utils/checkInPresentation';
import type { CheckIn } from '../../src/types/checkin';
import type { Ride } from '../../src/types/ride';
import { RideStatus } from '../../src/types/ride';
import { StageType } from '../../src/constants/stages';

function makeCheckIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    checkInId: 'ci-1',
    riderId: 'R1',
    rideId: 'ride-1',
    stageNumber: 1,
    stageId: 'stage-1',
    timestamp: '2026-01-01T10:00:00Z',
    checkedInBy: 'profile-1',
    isNotRiding: false,
    isQuitRiding: false,
    ...overrides,
  };
}

function makeRide(overrides: Partial<Ride> = {}): Ride {
  return {
    rideId: 'ride-1',
    date: '2026-01-01',
    rideNo: 1,
    name: 'Day 1',
    startLocation: 'A',
    finishLocation: 'B',
    totalDistance: 10,
    stages: [{ stageId: 'stage-1', stageNumber: 1, type: StageType.START, name: 'Start' }],
    status: RideStatus.OPEN,
    selfService: {
      quitRidingAllowed: false,
      notRidingAllowed: false,
      stages: [{ stageNumber: 1, stageId: 'stage-1', stageType: StageType.START, checkInAllowed: true }],
    },
    ...overrides,
  };
}

describe('checkInPresentation', () => {
  it('orders records by stage and then timestamp', () => {
    const records = [
      makeCheckIn({ checkInId: 'late', stageNumber: 2 }),
      makeCheckIn({ checkInId: 'early', timestamp: '2026-01-01T09:00:00Z' }),
    ];

    expect(sortCheckIns(records).map((record) => record.checkInId)).toEqual(['early', 'late']);
  });

  it('treats empty records as an explicit unavailable summary', () => {
    const summary = getCheckInSummary([]);
    expect(summary.hasData).toBe(false);
    expect(summary.timeline).toEqual([]);
  });

  it('derives the three ride card states', () => {
    expect(getRideCheckInCardState(false, [])).toBe('UNREGISTERED');
    expect(getRideCheckInCardState(true, [])).toBe('REGISTERED_WITHOUT_DATA');
    expect(getRideCheckInCardState(true, [makeCheckIn()])).toBe('REGISTERED_WITH_DATA');
  });

  it('labels self-created and staff-created records', () => {
    expect(getCheckInMethodLabel('SELF_SERVICE')).toBe('Self');
    expect(getCheckInMethodLabel('QR_SCAN')).toBe('Staff scan');
  });

  it('allows cancellation only for an owned non-quit record on an active ride', () => {
    expect(canCancelCheckIn(makeCheckIn({ method: 'SELF_SERVICE' }), 'profile-1', makeRide())).toBe(true);
    expect(canCancelCheckIn(makeCheckIn({ isQuitRiding: true }), 'profile-1', makeRide())).toBe(false);
    expect(canCancelCheckIn(makeCheckIn(), 'profile-2', makeRide())).toBe(false);
    expect(canCancelCheckIn(makeCheckIn(), 'profile-1', makeRide({ status: RideStatus.COMPLETED }))).toBe(false);
    expect(canCancelCheckIn(makeCheckIn({ method: 'QR_SCAN' }), 'profile-1', makeRide())).toBe(true);
    expect(canCancelCheckIn(makeCheckIn(), 'profile-1', makeRide({ selfService: undefined }))).toBe(false);
  });

  it('shows only backend-permitted current ride actions', () => {
    const ride = makeRide({
      status: RideStatus.STARTED,
      stages: [
        { stageId: 'stage-1', stageNumber: 1, type: StageType.START, name: 'Start' },
        { stageId: 'stage-2', stageNumber: 2, type: StageType.PIT_STOP, name: 'Pit Stop', pitStopStatus: 'OPEN' },
        { stageId: 'stage-3', stageNumber: 3, type: StageType.FINISH, name: 'Finish' },
      ],
      selfService: {
        quitRidingAllowed: true,
        notRidingAllowed: true,
        stages: [
          { stageNumber: 1, stageId: 'stage-1', stageType: StageType.START, checkInAllowed: true },
          { stageNumber: 2, stageId: 'stage-2', stageType: StageType.PIT_STOP, checkInAllowed: true },
          { stageNumber: 3, stageId: 'stage-3', stageType: StageType.FINISH, checkInAllowed: true },
        ],
      },
    });

    expect(getAvailableSelfCheckInActions(ride, [])).toEqual(['START', 'PIT_STOP', 'FINISH', 'QUIT_RIDING']);
    expect(getAvailableSelfCheckInActions({ ...ride, selfService: undefined }, [])).toEqual([]);
    expect(getAvailableSelfCheckInActions({
      ...ride,
      stages: ride.stages.map((stage) => stage.type === StageType.PIT_STOP
        ? { ...stage, pitStopStatus: 'CLOSED' }
        : stage),
    }, [])).toEqual(['START', 'FINISH', 'QUIT_RIDING']);
    expect(getAvailableSelfCheckInActions(ride, [makeCheckIn({ stageNumber: 1 })]))
      .toEqual(['PIT_STOP', 'FINISH', 'QUIT_RIDING']);
    expect(getAvailableSelfCheckInActions(ride, [makeCheckIn({ stageNumber: 3 })]))
      .toEqual(['START', 'PIT_STOP']);
    expect(getAvailableSelfCheckInActions(ride, [makeCheckIn({ isQuitRiding: true })])).toEqual([]);
    [RideStatus.PLANNED, RideStatus.ACTIVE, RideStatus.COMPLETED, RideStatus.CLOSED].forEach((status) => {
      expect(getAvailableSelfCheckInActions({ ...ride, status }, [])).toEqual([]);
    });
    expect(getAvailableSelfCheckInActions({
      ...ride,
      selfService: {
        ...ride.selfService!,
        stages: ride.selfService!.stages.map((stage) => ({ ...stage, checkInAllowed: false })),
      },
    }, [])).toEqual(['QUIT_RIDING']);
  });

  it('shows Not Riding only before Start and permits it only while the ride is open', () => {
    const ride = makeRide({ selfService: {
      quitRidingAllowed: false,
      notRidingAllowed: true,
      stages: [{ stageNumber: 1, stageId: 'stage-1', stageType: StageType.START, checkInAllowed: true }],
    } });
    expect(getAvailableSelfCheckInActions(ride, [])).toContain('NOT_RIDING');
    expect(getAvailableSelfCheckInActions(ride, [makeCheckIn({ stageNumber: 1 })])).not.toContain('NOT_RIDING');
    expect(getAvailableSelfCheckInActions(ride, [makeCheckIn({ isNotRiding: true })])).not.toContain('NOT_RIDING');
    expect(getAvailableSelfCheckInActions(ride, [makeCheckIn({ isNotRiding: true })])).toEqual([]);
    expect(getAvailableSelfCheckInActions({ ...ride, status: RideStatus.STARTED }, [])).not.toContain('NOT_RIDING');
  });

  it('does not offer Quit Riding after Finish, and permits cancellation only under current policy', () => {
    const ride = makeRide({
      status: RideStatus.STARTED,
      stages: [
        { stageId: 'stage-1', stageNumber: 1, type: StageType.START, name: 'Start' },
        { stageId: 'stage-2', stageNumber: 2, type: StageType.FINISH, name: 'Finish' },
      ],
      selfService: {
        quitRidingAllowed: true,
        notRidingAllowed: true,
        stages: [
          { stageNumber: 1, stageId: 'stage-1', stageType: StageType.START, checkInAllowed: true },
          { stageNumber: 2, stageId: 'stage-2', stageType: StageType.FINISH, checkInAllowed: true },
        ],
      },
    });
    expect(getAvailableSelfCheckInActions(ride, [makeCheckIn({ stageNumber: 2 })])).not.toContain('QUIT_RIDING');
    expect(canCancelCheckIn(makeCheckIn({ stageNumber: 2 }), 'profile-1', ride)).toBe(true);
    expect(canCancelCheckIn(makeCheckIn({ stageNumber: 2 }), 'profile-1', {
      ...ride,
      selfService: { ...ride.selfService!, stages: [] },
    })).toBe(false);
  });

  it('maps named API errors', () => {
    expect(getCheckInApiErrorMessage('PIT_STOP_NOT_OPEN')).toBe('This pit stop is not open for check-in.');
    expect(getCheckInApiErrorMessage('UNKNOWN')).toBeNull();
    [
      'SELF_CHECKIN_NOT_ALLOWED',
      'PIT_STOP_NOT_OPEN',
      'RIDE_NOT_ACTIVE',
      'RIDE_NOT_TODAY',
      'NOT_RIDING_NOT_AVAILABLE',
      'QUIT_RIDING_NOT_AVAILABLE',
      'RIDER_ALREADY_QUIT',
      'QUIT_RIDING_CANCEL_NOT_ALLOWED',
      'NOT_OWN_CHECKIN',
      'TOUR_NOT_ACTIVE',
      'RIDER_NOT_IN_TOUR',
    ].forEach((code) => expect(getCheckInApiErrorMessage(code)).toBeTruthy());
  });
});