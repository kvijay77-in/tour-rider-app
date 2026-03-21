/**
 * Unit tests for src/services/api/checkInApi.ts
 */

import { getRideCheckIns, submitNotRiding, submitQuitRiding } from '../../src/services/api/checkInApi';
import { apiClient } from '../../src/services/api/apiClient';

// Mock apiClient
jest.mock('../../src/services/api/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

// Suppress logger
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getRideCheckIns
// ---------------------------------------------------------------------------

describe('getRideCheckIns', () => {
  it('calls GET with correct path', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { items: [], total: 0 },
      timestamp: '2026-01-01T00:00:00Z',
    });

    await getRideCheckIns('TOUR-1', 'RIDE-1');
    expect(mockedGet).toHaveBeenCalledWith(
      '/v1/tours/TOUR-1/rides/RIDE-1/checkins',
      { params: undefined },
    );
  });

  it('passes query params through', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { items: [] },
      timestamp: '2026-01-01T00:00:00Z',
    });

    await getRideCheckIns('TOUR-1', 'RIDE-1', { riderId: 'R1' });
    expect(mockedGet).toHaveBeenCalledWith(
      '/v1/tours/TOUR-1/rides/RIDE-1/checkins',
      { params: { riderId: 'R1' } },
    );
  });

  it('encodes special characters in tour/ride IDs', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { items: [] },
      timestamp: '2026-01-01T00:00:00Z',
    });

    await getRideCheckIns('TOUR/1', 'RIDE/1');
    const path = mockedGet.mock.calls[0][0];
    expect(path).toContain(encodeURIComponent('TOUR/1'));
    expect(path).toContain(encodeURIComponent('RIDE/1'));
  });
});

// ---------------------------------------------------------------------------
// submitNotRiding
// ---------------------------------------------------------------------------

describe('submitNotRiding', () => {
  it('posts with correct body shape', async () => {
    mockedPost.mockResolvedValueOnce({
      success: true,
      data: { checkInId: 'ci-001' },
      timestamp: '2026-01-01T00:00:00Z',
    });

    await submitNotRiding('TOUR-1', { riderId: 'R1', rideId: 'RIDE-1' });

    const [path, body] = mockedPost.mock.calls[0];
    expect(path).toBe('/v1/tours/TOUR-1/checkins');
    expect(body).toMatchObject({
      riderId: 'R1',
      rideId: 'RIDE-1',
      isNotRiding: true,
      isQuitRiding: false,
      method: 'SELF_SERVICE',
    });
  });
});

// ---------------------------------------------------------------------------
// submitQuitRiding
// ---------------------------------------------------------------------------

describe('submitQuitRiding', () => {
  it('posts with correct body shape including rideId', async () => {
    mockedPost.mockResolvedValueOnce({
      success: true,
      data: { checkInId: 'ci-002' },
      timestamp: '2026-01-01T00:00:00Z',
    });

    await submitQuitRiding('TOUR-1', {
      riderId: 'R1',
      rideId: 'RIDE-1',
      reason: 'Mechanical issue',
      location: { latitude: -33.8688, longitude: 151.2093 },
    });

    const body = mockedPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.riderId).toBe('R1');
    expect(body.rideId).toBe('RIDE-1');
    expect(body.isQuitRiding).toBe(true);
    expect(body.isNotRiding).toBe(false);
    expect(body.notes).toBe('Mechanical issue');
    expect(body.location).toEqual({ latitude: -33.8688, longitude: 151.2093 });
  });

  it('omits notes/location when not provided', async () => {
    mockedPost.mockResolvedValueOnce({
      success: true,
      data: { checkInId: 'ci-003' },
      timestamp: '2026-01-01T00:00:00Z',
    });

    await submitQuitRiding('TOUR-1', { riderId: 'R1', rideId: 'RIDE-1' });

    const body = mockedPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.notes).toBeUndefined();
    expect(body.location).toBeUndefined();
  });
});
