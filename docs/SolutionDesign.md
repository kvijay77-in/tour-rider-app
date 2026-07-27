# Solution Design

[← Back to README](../README.md)

This document covers the solution design aspects of the Tour Rider App that must be adhered to at all times. If there is any conflict between the copilot-instructions.md and this document, it must be flagged for resolution.

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

---

## Design Principles

1. **Common codebase** — App must have a single codebase to support Android, iOS, and Web App versions.
   - Any exception to have platform-specific code when common code is feasible must be flagged for review before proceeding with development.

2. **No direct AWS resource access** — Any direct access to AWS resources (DynamoDB, S3, etc.) from the Mobile App or Web client must not be permitted. Such access must always be through the tour-data-api backend (API Gateway → Lambda → DynamoDB).

3. **Follow tour-mgmt-app patterns** — This app must follow the same architecture patterns, authentication mechanism, and technology stack as the tour-mgmt-app (Check-In App) for consistency.

4. **Amplify for authentication only** — AWS Amplify Auth SDK is used for Cognito authentication and JWT token management. Data access is via the RESTful tour-data-api, not Amplify Data/AppSync.

6. **Security by default** — No hardcoded credentials, no inline sensitive data, JWT-based authentication for all API calls.

7. **Reactive UI** — Use React Context and Hooks for state management. No class components. Minimize re-renders through proper state structuring and memoization.

8. **Modular and reusable** — Components should be small, focused, and reusable. Business logic should be isolated in the services layer, not embedded in UI components.

9. **Rider-centric design** — Unlike the tour-mgmt-app which is staff-facing, this app is rider-facing. UI should be simple, intuitive, and optimized for non-technical users.

---

## Technology Stack

The Tour Rider App follows the **exact same technology stack** as the tour-mgmt-app (Check-In App) to ensure consistency, shared knowledge, and potential code reuse.

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | React Native | 0.81.x | Cross-platform mobile |
| **Platform Tooling** | Expo (managed workflow) | SDK 54 | Build, deploy, native APIs |
| **Language** | TypeScript | ~5.x | Type safety |
| **Navigation** | React Navigation | 7.x | Screen navigation (native stack + bottom tabs) |
| **Authentication** | AWS Amplify Auth | 6.x | Cognito integration, JWT management |
| **HTTP Client** | fetch (built-in) | N/A | API calls to tour-data-api |
| **Secure Storage** | expo-secure-store | 15.x | Sensitive data storage (tokens) |
| **Icons** | @expo/vector-icons | 15.x | UI icons |
| **SVG** | react-native-svg | 15.x | Custom SVG rendering |

### Key Differences from tour-mgmt-app

While the technology stack is identical, there are functional differences:

| Aspect | tour-mgmt-app (Check-In App) | tour-rider-app (Tour Rider App) |
|--------|------------------------|----------------------------------|
| **Primary Users** | Administrators, pit stop crew, hotel staff | Riders (tour participants) |
| **Main Features** | Check-in QR scanning, Dashboard (all riders), Ride management | Tour registration, Personal check-in status, Self-service (Not Riding, Quit Riding for current ride) |
| **Camera Usage** | QR code scanning for check-ins | Profile picture upload (no QR scanning required) |
| **Offline Priority** | High (pit stops in remote areas) | None (all features require online connectivity) |
| **Data Scope** | All riders, all tours, full admin access | Single rider's data, enrolled tours only |
| **RBAC** | 5 roles (Administrator, Super User, Pit Stop Crew, Hotel Staff, Guest) | 2 user types (General Rider, Registered Rider) |

### Why These Choices

- **Same stack as tour-mgmt-app**: Ensures consistency, shared learnings, and potential for code sharing between apps
- **Expo managed workflow**: Simplifies build and deployment. No need to eject for native modules
- **fetch over axios**: Built into React Native, reduces bundle size
- **React Context over Redux**: Application state is straightforward (user profile, active tour, enrollment status)

---

