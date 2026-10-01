/** Rider event and registration API calls. */

import { apiClient } from './apiClient';
import { logger } from '../../utils/logger';
import type { ApiResponse } from '../../types/api';
import type {
  EventActivityRecord,
  EventBootstrap,
  EventDefinition,
  EventOccurrence,
  RiderEventProgress,
  SelfEventRecordRequest,
} from '../../types/event';

const TAG = 'EventApi';

function normalizeItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)) {
    return (payload as { items: T[] }).items;
  }
  return [];
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

export async function getEvents(tourId: string): Promise<ApiResponse<{ items: EventDefinition[] }>> {
  logger.debug(TAG, `Fetching events for tour ${tourId}`);
  const response = await apiClient.get<unknown>(`/v1/tours/${encode(tourId)}/events`);
  return response.success
    ? { ...response, data: { items: normalizeItems<EventDefinition>(response.data) } }
    : response as ApiResponse<{ items: EventDefinition[] }>;
}

export async function getEvent(tourId: string, eventId: string): Promise<ApiResponse<EventDefinition>> {
  logger.debug(TAG, `Fetching event ${eventId} for tour ${tourId}`);
  return apiClient.get<EventDefinition>(`/v1/tours/${encode(tourId)}/events/${encode(eventId)}`);
}

export async function getEventOccurrences(
  tourId: string,
  eventId: string,
): Promise<ApiResponse<{ items: EventOccurrence[] }>> {
  logger.debug(TAG, `Fetching occurrences for event ${eventId} in tour ${tourId}`);
  const response = await apiClient.get<unknown>(
    `/v1/tours/${encode(tourId)}/events/${encode(eventId)}/occurrences`,
  );
  return response.success
    ? { ...response, data: { items: normalizeItems<EventOccurrence>(response.data) } }
    : response as ApiResponse<{ items: EventOccurrence[] }>;
}

export async function getEventBootstrap(tourId: string): Promise<ApiResponse<EventBootstrap>> {
  logger.debug(TAG, `Fetching event bootstrap for tour ${tourId}`);
  return apiClient.get<EventBootstrap>(`/v1/tours/${encode(tourId)}/events/bootstrap`);
}

export async function getRiderEventProgress(
  tourId: string,
  riderId: string,
  eventId?: string,
): Promise<ApiResponse<RiderEventProgress>> {
  logger.debug(TAG, `Fetching event progress for rider ${riderId} in tour ${tourId}`);
  return apiClient.get<RiderEventProgress>(
    `/v1/tours/${encode(tourId)}/riders/${encode(riderId)}/events/progress`,
    eventId ? { params: { eventId } } : undefined,
  );
}

export async function registerForOccurrence(
  tourId: string,
  eventId: string,
  occurrenceId: string,
): Promise<ApiResponse<unknown>> {
  logger.info(TAG, `Registering for occurrence ${occurrenceId}`);
  return apiClient.post<unknown>(
    `/v1/tours/${encode(tourId)}/events/${encode(eventId)}/occurrences/${encode(occurrenceId)}/registration`,
    {},
  );
}

export async function unregisterFromOccurrence(
  tourId: string,
  eventId: string,
  occurrenceId: string,
): Promise<ApiResponse<unknown>> {
  logger.info(TAG, `Unregistering from occurrence ${occurrenceId}`);
  return apiClient.delete<unknown>(
    `/v1/tours/${encode(tourId)}/events/${encode(eventId)}/occurrences/${encode(occurrenceId)}/registration`,
  );
}

export async function submitSelfEventRecord(
  tourId: string,
  eventId: string,
  occurrenceId: string,
  body: SelfEventRecordRequest,
): Promise<ApiResponse<EventActivityRecord>> {
  logger.info(TAG, `Submitting self record for activity ${body.activityId}`);
  return apiClient.post<EventActivityRecord>(
    `/v1/tours/${encode(tourId)}/events/${encode(eventId)}/occurrences/${encode(occurrenceId)}/self-records`,
    body,
  );
}

export async function cancelSelfEventRecord(
  tourId: string,
  eventId: string,
  occurrenceId: string,
  recordId: string,
): Promise<ApiResponse<EventActivityRecord>> {
  logger.info(TAG, `Cancelling self record ${recordId}`);
  return apiClient.post<EventActivityRecord>(
    `/v1/tours/${encode(tourId)}/events/${encode(eventId)}/occurrences/${encode(occurrenceId)}/self-records/${encode(recordId)}/cancel`,
    {},
  );
}