# Events design

_Last updated: 2026-10-01_

The Rider App uses the event endpoints in the tour-data-api Rider API. `eventApi` owns typed calls and URL encoding; `EventsScreen` groups a rider's tour participations with the active tour first; `EventDetailsScreen` loads the selected event, occurrences, bootstrap, and rider progress. The Events stack is mounted as a drawer destination next to Tour.

## Data ownership

- `GET /v1/tours/{tourId}/events` supplies list-card event definitions.
- `GET /v1/tours/{tourId}/events/bootstrap` is the caller-aware source for registration and resolved per-activity `selfServiceAllowed` values on future `PLANNED` and `ACTIVE` occurrences.
- `GET /v1/tours/{tourId}/riders/{riderId}/events/progress` supplies the caller's non-cancelled activity status/method/record ID and registration state. Its registration list covers listed occurrences outside bootstrap's future-occurrence window.
- `GET /v1/tours/{tourId}/events/{eventId}/occurrences` supplies date, sequence, and lifecycle status.
- Registration and self-record mutations use only Rider API endpoints. Refresh bootstrap and progress after both successful and failed mutations.

## Permission and action rules

The client checks occurrence lifecycle and registration state to present the requested controls, but uses only bootstrap's resolved activity boolean for self-service eligibility. It does not resolve event → occurrence → activity overrides or user assignments. The backend remains authoritative for lifecycle, registration, ordering, prerequisites, option validation, ownership, and permission checks.

Registered riders may register or unregister only for `PLANNED` occurrences when event registration is enabled. For `ACTIVE` occurrences, participation is available to registered riders or to all riders when registration is disabled. Self-service activity controls require the bootstrap permission; variant choices are required for completion when supplied; opt-out additionally requires `allowOptOut`. Existing own progress records may be cancelled only while bootstrap still permits self-service. After refresh, absent records are eligible for redo.

The event journey contains no QR scanner, baggage custody action, release workflow, or reconciliation UI. Those operational functions remain staff-side.