## Application Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    App.tsx (Entry Point)                  │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Context Providers                       │ │
│  │  AuthContext (always mounted)                        │ │
│  │  RiderContext → TourContext (authenticated only)     │ │
│  │                                                      │ │
│  │  ┌───────────────────────────────────────────────┐  │ │
│  │  │            Navigation (React Navigation)       │  │ │
│  │  │                                                │  │ │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │  │ │
│  │  │  │  Tour    │ │  Profile │ │  Check-  │      │  │ │
│  │  │  │Dashboard │ │  Screen  │ │  In Info │      │  │ │
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
| **Context** | `src/context/` | Global state management (auth, rider, tour) |
| **Services** | `src/services/` | Business logic, API calls |
| **Types** | `src/types/` | TypeScript type definitions and interfaces |
| **Constants** | `src/constants/` | Application-wide constants (colors, status codes) |
| **Hooks** | `src/hooks/` | Custom React hooks for reusable stateful logic |
| **Utils** | `src/utils/` | Pure utility functions (formatting, validation) |
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
├── auth/
│   ├── LoginScreen.tsx           # Login with email/password
│   ├── SignUpScreen.tsx          # Rider registration
│   └── ForgotPasswordScreen.tsx  # Password reset flow
├── home/
│   └── HomeScreen.tsx            # Different based on enrollment status
├── tour/
│   ├── TourListScreen.tsx        # Browse available tours
│   ├── TourDetailsScreen.tsx     # Tour information
│   ├── TourDashboardScreen.tsx   # Enrolled rider's tour dashboard
│   └── TourRegistrationScreen.tsx # Tour registration form
├── checkin/
│   ├── CheckInStatusScreen.tsx   # Daily check-in progress
│   └── CheckInHistoryScreen.tsx  # Historical check-ins
├── profile/
│   ├── ProfileCreationScreen.tsx # First-time profile completion flow
│   └── ProfileScreen.tsx         # View/edit rider profile
└── notifications/
    └── NotificationsScreen.tsx   # Notification center
```

### Reusable Components

Components are organized by scope:

```
src/components/
├── common/                       # Shared across all screens
│   ├── Button.tsx               # Styled button component
│   ├── Card.tsx                 # Card container
│   ├── LoadingSpinner.tsx       # Loading indicator
│   └── StatusBadge.tsx          # Status indicator badge
├── tour/                         # Tour-specific components
│   ├── TourCard.tsx             # Tour summary card
│   └── TourInfoBanner.tsx       # Tour information banner
├── checkin/                      # Check-in-specific components
│   ├── StageIndicator.tsx       # Visual stage progress
│   └── CheckInCard.tsx          # Check-in summary card
└── profile/                      # Profile-specific components
    └── ProfilePicture.tsx       # Profile picture with upload
```

### Component Guidelines

1. **Functional components only** — use hooks for state and effects. The only approved exception is the root Error Boundary, which must remain a class component unless the app adopts a dedicated boundary library.
2. **Props over context** where possible — prefer explicit data flow
3. **Memoize expensive renders** — use `React.memo`, `useMemo`, `useCallback` appropriately
4. **Separate concerns** — keep styling in `StyleSheet.create()`, logic in hooks/services
5. **Type all props** — define TypeScript interfaces for component props

---

## State Management

### Context Providers

The app uses React Context for global state:

| Context | Purpose | Key State |
|---------|---------|-----------|
| **AuthContext** | Authentication state | User info, JWT tokens, login/logout |
| **RiderContext** | Rider profile state | Profile data, profile-exists flag, picture upload flow |
| **TourContext** | Tour enrollment state | Active tour, enrollment status, tour details |

**Provider Order** (in `App.tsx` and navigation subtree):
```
ErrorBoundary
  → AuthContext
    → NavigationContainer
      → RootNavigator
        → AuthNavigator (unauthenticated)
        → AppNavigator (authenticated)
          → RiderContext (depends on auth for profile loading)
            → TourContext (depends on rider for enrollment check)
              → MainNavigator
