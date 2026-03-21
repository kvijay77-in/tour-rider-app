/**
 * Unit tests for src/services/api/tourRegistrationApi.ts
 */

import { submitTourRegistration } from '../../src/services/api/tourRegistrationApi';
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

const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('submitTourRegistration', () => {
  it('posts registration data to correct endpoint', async () => {
    const registration = {
      profileId: 'P1',
      experienceLevel: 'Intermediate' as const,
      medicalConditions: 'None',
    };

    mockedPost.mockResolvedValueOnce({
      success: true,
      data: { riderId: 'R1', profileId: 'P1', status: 'PENDING' },
      timestamp: '',
    });

    const result = await submitTourRegistration('T1', registration);
    expect(mockedPost).toHaveBeenCalledWith('/v1/tours/T1/riders', registration);
    expect(result.data?.riderId).toBe('R1');
    expect(result.data?.status).toBe('PENDING');
  });

  it('encodes tourId with special characters', async () => {
    mockedPost.mockResolvedValueOnce({ success: true, timestamp: '' });
    await submitTourRegistration('TOUR/2026', {
      profileId: 'P1',
      experienceLevel: 'Beginner',
    });
    expect(mockedPost.mock.calls[0][0]).toContain(encodeURIComponent('TOUR/2026'));
  });
});
