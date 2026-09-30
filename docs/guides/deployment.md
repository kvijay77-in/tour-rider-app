# App build and distribution

_Last updated: 2026-09-29_

This guide concerns only configuration, building and distributing the Expo rider app. **All AWS resources, including the rider Cognito User Pool, are owned and deployed by tour-data-api**; follow the [backend deployment guide](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/guides/deployment.md) for infrastructure.

## Configure the app

Use [`.env.example`](../../.env.example) as a template for a local `.env`. The default `EXPO_PUBLIC_SUBSCRIPTION_MODE=single` packages one organizer's app configuration. `src/config/subscription.config.ts` reads `EXPO_PUBLIC_AWS_USER_POOL_ID`, `EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID`, `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL`, and optional organizer name/ID and identity pool ID; `EXPO_PUBLIC_LOG_LEVEL` sets logging. Values must come from the backend/operator's deployment. `EXPO_PUBLIC_` values are embedded in client builds and must **never** contain credentials or secrets. Do not commit a populated `.env`.

The config also defines a multi-organizer mode, but invitation discovery and organizer switching are not connected to the shipped sign-up flow. Distribute single-organizer builds unless that flow is implemented and tested.

## Build and distribute

Run `npm ci`, `npm run lint`, `npx tsc --noEmit` and `npm test -- --runInBand` before a release. Check `app.json` for package identifiers, app assets and platform configuration. Start Expo with `npm start` and test on intended devices. Use your organization's Expo/EAS build and store-distribution process for signed iOS/Android releases, or your web hosting process for web output. This repository has no checked-in `eas.json` or app-release CI workflow: configure those externally before claiming an automated release.

Verify sign-in, forced password change, profile and Tour navigation against the backend environment before distribution. This app does not create the rider pool, its authorizer or API. Consult the backend [API reference](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/design/api-reference.md) for service contracts.
