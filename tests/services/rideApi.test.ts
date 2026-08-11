/**
 * Unit tests for src/services/api/rideApi.ts
 */

import { getTodaysRide, getTourRides } from '../../src/services/api/rideApi';
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

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getTodaysRide
// ---------------------------------------------------------------------------

describe('getTodaysRide', () => {
  it('calls GET /v1/tours/{tourId}/rides/today', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { rideId: 'R1', name: 'Day 1' },
      timestamp: '',
    });

    const result = await getTodaysRide('T1');
    expect(mockedGet).toHaveBeenCalledWith('/v1/tours/T1/rides/today');
    expect(result.data).toEqual({ rideId: 'R1', name: 'Day 1' });
  });

  it('encodes tourId', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, timestamp: '' });
    await getTodaysRide('TOUR/2026');
    expect(mockedGet).toHaveBeenCalledWith(`/v1/tours/${encodeURIComponent('TOUR/2026')}/rides/today`);
  });
});

// ---------------------------------------------------------------------------
// getTourRides
// ---------------------------------------------------------------------------

describe('getTourRides', () => {
  it('calls GET /v1/tours/{tourId}/rides', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { items: [{ rideId: 'R1' }, { rideId: 'R2' }] },
      timestamp: '',
    });

    const result = await getTourRides('T1');
    expect(mockedGet).toHaveBeenCalledWith('/v1/tours/T1/rides', { params: undefined });
    expect(result.data?.items).toHaveLength(2);
  });

  it('normalizes backend ride arrays into items', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { rides: [{ rideId: 'R1' }, { rideId: 'R2' }], total: 2 },
      timestamp: '',
    });

    const result = await getTourRides('T1');
    expect(result.data?.items).toEqual([{ rideId: 'R1' }, { rideId: 'R2' }]);
    expect(result.data?.total).toBe(2);
  });

  it('passes query params', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, data: { items: [] }, timestamp: '' });
    await getTourRides('T1', { status: 'COMPLETED' });
    expect(mockedGet).toHaveBeenCalledWith('/v1/tours/T1/rides', { params: { status: 'COMPLETED' } });
  });
});
