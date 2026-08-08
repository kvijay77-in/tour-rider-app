/**
 * Unit tests for src/services/api/tourApi.ts
 */

import { getTours, getTourDetails, getTourRider, getTourRiderByProfile } from '../../src/services/api/tourApi';
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
// getTours
// ---------------------------------------------------------------------------

describe('getTours', () => {
  it('calls GET /v1/tours', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { items: [{ tourId: 'T1', name: 'Tour 1' }] },
      timestamp: '2026-01-01T00:00:00Z',
    });

    const result = await getTours();
    expect(mockedGet).toHaveBeenCalledWith('/v1/tours', { params: undefined });
    expect(result.success).toBe(true);
  });

  it('forwards query params', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, data: { items: [] }, timestamp: '' });
    await getTours({ status: 'ACTIVE' });
    expect(mockedGet).toHaveBeenCalledWith('/v1/tours', { params: { status: 'ACTIVE' } });
  });
});

// ---------------------------------------------------------------------------
// getTourDetails
// ---------------------------------------------------------------------------

describe('getTourDetails', () => {
  it('calls GET /v1/tours/{tourId}', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { tourId: 'T1', name: 'Test Tour' },
      timestamp: '',
    });

    const result = await getTourDetails('T1');
    expect(mockedGet).toHaveBeenCalledWith('/v1/tours/T1');
    expect(result.data).toEqual({ tourId: 'T1', name: 'Test Tour' });
  });

  it('encodes tourId with special characters', async () => {
    mockedGet.mockResolvedValueOnce({ success: true, timestamp: '' });
    await getTourDetails('TOUR/2026');
    expect(mockedGet).toHaveBeenCalledWith(`/v1/tours/${encodeURIComponent('TOUR/2026')}`);
  });
});

// ---------------------------------------------------------------------------
// getTourRider
// ---------------------------------------------------------------------------

describe('getTourRider', () => {
  it('calls GET /v1/tours/{tourId}/riders/{riderId}', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { riderId: 'R1', profileId: 'P1', status: 'ACTIVE' },
      timestamp: '',
    });

    await getTourRider('T1', 'R1');
    expect(mockedGet).toHaveBeenCalledWith('/v1/tours/T1/riders/R1');
  });
});

// ---------------------------------------------------------------------------
// getTourRiderByProfile
// ---------------------------------------------------------------------------

describe('getTourRiderByProfile', () => {
  it('calls GET /v1/tours/{tourId}/riders with profileId param', async () => {
    mockedGet.mockResolvedValueOnce({
      success: true,
      data: { riderId: 'R1', profileId: 'P1' },
      timestamp: '',
    });

    await getTourRiderByProfile('T1', 'P1');
    expect(mockedGet).toHaveBeenCalledWith('/v1/tours/T1/riders', {
      params: { profileId: 'P1' },
      isExpectedError: expect.any(Function),
    });
  });

  it('classifies 404 as expected for enrollment lookup', async () => {
    mockedGet.mockResolvedValueOnce({ success: false, error: { code: 'NOT_FOUND', message: 'not found' }, timestamp: '' });
    await getTourRiderByProfile('T1', 'P1');
    const options = mockedGet.mock.calls[0][1] as { isExpectedError?: (error: { statusCode: number }) => boolean };
    expect(options.isExpectedError?.({ statusCode: 404 })).toBe(true);
    expect(options.isExpectedError?.({ statusCode: 400 })).toBe(false);
  });
});
