# Tours and registration

_Last updated: 2026-09-29_

## Available in the current navigation

- From Home or the drawer, Tour presents the active tour, when enrolled, alongside historical tours in a searchable selection. Selecting a tour lists its rides; selecting a ride opens ride details, including route, stages and elevation information when supplied.
- An active tour snapshot is loaded for enrolled riders; the app checks enrollment status before presenting active ride data. Historical tour and ride data can be locally cached, but there is no supported offline mode.

## Implemented screens not currently linked into navigation

- `TourListScreen` lists available tours; `TourDetailsScreen` shows a tour; `TourRegistrationScreen` accepts experience level and optional medical conditions and special requirements, and submits an approval request. Submission does not itself guarantee a place on the tour.
- `TourDashboardScreen` shows a tour banner, today's ride, a statistics placeholder, and confirmed “Not Riding Today” and “Quit Riding” actions for the current ride. Those actions cannot be accessed through the currently mounted drawer/stack.

Do not describe these unmounted screens as available rider journeys until they are connected to navigation. For registration states and API behavior see the backend [API reference](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/design/api-reference.md).