```

The app bootstrap flow wraps the full provider and navigation tree in a root `ErrorBoundary`. This prevents a blank screen on unhandled render-time failures and routes boundary diagnostics through the centralized logger.

`RiderContext` and `TourContext` mount only when a user session is active. This keeps authenticated state lifecycle scoped to the authenticated subtree and avoids unnecessary provider work before login.

### Local State

Screen-specific and component-specific state uses `useState` and `useReducer` hooks. Examples:
- TourListScreen: filter state, search query
- CheckInStatusScreen: selected ride date
- ProfileScreen: form state, edit mode
- ProfileCreationScreen: first-time profile form state and upload state

### Derived State

State that can be computed from other state should not be stored separately. Examples:
- Rider's current enrollment status (derived from TourContext)
- Unread notification count (derived from notifications array)
- Today's ride (derived from rides array + current date)

---

## Authentication

### Flow

1. User opens app → `AuthContext` checks for existing Amplify session
2. If no session → navigate to login screen
3. User can choose:
   - **Sign Up**: Create new rider account
   - **Login**: Authenticate with existing credentials
4. On sign-up:
  - User provides email and password only
   - App creates Cognito account via `Amplify.Auth.signUp()`
   - Verification code sent to email
  - User verifies email
  - App auto-signs in rider with the same credentials
  - During this first sign-in, linked-profile lookup is deferred until after link creation
  - App links Cognito `sub` to rider profile identity via `POST /v1/riders/link/{cognitoUserName}`
  - App routes rider to profile creation flow
5. On login:
   - User authenticates via `Amplify.Auth.signIn()` → Cognito returns JWT tokens
  - Optional Remember Me pre-fills and stores credentials in `expo-secure-store`
  - `AuthContext` resolves `profileId` from `GET /v1/riders/link/{cognitoUserName}`
   - `AuthContext` stores auth state
   - `RiderContext` loads rider profile
  - If profile is missing, profile gate redirects to Profile Creation and blocks main app navigation
  - `TourContext` checks for active tour enrollment only after rider profile exists
   - Navigation routes user to appropriate home screen

### First-Time Rider Not-Found Handling

- `GET /v1/riders/link/{cognitoUserName}` may return `404` for a newly verified rider before link creation.
- `GET /v1/riders/profile/{profileId}` may return `404` until profile creation is completed.
- These first-time rider `404` responses are expected states and are handled as informational logs instead of warning/error conditions.
6. Authenticated users can change password via `Amplify.Auth.updatePassword()` from the Change Password screen

### Token Management

- **Automatic refresh**: Amplify Auth SDK handles JWT token refresh transparently
- **Token injection**: `apiClient.ts` retrieves the current token from Amplify session and includes it as `Authorization: Bearer <token>` in every API request
- **401 handling**: If the API returns 401, the API client attempts token refresh and retries once
- **Secure storage**: Amplify uses `expo-secure-store` for token persistence
- **Remember Me**: Optional credential persistence in `expo-secure-store` for login convenience

### Cognito Integration

Each tour organizer has their own **dedicated Cognito User Pool** for riders, provisioned as part of their subscription. All AWS resources and data — including Cognito, DynamoDB tables, S3 buckets, API infrastructure, and Lambda functions — must be part of the organizer's subscription. Nothing is shared across organizers at any level. This provides:
- **Complete resource isolation**: Each organizer's riders are in their own pool, with their own DynamoDB tables, S3 buckets, and API endpoints. No data or resources are shared across organizers at any level.
- **Subscription-scoped resources**: Cognito costs, user limits, and security settings are per-organizer subscription.
- **Independent security controls**: Password policies, MFA settings, and session management can be tailored per organizer.
- **Simplified access control**: No need for group-based filtering — all users in an organizer's pool are that organizer's riders.

Configuration is **dynamic** — resolved at runtime after the rider provides an invitation code or the app loads a saved organizer context:

```typescript
// src/config/amplify.ts — default single-subscription configuration
// Cognito pool details are loaded from EXPO_PUBLIC env vars for the organizer-specific build.

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_AWS_USER_POOL_ID,
      userPoolClientId: process.env.EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID,
    },
  },
});
```

> **Note**: Expo public environment variables are the supported configuration mechanism for the default organizer-specific build (`EXPO_PUBLIC_SUBSCRIPTION_MODE=single`). The optional multi-subscription flow remains a future extension and must be explicitly enabled.

> **Important**: Each organizer has their own complete infrastructure (Cognito User Pool, DynamoDB tables, API Gateway, Lambda, S3) provisioned as part of their subscription. Nothing is shared across organizers. The tour-data-api API Gateway authorizer for each organizer trusts only that organizer's Cognito pool.

> See [Sign-Up Approach Design](design-signup-approach.md) for the full design including invitation-based sign-up flow and multi-organizer support.

### User Types Differentiation

All users in an organizer's Cognito User Pool are that organizer's riders. Differentiation between General Riders and Registered Riders is determined by tour enrollment status (stored in tour-data-api), not by Cognito groups.

1. **Profile Identity Link**:
  - Cognito `sub` is mapped to `profileId` using rider link endpoints (`POST/GET /v1/riders/link/{cognitoUserName}`)
  - App does not rely on Cognito `custom:profileId` for runtime profile resolution

2. **App-Level Differentiation**:
   - **General Rider**: User exists in Cognito but has no active tour enrollment in tour-data-api
   - **Registered Rider**: User has an approved tour enrollment in tour-data-api

---

## Backend Integration

### API Service Layer

Each tour organizer has their own dedicated tour-data-api deployment as part of their subscription — there is no shared or central backend. The app communicates with the active organizer's tour-data-api instance through the service layer at `src/services/api/`:

| File | Endpoints | Description |
|------|-----------|-------------|
| `apiClient.ts` | — | Base HTTP client with auth, retry, error handling |
| `riderApi.ts` | `GET/PUT /v1/riders/profile/{profileId}` | Rider profile operations |
| `tourApi.ts` | `GET /v1/tours`, `GET /v1/tours/{tourId}` | Tour listing and details |
| `tourRegistrationApi.ts` | `POST /v1/tours/{tourId}/riders` | Tour registration requests |
| `rideApi.ts` | `GET /v1/tours/{tourId}/rides/today`, GET rides | Ride information |
| `checkInApi.ts` | `GET /v1/tours/{tourId}/rides/{rideId}/checkins`, POST | Check-in viewing and self-service (Not Riding, Quit Riding for current ride) |
| `notificationApi.ts` | `GET /v1/tours/{tourId}/notifications` | Notifications (requires backend extension) |

### API Client Features

- **Base URL**: Configured from Expo public env vars for the default single-organizer build. Future multi-organizer support may replace it dynamically.
- **Authentication**: JWT token injected from Amplify Auth session
- **Auto-retry**: Exponential backoff for network failures (3 retries)
- **Timeout protection**: Requests are aborted when timeout elapses (default 15s, overridable per request)
- **Token refresh**: Automatic on 401 responses (retry once)
- **Error standardization**: Backend errors mapped to consistent frontend error types
- **Logging**: Structured, level-gated logging via the app logger (see [Logging](#logging))
- **Debug gating**: GET request debug logs are disabled by default and can be enabled with `EXPO_PUBLIC_API_DEBUG_GET=true`
- **Request logging controls**: Runtime controls can override debug logging behavior for targeted troubleshooting without changing request/response contracts

### Data Flow: API → UI

API client fetches data from the organizer's tour-data-api instance and the UI components render it directly. There is no local caching layer.

---

## Offline Status

The app does not support offline mode. All features require an active internet connection. There is no local data caching.

---

## Navigation Structure

### Navigation Hierarchy

```
RootNavigator
├── AuthNavigator (unauthenticated)
│   ├── LoginScreen
│   ├── SignUpScreen
│   └── ForgotPasswordScreen
└── AppNavigator (authenticated subtree)
  └── AuthenticatedStack
    ├── ProfileCreationScreen (forced when profile is missing)
    └── MainDrawerNavigator
      ├── Home → HomeScreen
      ├── ViewProfile → ProfileScreen
      ├── TrainingChallenge → TrainingChallengeScreen
      ├── Tour → TourStackNavigator
      │   ├── TourRides → TourScreen
      │   └── RideDetails → RideDetailsScreen
      ├── ChangePassword → ChangePasswordScreen
      └── SignOut (drawer action, not a route)
