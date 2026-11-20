import {
  cancelSelfEventRecord,
  getEventBootstrap,
  getEventOccurrences,
  getEvents,
  getRiderEventProgress,
  registerForOccurrence,
  submitSelfEventRecord,
  unregisterFromOccurrence,
} from '../../src/services/api/eventApi';
import { apiClient } from '../../src/services/api/apiClient';

jest.mock('../../src/services/api/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockedDelete = apiClient.delete as jest.MockedFunction<typeof apiClient.delete>;

beforeEach(() => jest.clearAllMocks());

it('normalizes event and occurrence list payloads', async () => {
  mockedGet
    .mockResolvedValueOnce({ success: true, data: [{ eventId: 'E1' }], timestamp: '' })
    .mockResolvedValueOnce({ success: true, data: { items: [{ occurrenceId: 'E1#D#1' }] }, timestamp: '' });

  expect((await getEvents('TOUR/1')).data?.items).toEqual([{ eventId: 'E1' }]);
  expect(mockedGet).toHaveBeenNthCalledWith(1, '/v1/tours/TOUR%2F1/events');
  expect((await getEventOccurrences('TOUR/1', 'E#1')).data?.items).toEqual([{ occurrenceId: 'E1#D#1' }]);
  expect(mockedGet).toHaveBeenNthCalledWith(2, '/v1/tours/TOUR%2F1/events/E%231/occurrences');
});

it('loads bootstrap and caller progress from their Rider API paths', async () => {
  mockedGet.mockResolvedValue({ success: true, data: { items: [], registrations: [] }, timestamp: '' });
  await getEventBootstrap('T1');
  await getRiderEventProgress('T1', 'R/1', 'EVT1');

  expect(mockedGet).toHaveBeenNthCalledWith(1, '/v1/tours/T1/events/bootstrap');
  expect(mockedGet).toHaveBeenNthCalledWith(2, '/v1/tours/T1/riders/R%2F1/events/progress', {
    params: { eventId: 'EVT1' },
  });
});

it('sends registration, self-record and cancellation requests to encoded occurrence paths', async () => {
  mockedPost.mockResolvedValue({ success: true, timestamp: '' });
  mockedDelete.mockResolvedValue({ success: true, timestamp: '' });

  await registerForOccurrence('T1', 'E1', 'E1#2026-10-01#1');
  await unregisterFromOccurrence('T1', 'E1', 'E1#2026-10-01#1');
  await submitSelfEventRecord('T1', 'E1', 'E1#2026-10-01#1', {
    activityId: 'A1',
    outcome: 'COMPLETED',
    variantSelected: 'small',
  });
  await cancelSelfEventRecord('T1', 'E1', 'E1#2026-10-01#1', 'R1#A1#stamp');

  const occurrencePath = '/v1/tours/T1/events/E1/occurrences/E1%232026-10-01%231';
  expect(mockedPost).toHaveBeenNthCalledWith(1, `${occurrencePath}/registration`, {});
  expect(mockedDelete).toHaveBeenCalledWith(`${occurrencePath}/registration`);
  expect(mockedPost).toHaveBeenNthCalledWith(2, `${occurrencePath}/self-records`, {
    activityId: 'A1', outcome: 'COMPLETED', variantSelected: 'small',
  });
  expect(mockedPost).toHaveBeenNthCalledWith(3, `${occurrencePath}/self-records/R1%23A1%23stamp/cancel`, {});
});