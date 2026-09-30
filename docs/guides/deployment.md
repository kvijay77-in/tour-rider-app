# App build and distribution

_Last updated: 2026-09-30_

This guide concerns only configuration, building and distributing the Expo rider app. **All AWS resources, including the rider Cognito User Pool, are owned and deployed by tour-data-api**; follow the [backend deployment guide](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/guides/deployment.md) for infrastructure.

## App variants

One codebase builds two store apps: **Tour Rider (Test)** (`com.tourrider.app.dev`, Dev backend only) and **Tour Rider** (`com.tourrider.app`, Prod backend; the store-reviewer email is routed to Dev). `app.config.ts` selects the variant from `APP_VARIANT`, which the `eas.json` build profile sets. See [App variants and environments](../design/app-variants-and-environments.md).

## Configure the app

Store builds read values **only from EAS environment variables**: `preview` holds the Test (Dev) values and `production` holds the Prod values. `.env.example` lists the variable names only. For local development, use [`.env.example`](../../.env.example) as a template for a git-ignored local `.env`. The default `EXPO_PUBLIC_SUBSCRIPTION_MODE=single` packages one organizer's app configuration. `src/config/subscription.config.ts` reads `EXPO_PUBLIC_AWS_USER_POOL_ID`, `EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID`, `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL`, and optional organizer name/ID and identity pool ID; `EXPO_PUBLIC_LOG_LEVEL` sets logging. Values must come from the backend/operator's deployment. `EXPO_PUBLIC_` values are embedded in client builds and must **never** contain credentials or secrets. Do not commit a populated `.env`.

The config also defines a multi-organizer mode, but invitation discovery and organizer switching are not connected to the shipped sign-up flow. Distribute single-organizer builds unless that flow is implemented and tested.

## Build and distribute

Run `npm ci`, `npm run lint`, `npx tsc --noEmit` and `npm test -- --runInBand` before a release. Static settings are in `app.json`; package identifiers, name, scheme and icons come from `app.config.ts`. Build and submit with EAS: `eas build -p all --profile test --auto-submit` for the Test app and `--profile production` for the Production app. Follow the [EAS build and release guide](eas-build-and-release.md) for project setup, store records, credentials, environment variables, tester distribution and the release checklist. OTA updates are not used, and there is no app-release CI workflow. Use your web hosting process for web output.

Verify sign-in, forced password change, profile, Delete my account and Tour navigation against the backend environment before distribution. This app does not create the rider pool, its authorizer or API. Consult the backend [API reference](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/design/api-reference.md) for service contracts.
