# Solution Design

[← Back to README](../README.md)

This document covers the solution design aspects of the Check-In App that must be adhered to at all times. If there is any conflict between the copilot-instructions.md and this document, it must be flagged for resolution.

This is an evolving document and hence latest info must be referred to at all times.

## Table of Contents

- [Design Principles](#design-principles)
- [Technology Stack](#technology-stack)
- [Application Architecture](#application-architecture)
- [Component Architecture](#component-architecture)
- [State Management](#state-management)
- [Authentication](#authentication)
- [Backend Integration](#backend-integration)
- [Offline Status](#offline-status)
- [Navigation Structure](#navigation-structure)
- [Styling Strategy](#styling-strategy)
- [Logging](#logging)
- [Platform Considerations](#platform-considerations)
- [App Distribution — Runtime Configuration](#app-distribution--runtime-configuration-single-app-multiple-organizers)

---

## Design Principles

1. **Common codebase** — App should have a single codebase to cater for Android, iOS, and Web App versions.
   - Any exception to have platform-specific code when common code is feasible must be flagged for review before proceeding with development.

2. **No direct AWS resource access** — Any direct access to AWS resources (DynamoDB, S3, etc.) from the Mobile App or Web client must not be permitted. Such access must always be through the tour-data-api backend (API Gateway → Lambda → DynamoDB).

3. **Amplify for authentication only** — AWS Amplify Auth SDK is used for Cognito authentication and JWT token management. Data access is via the RESTful tour-data-api, not Amplify Data/AppSync.

4. **Security by default** — No hardcoded credentials, no inline sensitive data, JWT-based authentication for all API calls, RBAC enforcement in the UI layer.

5. **Reactive UI** — Use React Context and Hooks for state management. No class components. Minimize re-renders through proper state structuring and memoization.

6. **Modular and reusable** — Components should be small, focused, and reusable. Business logic should be isolated in the services layer, not embedded in UI components.

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | React Native | 0.81.x | Cross-platform mobile |
| **Platform Tooling** | Expo (managed workflow) | SDK 54 | Build, deploy, native APIs |
| **Language** | TypeScript | ~5.x | Type safety |
| **Navigation** | React Navigation | 7.x | Screen navigation (native stack + bottom tabs) |
| **Authentication** | AWS Amplify Auth | 6.x | Cognito integration, JWT management |
| **HTTP Client** | fetch (built-in) | N/A | API calls to tour-data-api |
| **Connectivity** | @react-native-community/netinfo | 12.x | Network state detection (offline banner) |
| **Secure Storage** | expo-secure-store | 15.x | Sensitive data storage (tokens) |
| **Icons** | @expo/vector-icons | 15.x | UI icons |
| **SVG** | react-native-svg | 15.x | Custom SVG rendering |

### Why These Choices

- **Expo managed workflow**: Simplifies build and deployment across platforms. No need to eject for native modules — all required features are available via Expo SDK.
- **fetch over axios/other HTTP libraries**: Built into React Native, reduces bundle size. The apiClient wrapper adds retry, auth, and error handling.
- **React Context over Redux/MobX**: Application state is straightforward (active tour, auth state, role). Context + Hooks provides sufficient state management without additional dependencies.

---

## Application Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    App.tsx (Entry Point)                  │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Context Providers                       │ │
│  │  AuthContext → TourContext → OfflineContext → Role   │ │
│  │                                                      │ │
│  │  ┌───────────────────────────────────────────────┐  │ │
│  │  │            Navigation (React Navigation)       │  │ │
│  │  │                                                │  │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │  │ │
│  │  │  │Dashboard │ │ Check-In │ │  Admin   │      │  │ │
│  │  │  │ Screen   │ │  Screen  │ │  Screen  │      │  │ │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘      │  │ │
│  │  │       │             │             │            │  │ │
│  │  └───────┼─────────────┼─────────────┼────────────┘  │ │
│  └──────────┼─────────────┼─────────────┼───────────────┘ │
│             │             │             │                  │
│  ┌──────────┴─────────────┴─────────────┴───────────────┐ │
│  │                 Services Layer                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │ │
│  │  │ API      │  │           │           │ │
│  │  │ Client   │  │           │           │ │
│  │  └────┬─────┘  └──────────┘  └────┬─────┘           │ │
│  └───────┼────────────────────────────┼─────────────────┘ │
└──────────┼────────────────────────────┼───────────────────┘
           │                            │
           ▼                            ▼
    ┌──────────────┐            ┌──────────────┐
    │  tour-data-  │            │  tour-data-  │
    │  api (REST)  │            │  api (REST)  │
    └──────────────┘            └──────────────┘
```

### Layer Responsibilities

| Layer | Path | Responsibility |
|-------|------|---------------|
| **Screens** | `src/screens/` | Page-level components, layout, screen-specific logic |
| **Components** | `src/components/` | Reusable UI components, presentational logic |
| **Context** | `src/context/` | Global state management (auth, tour, offline status, role) |
| **Services** | `src/services/` | Business logic, API calls |
| **Types** | `src/types/` | TypeScript type definitions and interfaces |
| **Constants** | `src/constants/` | Application-wide constants (colors, roles, stages) |
| **Hooks** | `src/hooks/` | Custom React hooks for reusable stateful logic |
| **Utils** | `src/utils/` | Pure utility functions (formatting, validation, permissions) |
| **Config** | `src/config/` | Configuration (Amplify) |

---

## Component Architecture

### Screen Components

Screens are the top-level components rendered by the navigator. Each screen:
- Lives in its own folder under `src/screens/`
- May compose multiple smaller components
- Connects to context providers for global state
- Handles screen-level navigation logic

```
src/screens/
├── dashboard/
│   └── DashboardScreen.tsx      # Main dashboard with rider grid
├── checkin/                      # QR scanning, check-in flow
├── admin/                        # Ride management (add/modify/close)
└── auth/                         # Login, authentication screens
```

### Reusable Components

Components are organized by scope — common components used across screens, and feature-specific components:

```
src/components/
├── common/                       # Shared across all screens
│   └── SortIcon.tsx             # Custom sort toggle icon
├── dashboard/                    # Dashboard-specific components
└── checkin/                      # Check-in-specific components
```

### Component Guidelines

1. **Functional components only** — use hooks for state and effects
2. **Props over context** where possible — prefer explicit data flow
3. **Memoize expensive renders** — use `React.memo`, `useMemo`, `useCallback` appropriately
4. **Separate concerns** — keep styling in `StyleSheet.create()`, logic in hooks/services
5. **Type all props** — define TypeScript interfaces for component props

---

## State Management

### Context Providers

The app uses React Context for global state, structured in a provider hierarchy:

| Context | Purpose | Key State |
|---------|---------|-----------|
| **AuthContext** | Authentication state | User info, JWT tokens, login/logout |
| **TourContext** | Active tour context | `tourId`, tour details, resolved at startup |
| **OfflineContext** | Network connectivity state | `isOffline` — drives the offline status banner |
| **RoleContext** | RBAC role context | User role, permissions, feature-level access |

**Provider Order** (in `App.tsx`):
```
AuthContext
  → TourContext (depends on auth for API calls)
    → OfflineContext (independent, drives offline banner)
      → RoleContext (depends on auth for user role)
        → Navigation
```

### Local State

Screen-specific and component-specific state uses `useState` and `useReducer` hooks. Examples:
- Dashboard: current sort mode, active stage filter, zoom level
- Check-in: scan mode, selected check-in type, scan results
- Admin: form state for ride creation/modification

### Derived State

State that can be computed from other state should not be stored separately. Examples:
- Check-in status (derived from `isNotRiding` / `isQuitRiding` flags)
- Stage counts (derived from check-in data)
- Filtered/sorted rider lists (derived from riders + check-ins + filter/sort state)

---

## Authentication

### Flow

1. User opens app → `AuthContext` checks for existing Amplify session
2. If no session → navigate to login screen
3. User authenticates via `Amplify.Auth.signIn()` → Cognito returns JWT tokens
4. `AuthContext` stores auth state and provides it to child components
5. `TourContext` resolves active tour using authenticated API calls
6. Navigation routes user to Dashboard

### Token Management

- **Automatic refresh**: Amplify Auth SDK handles JWT token refresh transparently
- **Token injection**: `apiClient.ts` retrieves the current token from Amplify session and includes it as `Authorization: Bearer <token>` in every API request
- **401 handling**: If the API returns 401, the API client attempts token refresh and retries once
- **Secure storage**: Amplify uses `expo-secure-store` for token persistence

### Cognito Integration

The app uses the **same Cognito User Pool** as the tour-data-api backend. Configuration is provided via environment variables:

```typescript
// src/config/amplify.ts
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_AWS_USER_POOL_ID,
      userPoolClientId: process.env.EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID,
      identityPoolId: process.env.EXPO_PUBLIC_AWS_IDENTITY_POOL_ID,
    },
  },
});
```

> **Note**: All environment variables must use the `EXPO_PUBLIC_` prefix. This is an Expo requirement — Metro only bundles variables with this prefix. See [Development Guide → Environment Configuration](development-guide.md#environment-configuration) for details.

---

## Backend Integration

### API Service Layer

All communication with the tour-data-api is through the service layer at `src/services/api/`:

| File | Endpoints | Description |
|------|-----------|-------------|
| `apiClient.ts` | — | Base HTTP client with auth, retry, error handling |
| `tourApi.ts` | `GET /v1/tours/active`, `GET /v1/tours` | Tour resolution and listing |
| `riderApi.ts` | `GET /v1/tours/{tourId}/riders` | Rider data for dashboard |
| `rideApi.ts` | `GET /v1/tours/{tourId}/rides/today`, CRUD | Ride management |
| `checkInApi.ts` | `POST /v1/tours/{tourId}/checkins`, GET | Check-in operations |
| `dashboardApi.ts` | `GET /v1/tours/{tourId}/rides/{rideId}/dashboard` | Composite dashboard data |

### API Client Features

- **Base URL**: Configured from environment variable (`TOUR_DATA_API_BASE_URL`)
- **Authentication**: JWT token injected from Amplify Auth session
- **Auto-retry**: Exponential backoff for network failures (3 retries)
- **Token refresh**: Automatic on 401 responses (retry once)
- **Error standardization**: Backend errors mapped to consistent frontend error types
- **Logging**: Structured, level-gated logging via the app logger (see [Logging](#logging))

### Data Flow: API → UI

API client fetches data from tour-data-api and UI components render it directly. There is no local caching layer.

---

## Offline Status

The app does not support offline data caching. When the device loses connectivity, an **`OfflineBanner`** component is displayed at the top of the screen informing the user that the app is offline. All features require an active internet connection.

### Implementation

- **`OfflineContext`** uses `@react-native-community/netinfo` to detect connectivity changes (event-driven).
- **`OfflineBanner`** reads `isOffline` from `OfflineContext` and renders a banner when `true`.
- `OfflineProvider` wraps the entire app in `App.tsx` so the banner is visible on any screen.

---

## Navigation Structure

### Navigation Hierarchy

```
AppNavigator
├── AuthNavigator (unauthenticated)
│   └── LoginScreen
└── MainNavigator (authenticated)
    ├── DashboardScreen (Home / default tab)
    ├── CheckInScreen (QR scanner + check-in flow)
    └── AdminScreen (Ride management — role-restricted)
```

### Navigation Rules

- **Unauthenticated users** are restricted to the AuthNavigator
- **Authenticated users** are routed based on their role
- **Hotel Staff** role skips Dashboard and goes directly to check-in
- **Guest** role has read-only Dashboard with no check-in access
- **Deep links** are not currently required

---

## Styling Strategy

### Guidelines

1. **StyleSheet.create()** for all styles — no inline styles
2. **Constants** for colors in `src/constants/colors.ts`
3. **Consistent spacing** — use multiples of 4 or 8 for padding/margin
4. **Platform-aware** — use `Platform.select()` when platform-specific adjustments are needed
5. **Responsive** — use `Dimensions` or `useWindowDimensions()` for screen-size-dependent layouts

### Color System

Stage colors are defined in `src/constants/colors.ts` and used consistently across all views:

| Element | Color | Hex |
|---------|-------|-----|
| Start | Dark Orange | `#D97706` |
| PS1 | Dark Brown | `#7C2D12` |
| PS2 | Dark Blue | `#1E40AF` |
| Finish | Dark Green | `#15803D` |
| Quit Riding (QR) | Dark Red | `#B91C1C` |
| Not Riding (NR) | Gray | `#9CA3AF` |
| Not Checked In | White with gray border | `#FFFFFF` / `#D1D5DB` |

---

## Platform Considerations

### Mobile (iOS and Android)

- **Primary platform** — full feature set including QR scanning and all check-in capabilities
- **Portrait orientation** by default (configured in `app.json`)
- **Camera permission** required for QR code scanning
- **Expo Go** for development; Expo EAS Build for production

### Web

- **Simplified version** — Dashboard and reporting views primarily
- **Limited features** — QR scanning may not be available (camera API varies by browser)
- **Built with react-native-web** — same codebase, automatic web rendering
- **Responsive layout** — adapts to browser window size

### Platform-Specific Notes

- `@react-native-community/netinfo` provides connectivity events on all platforms (used for offline banner)
- Camera/barcode scanning is mobile-focused — web fallback should use manual entry
- `expo-secure-store` is mobile-only; web uses equivalent browser storage

---

## Logging

The app uses a centralised, structured logger (`src/utils/logger.ts`) for all diagnostic and operational output. Direct `console.log` / `console.warn` / `console.error` calls must not be used in application code — all output should go through the logger.

### Log Levels

| Level | When to use | Console method |
|-------|-------------|----------------|
| **DEBUG** | Verbose detail useful only during development (request URLs, response codes, state transitions) | `console.log` |
| **INFO** | Noteworthy application events (session found, tour loaded, ride selected) | `console.log` |
| **WARN** | Recoverable issues that may need attention (JSON parse failure, retryable error, missing optional data) | `console.warn` |
| **ERROR** | Failures requiring investigation (API errors, unhandled exceptions, data integrity issues) | `console.error` |

### Usage

```typescript
import { logger } from '../utils/logger';

logger.info('AuthContext', 'Session found', { username });
logger.error('Dashboard', 'fetchDashboard failed', err);
```

Every call takes a **tag** (module or component name), a **message**, and an optional **data** argument. Errors passed as `data` are automatically formatted with name, message, and any `ApiError`-specific fields (`statusCode`, `errorCode`).

### Level Configuration

The active log level is set via the `EXPO_PUBLIC_LOG_LEVEL` environment variable:

| Value | Output |
|-------|--------|
| `DEBUG` | Everything (default in `__DEV__`) |
| `INFO` | INFO + WARN + ERROR |
| `WARN` | WARN + ERROR (default in production) |
| `ERROR` | Errors only |
| `NONE` | Silent |

Messages below the active level are suppressed at no runtime cost.

### Output Format

```
[LEVEL] [Tag] Message — optional data
```

Example: `[ERROR] [Dashboard] fetchDashboard failed — ApiError: HTTP 500 | statusCode=500`

### Where Logs Appear

| Environment | Destination |
|-------------|-------------|
| Expo Dev Server | Terminal running `npx expo start` |
| JS Debugger | Browser Console (press `j` in Expo CLI) |
| Android (no debugger) | `adb logcat *:S ReactNativeJS:V` |
| iOS (no debugger) | Xcode Console / Console.app |

> **Note**: Standard `console.*` output is not persisted or remotely accessible in production builds. Remote log collection (e.g. Sentry, CloudWatch) can be added later by extending the `log()` function in `logger.ts`.

### Network Error Detection

`isNetworkError()` (exported from `apiClient.ts`) distinguishes genuine network connectivity failures from other `TypeError`s by matching against known network-failure messages (`"Network request failed"`, `"Failed to fetch"`, `"Load failed"`). This prevents data-processing bugs from being mis-classified as connection errors in catch blocks.

---

## App Distribution — Runtime Configuration (Single App, Multiple Organizers)

### Context

The app is intended to be used by different tour organizers, each operating on their own dedicated AWS subscription (separate Cognito User Pool, separate `tour-data-api` deployment). The goal is to publish a **single generic app binary** to the Play Store / App Store that can be configured at runtime to point to any organizer's AWS backend — without building a separate binary per organizer and without baking any organizer-specific values into the bundle.

### Current State

AWS configuration (`userPoolId`, `userPoolClientId`, `apiBaseUrl`, etc.) is currently provided via `EXPO_PUBLIC_` environment variables that are **baked into the bundle at build time**. This requires a separate EAS Build per organizer and does not support a single-binary distribution model.

### Implemented Approach — Setup Deep Link / QR Code in Invite Email

The chosen solution is **Option 3: Setup Deep Link / QR Code delivered via invite email**. This approach requires no publisher-maintained backend service after the app is published.

#### How It Works

1. The **publisher** runs a one-time tool (a local script or web form) to generate a **setup deep link** and/or **QR code** for each tour organizer from their AWS config values.
2. The **organizer** includes the setup deep link (and/or QR code image) in the **invite email** sent to each user, alongside the temporary Cognito password.
3. On first launch, the app checks for an incoming deep link. If the user tapped the setup link in their email on their mobile device, the app intercepts it automatically. If not, it shows an **OrgSetupScreen** with a QR code scanner as the fallback.
4. The app **verifies the HMAC-SHA256 signature** on the payload before accepting the config — this prevents forged setup links from redirecting the app to a malicious backend.
5. The decoded config is stored securely via `expo-secure-store` (Android Keystore / iOS Keychain).
6. `Amplify.configure()` is called with the stored values. All subsequent app launches skip setup and use the stored config directly.

#### Setup Link Format

```
https://setup.checkin-app.example.com/setup?payload=<BASE64_JSON>&sig=<HMAC_SHA256>
```

Where the `payload` is the Base64-encoded form of:

```json
{
  "orgCode": "TOURFRANCE-2026",
  "orgName": "Tour de France 2026 (Non-Competitive)",
  "awsRegion": "eu-west-1",
  "userPoolId": "eu-west-1_XXXXXXXXX",
  "userPoolClientId": "XXXXXXXXXXXXXXXXXXXXXXXXXX",
  "identityPoolId": "eu-west-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "apiBaseUrl": "https://<api-id>.execute-api.eu-west-1.amazonaws.com/v1"
}
```

`sig` is the hex-encoded HMAC-SHA256 of the `payload` string, computed with a publisher-held signing key. The app verifies this signature before storing the config.

The same URL, encoded as a QR code, serves users who receive the email on a desktop.

#### App First-Launch Flow

```
App Start
    │
    ▼
[Check expo-secure-store for stored org config]
    │
    ├─ Config found ──► [Amplify.configure(storedConfig)] ──► Login screen
    │
    └─ No config ──────────────────────────────────────────────────────────────┐
                                                                               │
                  ┌────────────────────────────────────────────────────────────┘
                  │
                  ▼
         [Check for incoming deep link (from invite email)]
                  │
        ┌─────────┴────────────────────┐
        │ Deep link present            │  No deep link
        │ (payload + sig in URL)       │
        └─────────┬────────────────────┘   │
                  │                        ▼
                  │               [Show OrgSetupScreen]
                  │               [User scans QR code]
                  │                        │
                  └────────────────────────┘
                                   │
                            [Verify HMAC sig]
                            [Decode config payload]
                            [Store in expo-secure-store]
                                   │
                            [Amplify.configure(config)]
                                   ▼
                            [Login screen]
                            [New-password challenge on first login]
                                   ▼
                            [Normal app flow]
```

#### Reinstall and New-Device Behaviour

`expo-secure-store` is device-bound — data is deleted on uninstall and does not transfer to a new device. After a reinstall or on a new phone the setup screen is presented again. The user re-taps the setup link from their original invite email (it remains valid) or scans the QR code. Organizers should include the following note in the invite email:

> *"Save this email — you will need the setup link again if you reinstall the app or switch to a new device."*

If the organizer's AWS configuration changes after the original invite was sent, existing installed users are unaffected (they retain the old config). Only users who reinstall will need a fresh invite link; the organizer re-sends to that subset.

#### Security Notes

- Config values (`userPoolId`, `apiBaseUrl`, etc.) are **resource identifiers, not credentials** — they do not grant access on their own. Authentication still requires valid Cognito credentials.
- The `allowAdminCreateUserOnly: true` setting on each Cognito User Pool (invite-only model) means an attacker who reads the QR code cannot create an account.
- The HMAC signature prevents a malicious QR code from redirecting the app to a fraudulent backend.
- Deep links use **HTTPS-based Universal Links (iOS) / App Links (Android)** (domain ownership verified) — not custom URL schemes.

#### Universal Link / App Link Domain

The domain `setup.checkin-app.example.com` must serve:
- `apple-app-site-association` — for iOS Universal Links
- `.well-known/assetlinks.json` — for Android App Links

This domain does **not** need to serve a backend API. A static S3 bucket with CloudFront is sufficient.

### Design Impact

| Component | Change Required |
|-----------|----------------|
| `src/config/amplify.ts` | Refactor to accept a runtime `OrgConfig` parameter instead of `EXPO_PUBLIC_` env vars; remove all `EXPO_PUBLIC_` references |
| `src/screens/auth/OrgSetupScreen.tsx` | New screen: QR code scanner + deep link handler; shown on first launch when no config is stored |
| `src/services/config/orgConfigService.ts` | New service: deep link payload decoder, HMAC verifier, `expo-secure-store` persistence |
| App startup sequence (`App.tsx` / `AppNavigator.tsx`) | Check `expo-secure-store` for config before calling `Amplify.configure()`; navigate to `OrgSetupScreen` if config is absent |
| `app.json` | Add Universal Link / App Link intent filter for the setup domain |
| `src/screens/auth/` | Remove sign-up screen; add new-password challenge screen (first-login flow) |
| `src/types/config.ts` | New file: `OrgConfig` TypeScript type |
| Environment variables | Remove organizer-specific `EXPO_PUBLIC_` vars; retain only neutral build-time constants (e.g., HMAC verification key, app version) |

> For the full options analysis, comparison matrix, QR obfuscation discussion, and alternatives considered, see [Generic App Distribution Analysis](Generic-App-Distribution-Analysis.md).

---

## Related Documentation

- [Requirements](Requirements.md) — Detailed feature specifications and business rules
- [Dashboard Feature](Dashboard-Feature.md) — Dashboard screen specification
- [Data Integration Design](DataIntegrationDesign.md) — Backend integration and offline architecture
- [Generic App Distribution Analysis](Generic-App-Distribution-Analysis.md) — Options analysis and alternatives considered
- [Project Structure](project-structure.md) — Folder organization

---

[← Back to README](../README.md)
