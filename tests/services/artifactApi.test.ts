import { getRideArtifacts, getTourArtifacts } from '../../src/services/api/artifactApi';
import { apiClient, ApiError } from '../../src/services/api/apiClient';

jest.mock('../../src/services/api/apiClient', () => ({
  apiClient: { get: jest.fn() },
  ApiError: class ApiError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
    }
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

beforeEach(() => jest.clearAllMocks());

it('loads a tour manifest and normalizes the API array response', async () => {
  mockedGet.mockResolvedValueOnce({
    success: true,
    data: [{ artifactId: 'guide', s3Key: 'tours/T1/guide.pdf', contentType: 'application/pdf', downloadUrl: 'signed' }],
    timestamp: '',
  });

  const result = await getTourArtifacts('TOUR/1');
  expect(mockedGet).toHaveBeenCalledWith('/v1/tours/TOUR%2F1/artifacts', {
    params: undefined,
    isExpectedError: expect.any(Function),
  });
  expect(result.data).toHaveLength(1);
});

it('requests one ride artifact with an encoded scope and artifact ID query', async () => {
  mockedGet.mockResolvedValueOnce({ success: true, data: { items: [] }, timestamp: '' });
  await getRideArtifacts('T1', 'R/1', 'gpx route');
  expect(mockedGet).toHaveBeenCalledWith('/v1/tours/T1/rides/R%2F1/artifacts', {
    params: { artifactId: 'gpx route' },
    isExpectedError: expect.any(Function),
  });
});

it('returns an empty manifest for missing artifacts but preserves other API errors', async () => {
  mockedGet.mockRejectedValueOnce(new ApiError('not found', 404));
  await expect(getTourArtifacts('T1')).resolves.toMatchObject({ success: true, data: [] });

  mockedGet.mockRejectedValueOnce(new ApiError('forbidden', 403));
  await expect(getTourArtifacts('T1')).rejects.toMatchObject({ statusCode: 403 });
});