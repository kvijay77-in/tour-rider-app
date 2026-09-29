# Check-in status

_Last updated: 2026-09-29_

`CheckInStatusScreen` implements a view of today's ride stages and check-in records. A stage can be Start, Pit Stop or Finish. The displayed overall state is Not Checked In, Checked In, Not Riding or Quit Riding, derived from the returned records. `CheckInHistoryScreen` lists rides and links to a status screen.

Neither check-in screen is currently mounted by the active navigator, so riders cannot open these views from the current drawer. “Not Riding Today” and “Quit Riding” submissions exist on the likewise unmounted tour dashboard; each requires confirmation, and Quit Riding requires two confirmations. This app does not scan riders in at a stage. Check-in records originate from the tour system.

The exact backend check-in contract is maintained in the [API reference](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/design/api-reference.md).
