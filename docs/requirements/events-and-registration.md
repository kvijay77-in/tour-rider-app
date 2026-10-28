# Events and registration

_Last updated: 2026-10-01_

## Rider event list

- Events are available from the authenticated drawer alongside Tour.
- The app lists events for the rider's tour participations and places the active tour first.
- Each event shows its name, type, location, and whether occurrence registration is required.
- Event details show activities in `sequenceNo` order, mandatory markers, and occurrences by date and sequence number with status.

## Occurrence registration

- The event bootstrap provides caller-aware registration and resolved self-service permissions for future `PLANNED` and `ACTIVE` occurrences. The rider progress registration list supplies effective registration state for listed occurrences outside that bootstrap window.
- For events with registration enabled, every occurrence shows Registered or Not registered. Register and Un-register are available only while that occurrence is `PLANNED`.
- For events without registration, show **All tour riders participate** and do not present registration actions.
- Refresh bootstrap and rider progress after registration mutations, on pull-to-refresh, and when the details screen regains focus.

## Participation and progress

- Participation controls are available only for `ACTIVE` occurrences and, when registration is enabled, only for registered riders.
- Show each activity's progress as Complete, Opted out, or Pending. Mark records with `method === 'SELF_SERVICE'` as **Self**.
- Show Mark complete and Opt out only when the bootstrap's occurrence-level activity permission is `selfServiceAllowed: true`. Show Opt out only when the activity allows it.
- When `variantOptions` is present, require an option selection before Mark complete. Submit the selected option to the Rider API.
- Show Cancel for an existing caller progress record only while bootstrap still permits self-service and the record ID is present. Refresh after cancellation so the action can be repeated when the record is absent.
- Activities without a resolved self-service permission remain status-only. The app does not reconstruct event/activity/occurrence permission inheritance, activity assignments, prerequisites, or sequence policy; the API enforces those rules.
- On failed mutations, map registration, occurrence, permission, ownership, duplicate, prerequisite, and option errors to clear messages, then refresh bootstrap/progress.
- Do not add QR scanning or baggage custody/reconciliation to the Rider App. Baggage reconciliation is staff functionality in the Management App.