```

### Navigation Rules

- **Unauthenticated users** are restricted to the AuthNavigator
- **Profile gate**: authenticated users without a rider profile are restricted to ProfileCreationScreen until profile completion
- **Home** shows a rider-first dashboard layout (profile summary, quick cards, announcements placeholder)
- **Tour** menu entry opens a nested stack for active-tour ride list and ride details
- **Drawer content** provides a dedicated Sign Out action
- **Legacy bottom tabs** remain in code (`MainNavigator.tsx`) but are deferred and not wired to active navigation

---

## Styling Strategy

### Guidelines

1. **StyleSheet.create()** for all styles — no inline styles
2. **Constants** for colors in `src/constants/colors.ts`
3. **Consistent spacing** — use multiples of 4 or 8 for padding/margin
4. **Platform-aware** — use `Platform.select()` when platform-specific adjustments are needed
5. **Responsive** — use `useWindowDimensions()` for screen-size-dependent layouts

### Color System

Primary colors:

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Primary | Blue | `#3B82F6` | Primary buttons, active states |
| Secondary | Gray | `#6B7280` | Secondary buttons, disabled states |
| Success | Green | `#10B981` | Success messages, completed status |
| Warning | Orange | `#F59E0B` | Warning messages, pending status |
| Danger | Red | `#EF4444` | Error messages, Quit Riding status |
| Background | Light Gray | `#F9FAFB` | Screen backgrounds |
| Card Background | White | `#FFFFFF` | Card backgrounds |
| Text Primary | Dark Gray | `#111827` | Primary text |
| Text Secondary | Medium Gray | `#6B7280` | Secondary text |

