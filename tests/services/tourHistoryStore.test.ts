/**
 * Unit tests for historical tour cache helper logic.
 */

import { StageType } from '../../src/constants/stages';
import { RideStatus, type Ride } from '../../src/types/ride';
import { TourStatus, type Tour } from '../../src/types/tour';
import {
  filterHistoricalTours,
  sortRidesForDisplay,
  sortToursForDisplay,
} from '../../src/services/tourHistoryStore';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const baseTour = (overrides: Partial<Tour>): Tour => ({
  tourId: 'TOT-2026',
  name: 'Tour of Tamilnadu 2026',
  startDate: '2026-02-10',
  endDate: '2026-02-17',
  status: TourStatus.COMPLETED,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  ...overrides,
});

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

describe('filterHistoricalTours', () => {
  it('removes the active tour from the historical cache list', () => {
    const tours = [
      baseTour({ tourId: 'ACTIVE-1', status: TourStatus.ACTIVE, startDate: '2026-03-01' }),
      baseTour({ tourId: 'HIST-1', status: TourStatus.COMPLETED, startDate: '2026-02-01' }),
    ];

    expect(filterHistoricalTours(tours)).toEqual([tours[1]]);
  });
});

describe('sortToursForDisplay', () => {
  it('keeps the active tour first and sorts historical tours by recency', () => {
    const tours = [
      baseTour({ tourId: 'HIST-OLD', status: TourStatus.ARCHIVED, startDate: '2025-01-01' }),
      baseTour({ tourId: 'HIST-NEW', status: TourStatus.COMPLETED, startDate: '2026-02-01' }),
      baseTour({ tourId: 'ACTIVE-1', status: TourStatus.ACTIVE, startDate: '2026-03-01' }),
    ];

    expect(sortToursForDisplay(tours).map((tour) => tour.tourId)).toEqual([
      'ACTIVE-1',
      'HIST-NEW',
      'HIST-OLD',
    ]);
  });
});

describe('sortRidesForDisplay', () => {
  it('sorts rides by date and then ride number', () => {
    const rides = [
      baseRide({ rideId: 'RIDE002', date: '2026-02-12', rideNo: 2 }),
      baseRide({ rideId: 'RIDE001', date: '2026-02-11', rideNo: 1 }),
      baseRide({ rideId: 'RIDE003', date: '2026-02-11', rideNo: 3 }),
    ];

    expect(sortRidesForDisplay(rides).map((ride) => ride.rideId)).toEqual([
      'RIDE001',
      'RIDE003',
      'RIDE002',
    ]);
  });
});
