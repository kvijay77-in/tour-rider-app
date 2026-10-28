# Tour and ride artifacts design

_Last updated: 2026-10-01_

`artifactApi` loads the backend's tour and ride manifests through `apiClient`. The API's array response is normalized to a typed item list; a 404 or empty manifest is a valid empty state. `DocumentsSection` is mounted in the selected Tour view and in Ride Details, and is omitted after an empty manifest.

The section stores only display metadata; `downloadUrl` is removed as soon as the manifest is read. Tapping an artifact fetches a one-item manifest for a fresh URL. `artifactTransferService` downloads into `Paths.document` with the SDK 57 `File.downloadFileAsync` progress callback, then opens the local URI with `expo-sharing`. App-private storage requires no public storage permission. A failed transfer refreshes the one-item manifest and retries one time; share/view errors are reported without repeating the download.

Document downloads have no client-side artifact ID or MIME allow-list. The tour manifest includes `rider-docket` and any other available non-image tour artifact; each is offered through the same download flow with its returned MIME type. The inline image IDs affect image display only and do not exclude any artifact from Documents.

The document UI displays the returned title, filename derived from the final `s3Key` component, optional description, content type/icon, and available version/update metadata. It does not display absent file-size data or expose S3 keys/URLs. Document download URLs are not cached beyond a user-initiated transfer operation.

`useTourArtifactImages` reads the tour manifest on screen focus and selects image content by the configured IDs `ride-plan`, `tour-elevation`, and `training-challenge`. Home and Training Challenge use `TourContext.activeTour`; Tour uses its selected tour and refreshes images on pull-to-refresh. Home cards display remote backgrounds; `TourArtifactImage` displays training and elevation images with contain sizing, loading/error states and retry. No bundled tour image is used as a fallback.

Inline images are an exception to the document-only URL lifetime: their presigned URLs remain in focused-screen memory for React Native image rendering, are cleared on blur, and are never persisted or logged. Image-load failures fetch a fresh filtered manifest and retry once per image, then expose manual retry. Request generations prevent late responses from replacing another tour's images. Existing document downloads remain unchanged.