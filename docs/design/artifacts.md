# Tour and ride artifacts design

_Last updated: 2026-10-01_

`artifactApi` loads the backend's tour and ride manifests through `apiClient`. The API's array response is normalized to a typed item list; a 404 or empty manifest is a valid empty state. `DocumentsSection` is mounted in the selected Tour view and in Ride Details, and is omitted after an empty manifest.

The section stores only display metadata; `downloadUrl` is removed as soon as the manifest is read. Tapping an artifact fetches a one-item manifest for a fresh URL. `artifactTransferService` downloads into `Paths.document` with the SDK 57 `File.downloadFileAsync` progress callback, then opens the local URI with `expo-sharing`. App-private storage requires no public storage permission. A failed transfer refreshes the one-item manifest and retries one time; share/view errors are reported without repeating the download.

The UI displays the returned title, filename derived from the final `s3Key` component, optional description, content type/icon, and available version/update metadata. It does not display absent file-size data or expose S3 keys/URLs. No artifact URL is cached beyond a user-initiated transfer operation.