Stage-specific colors (for check-in status):

| Stage | Color | Hex |
|-------|-------|-----|
| Start | Dark Orange | `#D97706` |
| Pit Stop 1 | Dark Brown | `#7C2D12` |
| Pit Stop 2 | Dark Blue | `#1E40AF` |
| Finish | Dark Green | `#15803D` |
| Quit Riding | Dark Red | `#B91C1C` |
| Not Riding | Blue | `#3B82F6` |
| Not Checked In | Gray | `#D1D5DB` |

---

## Logging

The app uses a centralized, structured logger (`src/utils/logger.ts`) for all diagnostic and operational output. Direct `console.log` / `console.warn` / `console.error` calls must not be used in application code.

The logger is responsible for level gating, consistent message formatting, and safe serialization of structured metadata. Log payloads must never crash logging because of circular references, nested `Error` objects, or non-JSON values.

### Log Levels

| Level | When to use | Console method |
|-------|-------------|----------------|
| **DEBUG** | Verbose detail useful only during development | `console.log` |
| **INFO** | Noteworthy application events | `console.log` |
| **WARN** | Recoverable issues that may need attention | `console.warn` |
| **ERROR** | Failures requiring investigation | `console.error` |

### Usage

```typescript
import { logger } from '../utils/logger';

logger.info('AuthContext', 'Session found', { username });
logger.error('RiderApi', 'fetchProfile failed', err);
logger.error('ErrorBoundary', 'Unhandled application error', { error, componentStack });
```

### Level Configuration

The active log level is set via the `EXPO_PUBLIC_LOG_LEVEL` environment variable:

| Value | Output |
|-------|--------|
| `DEBUG` | Everything (default in `__DEV__`) |
| `INFO` | INFO + WARN + ERROR |
| `WARN` | WARN + ERROR (default in production) |
| `ERROR` | Errors only |
| `NONE` | Silent |

---

## Platform Considerations

### Mobile (iOS and Android)

- **Primary platform** — full feature set including profile picture upload, notifications
- **Portrait orientation** by default (configured in `app.json`)
- **Camera permission** required for profile picture (camera or photo library)
- **Notification permission** required for push notifications
- **Expo Go** for development; Expo EAS Build for production

### Web

- **Simplified version** — Dashboard and profile views primarily
- **Built with react-native-web** — same codebase, automatic web rendering
- **Responsive layout** — adapts to browser window size

### Platform-Specific Notes

- `expo-secure-store` is mobile-only; web uses browser secure storage
- Camera access for profile pictures uses `expo-image-picker` (works on all platforms)

---

## Related Documentation

- [Requirements](Requirements.md) — Detailed feature specifications and business rules
- [Development Guide](development-guide.md) — Environment setup, running the app, testing
- [Project Structure](project-structure.md) — Folder organization
- [tour-mgmt-app Solution Design](../../tour-mgmt-app-main/docs/SolutionDesign.md) — Reference for shared patterns

---

[← Back to README](../README.md)
