/** Rider-facing event contracts returned by tour-data-api. */

export type EventType = 'SINGLE' | 'REPEATING';
export type EventOccurrenceStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type EventActivityOutcome = 'COMPLETED' | 'OPTED_OUT';

export interface EventVariantOption {
  value: string;
  label?: string;
}

export interface EventActivity {
  activityId: string;
  name: string;
  sequenceNo: number;
  enabled?: boolean;
  mandatory?: boolean;
  allowOptOut?: boolean;
  selfServiceAllowed?: boolean;
  prerequisiteActivityIds?: string[];
  variantOptions?: Array<string | EventVariantOption>;
  notes?: string;
}

export interface EventDefinition {
  eventId: string;
  eventName: string;
  eventType: EventType;
  location: string;
  sequenceEnforced: boolean;
  registrationEnabled: boolean;
  selfServiceAllowed?: boolean;
  activities: EventActivity[];
}

export interface EventOccurrence {
  eventId: string;
  occurrenceId: string;
  date: string;
  seq: number;
  status: EventOccurrenceStatus;
}

export interface EventBootstrapActivityPermission {
  activityId: string;
  selfServiceAllowed: boolean;
}

export interface EventBootstrapOccurrence {
  eventId: string;
  occurrenceId: string;
  registered?: boolean;
  activitySelfService?: EventBootstrapActivityPermission[];
}

export interface EventBootstrap {
  events: EventDefinition[];
  activeOccurrences: EventBootstrapOccurrence[];
}

export interface EventProgressItem {
  eventId: string;
  occurrenceId: string;
  activityId: string;
  recordId?: string;
  status: EventActivityOutcome | 'FLAGGED' | 'PENDING';
  method?: string;
  timestamp?: string;
}

export interface EventProgressRegistration {
  eventId: string;
  occurrenceId: string;
  registrationEnabled: boolean;
  registered: boolean;
}

export interface RiderEventProgress {
  items: EventProgressItem[];
  registrations: EventProgressRegistration[];
}

export interface SelfEventRecordRequest {
  activityId: string;
  timestamp?: string;
  outcome?: EventActivityOutcome;
  variantSelected?: string;
}

export interface EventActivityRecord extends EventProgressItem {
  riderId: string;
  timestamp: string;
  method: string;
  outcome: EventActivityOutcome;
  activityName?: string;
}