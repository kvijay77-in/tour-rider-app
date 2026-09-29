# Rider profile

_Last updated: 2026-09-29_

- A signed-in rider can create, view and edit their profile; required profile fields must be completed before entering the main app.
- The profile form uses definitions supplied by the backend configuration, including field visibility, required fields, choices and validation. The app does not define a fixed organizer-wide field list.
- A rider can choose a profile picture from their photo library, upload it and see it with their profile when available. The interface handles missing or inaccessible photos. Taking a picture directly in the app is not implemented.
- Profile definitions may be cached to recover the form after a failed refresh; profile edits and picture uploads still require connectivity. There is no offline mode.

See [profile schema design](../design/profile-schema.md). The backend [API reference](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/design/api-reference.md) owns the data contract.
