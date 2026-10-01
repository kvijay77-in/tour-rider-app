# Tours and registration

_Last updated: 2026-10-01_

## Available in the current navigation

- From Home or the drawer, Tour presents the active tour, when enrolled, alongside historical tours in a searchable selection. Selecting a tour lists its rides; selecting a ride opens ride details, including route, stages and expected times. Registered rides lazily load the rider's check-in history. When history exists, the rider can choose Ride info or Check-In; without history, Ride info remains the direct action and the status affordance explains that no records are available. The Home active-tour quick access and the Check-In view also provide self-check-in for today's ride only, using a freshly fetched live ride and rider history. There is no elevation profile in this view.
- An active tour snapshot is loaded for enrolled riders; the app checks enrollment status before presenting active ride data. Historical tour and ride data can be locally cached, but there is no supported offline mode.

## Implemented screens not currently linked into navigation

- `TourListScreen` lists available tours; `TourDetailsScreen` shows a tour; `TourRegistrationScreen` accepts experience level and optional medical conditions and special requirements, and submits an approval request. Submission does not itself guarantee a place on the tour.
- `TourDashboardScreen` shows a tour banner, today's ride and a statistics placeholder, but is not linked into the current navigation. Today's **Not Riding**, stage check-in and **Quit Riding** actions are available from Home and the mounted Check-In view when the active-tour and backend policy rules allow them.

The Tour stack's parameterized Check-In Status screen is the mounted rider journey. The legacy registration and dashboard screens remain unmounted and must not be described as available journeys. For registration states and API behavior see the backend [API reference](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/design/api-reference.md).
