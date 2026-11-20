# Development guide

_Last updated: 2026-09-30_

## Get started

Install a compatible Node.js/npm toolchain, then from the repository root run `npm ci`. Copy `.env.example` to `.env` and fill in the Dev values supplied by the backend deployment (never commit `.env`). Local runs default to the Production variant's identity; set `APP_VARIANT=test` to see the Test name, scheme and TEST banner. Store builds use EAS environment variables only; see the [EAS build and release guide](eas-build-and-release.md). Run `npm start` to start Expo; use `npm run android`, `npm run ios` (macOS) or `npm run web` for platform-specific development. No global Expo CLI installation is needed.

Run `npm run lint`, `npx tsc --noEmit` and `npm test -- --runInBand` to check code changes. The existing Jest configuration and `tests/` folder contain component and service tests.

## Project structure

Folder trees remain plain text so the actual paths are easy to find:

```text
tour-rider-app/
├── App.tsx                  app entry and providers
├── app.json                 static Expo application metadata
├── app.config.ts            variant (Test / Production) identity from APP_VARIANT
├── .github/workflows/       deploy.yml: manual EAS build + store submit
├── eas.json                 EAS build and submit profiles
├── .env.example             build-time configuration example
├── assets/                  images and fonts
├── docs/
│   ├── requirements/        implemented feature requirements
│   ├── design/              architecture and technical design
│   ├── guides/              development and distribution
│   ├── user-guide/          rider instructions
│   └── misc/                historical material
├── tools/                   operator scripts (backend-config.mjs: EAS sync from SSM)
├── src/
│   ├── components/          checkin, common, home, profile, tour
│   ├── config/              Amplify, subscription, app variant and reviewer routing
│   ├── constants/           colors and ride stages
│   ├── context/             Auth, Rider, Tour, Notification providers
│   ├── hooks/               provider access hooks
│   ├── navigation/          root, auth, drawer, tour stack; legacy MainNavigator
│   ├── profile-schema/      dynamic form definitions, binding and validation
│   ├── screens/             auth, checkin, home, notifications, profile, tour, training
│   ├── services/            API, push and limited local caches
│   ├── types/               domain and navigation types
│   └── utils/               logging, formatting and validation
└── tests/                   Jest tests
```

The auth screens include `EnforcedPasswordChangeScreen`; common components include `SearchableSelectField`, `PasswordInput`, `NotificationBell` and `TestVariantBanner`. `src/services/accountDeletionService.ts` implements Delete my account. `MainNavigator` is a bottom-tab implementation but **not** the active navigator: the root mounts `MainDrawerNavigator` through `AppNavigator`. See [architecture](../design/architecture.md) for reachable screens.

All app data requests use the shared `apiClient` and backend-owned [API contract](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/design/api-reference.md). Caches do not provide a supported offline mode. Use the backend [RBAC source](https://github.com/kvijay77-in/tour-data-api/blob/main/src/layers/common/rbac.py) for permission names. Report proposed changes to the folder structure for review before changing this guide.
