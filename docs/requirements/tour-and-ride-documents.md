# Tour and ride documents

_Last updated: 2026-10-01_

## Manifest and visibility

- Fetch tour documents from `GET /v1/tours/{tourId}/artifacts` on the selected Tour screen and ride documents from `GET /v1/tours/{tourId}/rides/{rideId}/artifacts` on Ride Details.
- Make every non-image tour artifact returned by the manifest available for download in the Tour Documents section, including `rider-docket`. Do not restrict downloads to known artifact IDs or PDF files. Inline image selection does not filter the Documents section; image artifacts also remain downloadable.
- Treat an empty or 404 manifest as an available empty state and do not render a Documents section after loading completes.
- Preserve loading and failure states when a manifest cannot be loaded for another reason; offer a retry.
- Display API `title`, derived filename from the last `s3Key` path segment, optional `description`, a file-type icon, and only metadata supplied by the manifest. Do not invent a file size.

## Download and view

- For document downloads, do not retain presigned `downloadUrl` values in screen state. Fetch the selected artifact's current manifest when the rider opens it. Inline tour images use the temporary in-memory URLs described below.
- Download to Expo's app-private document directory and report byte progress. This location does not require external-storage permission.
- Open the locally saved file with the native share/view sheet and pass its MIME type. Surface sharing/viewing and transfer failures clearly.
- If the transfer fails, fetch the selected artifact manifest again and retry the transfer exactly once. Do not retry a second time; report the final failure.
- Do not persist presigned URLs, S3 credentials, or keys. Documents require a network connection and do not add offline behavior.

## Inline tour images

- Use `GET /v1/tours/{tourId}/artifacts` and stable artifact IDs, not filenames or titles: `ride-plan` for the Home Tour card, `training-challenge` for the Home card and Training Challenge page, and `tour-elevation` above the selected Tour screen's ride list.
- Home and Training Challenge use the active tour; Tour elevation uses the selected active or historical tour. Only display artifacts with an image content type and a download URL.
- Keep presigned image URLs only in memory while the screen is focused. Refresh the manifest on focus, tour changes, and Tour pull-to-refresh; clear URLs on blur. Never persist or log them.
- On image-load failure, fetch a fresh one-item manifest and retry once. Surface a terminal failure with manual retry. Missing images have no bundled fallback; Home navigation remains available without an image, and absent Training Challenge/elevation images are omitted.