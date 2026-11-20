# Check-in status and self check-in

_Last updated: 2026-10-01_

`CheckInStatusScreen` is reachable from the active Tour ride flow. It accepts a tour, rider, ride ID and ride number, loads the Rider API history for that ride, and shows ordered Start, Pit Stop and Finish records. The displayed overall state is Not Checked In, Checked In, Not Riding or Quit Riding, derived from returned records. Records display their creation method, including **Self** for `SELF_SERVICE` records.

Registered rides with history offer a Ride info / Check-In choice. Registered rides without history remain direct Ride info and expose a Check-in status affordance; unregistered rides remain direct Ride info. A 404, missing table, empty response or future ride is an available state with no records, not a failure screen. This app does not scan riders at a stage.

## Today's self check-in

The Home active-tour quick access and Check-In view may show self-check-in actions only for the enrolled rider on the active tour's UTC-today ride. The app fetches the live today ride and the rider's current ride-number history on screen focus; a cached ride, another ride, a non-active tour, or a rider without an eligible enrollment cannot authorize an action. The API's `selfService` response is the sole source for stage and ride-level permission. The app does not infer or persist permission state.

- Stage actions appear only for permitted stages while the ride is `OPEN` or `STARTED`. A Pit Stop action appears only while that stage's live `pitStopStatus` is `OPEN`. An already-recorded active stage is not offered again until its eligible cancellation succeeds.
- **Not Riding** appears only when `selfService.notRidingAllowed` is true and the ride is `OPEN`, before a Start check-in.
- **Quit Riding** appears only when `selfService.quitRidingAllowed` is true, the ride is `STARTED`, and no Finish record exists. An active Quit Riding record hides every action and shows a quit banner.
- Every submission requires an accessible confirmation and sends exactly one of `{ stageNumber }`, `{ isNotRiding: true }`, or `{ isQuitRiding: true }` to the Rider self-check-in endpoint.
- The rider may cancel their own non-quit stage or Not Riding record while the ride is active and current backend policy still permits cancellation. Ownership is determined by `checkedInBy` matching the rider's profile ID; staff-created records owned by the rider are included. Quit Riding is never cancellable in the app. After cancellation, a permitted action can be repeated once the refreshed record is absent.
- Both the current ride and timeline are refreshed after a successful or failed submission/cancellation. Named Rider API errors are translated into rider-facing messages; unexpected errors use the standard network/error handling.

### Quit Riding and safety

> **Organisers' advice:** Wherever possible, quit at a Pit Stop so the team can record it for you and arrange safe transport for you and your bike. If you must quit on the road, contact the organisers immediately after confirming.
>
> **This cannot be undone from the app.** Only the organisers can cancel a Quit Riding check-in, after making sure you are safe to continue.

The app prohibits self-cancellation of Quit Riding because organizers must confirm the rider is safe before restoring them to the ride.

The exact backend check-in contract is maintained in the [API reference](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/design/api-reference.md).
