# Tour and ride documents

_Last updated: 2026-10-01_

## Manifest and visibility

- Fetch tour documents from `GET /v1/tours/{tourId}/artifacts` on the selected Tour screen and ride documents from `GET /v1/tours/{tourId}/rides/{rideId}/artifacts` on Ride Details.
- Treat an empty or 404 manifest as an available empty state and do not render a Documents section after loading completes.
- Preserve loading and failure states when a manifest cannot be loaded for another reason; offer a retry.
- Display API `title`, derived filename from the last `s3Key` path segment, optional `description`, a file-type icon, and only metadata supplied by the manifest. Do not invent a file size.

## Download and view

- Do not retain presigned `downloadUrl` values in screen state. Fetch the selected artifact's current manifest when the rider opens it.
- Download to Expo's app-private document directory and report byte progress. This location does not require external-storage permission.
- Open the locally saved file with the native share/view sheet and pass its MIME type. Surface sharing/viewing and transfer failures clearly.
- If the transfer fails, fetch the selected artifact manifest again and retry the transfer exactly once. Do not retry a second time; report the final failure.
- Do not persist presigned URLs, S3 credentials, or keys. Documents require a network connection and do not add offline behavior.