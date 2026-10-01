import type {
  EventActivity,
  EventOccurrenceStatus,
  EventProgressItem,
} from '../types/event';

export interface EventActivityActions {
  canMarkComplete: boolean;
  canOptOut: boolean;
  canCancel: boolean;
}

export function sortEventToursActiveFirst<T extends { tourId: string; name: string }>(
  tours: T[],
  activeTourId?: string,
): T[] {
  return [...tours].sort((left, right) => {
    if (left.tourId === activeTourId) return -1;
    if (right.tourId === activeTourId) return 1;
    return left.name.localeCompare(right.name);
  });
}

export function getEventActivityActions(input: {
  activity: EventActivity;
  occurrenceStatus: EventOccurrenceStatus;
  registrationEnabled: boolean;
  registered: boolean;
  selfServiceAllowed: boolean;
  record?: EventProgressItem;
}): EventActivityActions {
  const active = input.occurrenceStatus === 'ACTIVE';
  const participationAllowed = !input.registrationEnabled || input.registered;
  const permitted = active && participationAllowed && input.selfServiceAllowed;
  const hasRecord = input.record !== undefined && input.record.status !== 'PENDING';

  return {
    canMarkComplete: permitted && !hasRecord,
    canOptOut: permitted && input.activity.allowOptOut === true && !hasRecord,
    canCancel: permitted && hasRecord && Boolean(input.record?.recordId),
  };
}

export function getEventActivityStatus(record?: EventProgressItem): string {
  if (!record || record.status === 'PENDING') return 'Pending';
  if (record.status === 'OPTED_OUT') return 'Opted out';
  if (record.status === 'FLAGGED') return 'Needs attention';
  return 'Complete';
}

const EVENT_ERROR_MESSAGES: Record<string, string> = {
  REGISTRATION_CLOSED: 'Registration is closed because this occurrence is no longer planned.',
  REGISTRATION_NOT_ENABLED: 'Registration is not enabled for this event.',
  REGISTRATION_NOT_FOUND: 'You are not registered for this occurrence.',
  RIDER_NOT_REGISTERED_FOR_EVENT: 'Register for this occurrence before participating.',
  OCCURRENCE_NOT_ACTIVE: 'This occurrence is not active, so participation is unavailable.',
  SELF_SERVICE_NOT_ALLOWED: 'Self-service is not available for this activity. Contact the event team.',
  NOT_OWN_RECORD: 'This activity record does not belong to you and cannot be cancelled.',
  PREREQUISITE_NOT_MET: 'Complete the required earlier activity before continuing.',
  DUPLICATE_ACTIVITY_RECORD: 'A record already exists for this activity.',
  ACTIVITY_NOT_FOUND: 'This activity is no longer available.',
  EVENT_NOT_FOUND: 'This event is no longer available.',
  OCCURRENCE_NOT_FOUND: 'This occurrence is no longer available.',
  VARIANT_OPTION_REQUIRED: 'Choose an option before marking this activity complete.',
  INVALID_VARIANT_OPTION: 'That option is no longer available. Refresh and choose again.',
  OPT_OUT_NOT_ALLOWED: 'Opting out is not available for this activity.',
};

export function getEventErrorMessage(code?: string, apiMessage?: string): string {
  if (!code) return 'The event action could not be completed. Check your connection and try again.';
  if (code === 'VALIDATION_ERROR' && /variantSelected|variantOptions/i.test(apiMessage ?? '')) {
    return 'Choose a valid option before marking this activity complete.';
  }
  if (code === 'VALIDATION_ERROR' && apiMessage) return apiMessage;
  if (EVENT_ERROR_MESSAGES[code]) return EVENT_ERROR_MESSAGES[code];
  if (code.includes('VARIANT') || code.includes('OPTION')) {
    return 'The selected option is not valid. Refresh the event and try again.';
  }
  return 'The event action could not be completed. Check your connection and try again.';
}