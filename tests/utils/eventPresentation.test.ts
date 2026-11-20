import {
  getEventActivityActions,
  getEventActivityStatus,
  getEventErrorMessage,
  sortEventToursActiveFirst,
} from '../../src/utils/eventPresentation';
import type { EventActivity } from '../../src/types/event';

const activity: EventActivity = { activityId: 'A1', name: 'Check bag', sequenceNo: 1, allowOptOut: true };

describe('getEventActivityActions', () => {
  const base = {
    activity,
    occurrenceStatus: 'ACTIVE' as const,
    registrationEnabled: true,
    registered: true,
    selfServiceAllowed: true,
  };

  it('offers complete and opt-out only for an active, registered, permitted activity', () => {
    expect(getEventActivityActions(base)).toEqual({ canMarkComplete: true, canOptOut: true, canCancel: false });
    expect(getEventActivityActions({ ...base, occurrenceStatus: 'PLANNED' })).toEqual({
      canMarkComplete: false, canOptOut: false, canCancel: false,
    });
    expect(getEventActivityActions({ ...base, registered: false })).toEqual({
      canMarkComplete: false, canOptOut: false, canCancel: false,
    });
    expect(getEventActivityActions({ ...base, selfServiceAllowed: false })).toEqual({
      canMarkComplete: false, canOptOut: false, canCancel: false,
    });
  });

  it('allows participation without registration when the event disables registration', () => {
    expect(getEventActivityActions({ ...base, registrationEnabled: false, registered: false }).canMarkComplete).toBe(true);
  });

  it('allows cancel for an existing own progress record only when self-service remains allowed', () => {
    const record = { eventId: 'E1', occurrenceId: 'O1', activityId: 'A1', recordId: 'R1', status: 'COMPLETED' as const };
    expect(getEventActivityActions({ ...base, record })).toEqual({
      canMarkComplete: false, canOptOut: false, canCancel: true,
    });
    expect(getEventActivityActions({ ...base, record: { ...record, recordId: undefined } }).canCancel).toBe(false);
  });
});

it('presents activity status and maps event API errors', () => {
  expect(getEventActivityStatus()).toBe('Pending');
  expect(getEventActivityStatus({ eventId: 'E1', occurrenceId: 'O1', activityId: 'A1', status: 'OPTED_OUT' })).toBe('Opted out');
  expect(getEventErrorMessage('REGISTRATION_CLOSED')).toContain('no longer planned');
  expect(getEventErrorMessage('PREREQUISITE_NOT_MET')).toContain('earlier activity');
  expect(getEventErrorMessage('VALIDATION_ERROR', 'variantSelected is required and must match variantOptions')).toContain('Choose a valid option');
  expect(getEventErrorMessage('DUPLICATE_ACTIVITY_RECORD')).toContain('already exists');
});

it.each([
  'REGISTRATION_CLOSED',
  'REGISTRATION_NOT_ENABLED',
  'REGISTRATION_NOT_FOUND',
  'RIDER_NOT_REGISTERED_FOR_EVENT',
  'OCCURRENCE_NOT_ACTIVE',
  'SELF_SERVICE_NOT_ALLOWED',
  'NOT_OWN_RECORD',
])('maps %s to a clear message', (code) => {
  expect(getEventErrorMessage(code)).not.toContain('could not be completed');
});

it('lists the active tour first and sorts the remaining tours by name', () => {
  const tours = [
    { tourId: 'T2', name: 'Zeta' },
    { tourId: 'T3', name: 'Alpha' },
    { tourId: 'T1', name: 'Current' },
  ];
  expect(sortEventToursActiveFirst(tours, 'T1').map((tour) => tour.tourId)).toEqual(['T1', 'T3', 'T2']);
});