/**
 * Unit tests for active tour cache helper logic.
 */

import { StageType } from '../../src/constants/stages';
import {
  resolveRideForDate,
  resolveTodaysRide,
} from '../../src/services/activeTourStore';
import { RideStatus, type Ride } from '../../src/types/ride';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const baseRide = (overrides: Partial<Ride>): Ride => ({
  rideId: 'RIDE001',
  date: '2026-02-11',
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
  status: RideStatus.PLANNED,
  ...overrides,
});

describe('resolveRideForDate', () => {
  it('returns the ride for the matching ISO date key', () => {
    const rides = [
      baseRide({ rideId: 'RIDE001', date: '2026-02-11' }),
      baseRide({ rideId: 'RIDE002', date: '2026-02-12' }),
    ];

    expect(resolveRideForDate(rides, '2026-02-12')?.rideId).toBe('RIDE002');
  });

  it('returns null when no ride matches the requested date', () => {
    const rides = [baseRide({ rideId: 'RIDE001', date: '2026-02-11' })];

    expect(resolveRideForDate(rides, '2026-02-13')).toBeNull();
  });
});

describe('resolveTodaysRide', () => {
  it('uses the UTC date portion of the reference time', () => {
    const rides = [
      baseRide({ rideId: 'RIDE001', date: '2026-02-11' }),
      baseRide({ rideId: 'RIDE002', date: '2026-02-12' }),
    ];

    const referenceDate = new Date('2026-02-12T23:15:00.000Z');

    expect(resolveTodaysRide(rides, referenceDate)?.rideId).toBe('RIDE002');
  });
});