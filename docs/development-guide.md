# Development Guide

[← Back to README](../README.md)

This guide covers environment setup, running the app, testing, and development workflows for the Tour Rider App.

> **Note**: This guide will be fully populated during the initial development phase. For now, it provides an outline of what will be covered.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Environment Configuration](#environment-configuration)
- [Running the App](#running-the-app)
- [Development Workflow](#development-workflow)
- [Code Quality](#code-quality)
- [Troubleshooting](#troubleshooting)
- [Useful Commands](#useful-commands)

---

## Prerequisites

Before starting development, ensure you have the following installed:

- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher (comes with Node.js)
- **Git**: For version control
- **Expo Go App**: Install on your mobile device for testing (iOS or Android)
- **Code Editor**: VS Code recommended

**Platform-Specific Requirements:**

**For iOS Development:**
- macOS with Xcode installed
- iOS Simulator (via Xcode)

**For Android Development:**
- Android Studio (for Android Emulator)
- Java Development Kit (JDK) 11 or higher

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/kvijay77-in/tour-rider-app.git
cd tour-rider-app
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages defined in `package.json`.

### 3. Verify Installation

```bash
npx expo --version
```

You should see the Expo CLI version.

---

## Environment Configuration

### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` and add your AWS and API configuration:

```
EXPO_PUBLIC_SUBSCRIPTION_MODE=single
EXPO_PUBLIC_ORGANIZER_ID=<your-organizer-id>
EXPO_PUBLIC_ORGANIZER_NAME=<your-organizer-name>
EXPO_PUBLIC_AWS_USER_POOL_ID=<your-cognito-user-pool-id>
EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=<your-cognito-client-id>
EXPO_PUBLIC_AWS_IDENTITY_POOL_ID=<your-cognito-identity-pool-id>
EXPO_PUBLIC_TOUR_DATA_API_BASE_URL=<your-tour-data-api-url>
EXPO_PUBLIC_LOG_LEVEL=DEBUG
EXPO_PUBLIC_API_DEBUG_GET=false
```

> **Important**: All environment variables must use the `EXPO_PUBLIC_` prefix. This is an Expo requirement for bundling variables into the app.

> **Optional debug toggle**: Set `EXPO_PUBLIC_API_DEBUG_GET=true` when you need verbose API debug logging for GET requests. Keep it `false` during normal development to reduce log noise.

### 3. Obtain AWS Credentials

The Tour Rider App uses a **dedicated Cognito User Pool** (separate from tour-mgmt-app):

- **Cognito User Pool ID** — Deploy the Cognito stack first (see [Deployment Guide](deployment-guide.md))
- **Cognito Client ID** — Created by the same Cognito stack
- **Cognito Identity Pool ID** — Optional, leave empty if not needed
- **tour-data-api Base URL** — Obtain from the tour-data-api team or AWS administrator

> **Note**: Do NOT use the tour-mgmt-app Cognito credentials. This app has its own dedicated user pool for riders.

---

## Running the App

### Start the Development Server

```bash
npx expo start
```

This starts the Metro bundler and displays a QR code.

### Run on Mobile Device (Recommended for Development)

1. Install **Expo Go** on your iOS or Android device
2. Scan the QR code displayed in the terminal
3. The app will load on your device

### Run on iOS Simulator (macOS only)

```bash
npx expo start --ios
```

### Run on Android Emulator

```bash
npx expo start --android
```

### Run on Web

```bash
npx expo start --web
```

> **Note**: Web version has limited features compared to mobile.

---

## Development Workflow

### Architecture Change Guardrails

Before starting any architecture, navigation, bootstrap, or API client uplift work:

- Re-read [Requirements.md](Requirements.md) and [SolutionDesign.md](SolutionDesign.md) and keep those documents as the controlling references for scope and behavior.
- Limit scope to reusable technical architecture patterns only. Do not change rider business workflows, rider-facing validation behavior, enrollment rules, role or group behavior, or any admin or staff flows unless requirements are updated first.
- Capture and preserve baseline behavior for the affected area before editing. At minimum, keep the following regression checklist current for auth, navigation, and API work.
- If a phase changes structure or architecture, update the relevant documentation in the same phase. Do not defer documentation to a later standalone pass.

#### Baseline Regression Checklist

Use this checklist before and after architecture-focused changes to confirm no behavioral regression:

**Auth flow**
- App startup configures Amplify before rendering providers.
- Provider order remains `AuthProvider -> RiderProvider -> TourProvider` unless an approved architecture change updates the design docs in the same phase.
- While auth state is loading, the app shows a loading spinner instead of navigation content.
- Unauthenticated users land in the auth stack with `Login`, `SignUp`, and `ForgotPassword` routes available.
- Authenticated users are routed into the main app navigation.

**Navigation flow**
- `NavigationContainer` remains the single root navigation container.
- Route names remain stable unless a compatibility layer or documented migration is introduced.
- The main tab navigator always exposes `Home` and `Profile`.
- `Check-In` and `Notifications` tabs appear only when the rider is enrolled.
- Navigation changes must preserve the current rider journeys for login, logout, enrolled rider access, and general rider access.

**API request behavior**
- API base URL resolution continues to support configured single-subscription mode and runtime multi-subscription mode.
- Requests keep `Content-Type: application/json` and `Accept: application/json` headers by default.
- Authorization headers continue to include the bearer token when available.
- Requests continue to use timeout protection, retry eligible failures, and exponential backoff.
- A `401` response still attempts one token refresh path before auth invalidation is triggered.
- Non-retryable API failures continue to surface as `ApiError` instances with backend error details when available.
- Expected first-time rider `404` responses (missing Cognito link or missing rider profile) are treated as informational states and handled in auth/profile bootstrap flows.
- Active tour loading must not run until rider profile creation is complete.
- Active tour bootstrap should perform a single refresh path through `TourContext`, reseed the SQLite active snapshot, and keep active-tour screens on local cached reads until the next explicit refresh or sign-in.

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Follow the guidelines in:
- [SolutionDesign.md](SolutionDesign.md) for architecture
- [project-structure.md](project-structure.md) for file organization
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) for coding standards

### 3. Test Your Changes

- Test on at least one mobile platform (iOS or Android)
- Test with different user types (General Rider, Registered Rider)
- For rider profile changes, seed or verify `RIDER_PROFILE_SECTION`, `RIDER_PROFILE_ATTRIBUTE`, and `LOV` entries in the paired `tour-data-api` environment before manual testing
- Use the backend contract in `kvijay77-in/tour-data-api/docs/rider-profile-attributes-design.md` as the source of truth for seeded definitions and handlers
- Verify both the fresh-config path and the cached-config fallback path by:
  1. Signing in with network access so `GET /v1/config` refreshes and populates the local cache
  2. Signing out, then signing back in after temporarily breaking config access to confirm the cached profile definitions still render
  3. Clearing app data or logging out to confirm the cached definitions copy is removed and the profile screens show the retry state when no config can be loaded

### 4. Lint Your Code

```bash
npm run lint
```

Fix any linting errors before committing.

### 4.1 API Debug Logging Workflow

Use these settings when troubleshooting API behavior:

- Default: keep `EXPO_PUBLIC_API_DEBUG_GET=false` so GET request debug logs stay gated.
- Enable temporarily: set `EXPO_PUBLIC_API_DEBUG_GET=true` to include GET request debug traces.
- Combine with `EXPO_PUBLIC_LOG_LEVEL=DEBUG` to capture full API request/retry diagnostics.
- Revert the toggle after troubleshooting to keep logs concise.

### 5. Commit Your Changes

```bash
git add .
git commit -m "Description of your changes"
```

### 6. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

---

## Code Quality

### Linting

Run ESLint to check code quality:

```bash
npm run lint
```

Fix issues automatically (when possible):

```bash
npm run lint:fix
```

### TypeScript Type Checking

TypeScript is configured for strict type checking. The Metro bundler will show type errors during development.

### Code Formatting

Follow the ESLint configuration from tour-mgmt-app for consistent formatting.

---

## Troubleshooting

### Common Issues

**Issue**: Metro bundler fails to start
- **Solution**: Clear the cache: `npx expo start --clear`

**Issue**: Environment variables not loading
- **Solution**: Ensure all variables use the `EXPO_PUBLIC_` prefix

**Issue**: AWS Amplify authentication errors
- **Solution**: Verify your Cognito configuration in `.env`

**Issue**: Cannot connect to tour-data-api
- **Solution**: Check `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL` is correct

**Issue**: New rider sees "not found" logs after sign-up verification
- **Solution**: Confirm app is on latest flow where missing rider link/profile during first-time bootstrap is informational; rider should be directed to Profile Creation before any tour API fetches.

**Issue**: App crashes on startup
- **Solution**: Check the logs in Expo Go or terminal for error details

### Clearing Cache

If you encounter persistent issues, try clearing all caches:

```bash
npx expo start --clear
```

Or manually delete cache directories:

```bash
rm -rf node_modules
rm -rf .expo
npm install
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npx expo start` | Start development server |
| `npx expo start --clear` | Start with cache cleared |
| `npx expo start --ios` | Run on iOS simulator |
| `npx expo start --android` | Run on Android emulator |
| `npx expo start --web` | Run on web browser |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors automatically |
| `npm install` | Install dependencies |
| `npm outdated` | Check for outdated packages |

---

## Next Steps

After setting up your development environment:

1. Review [Requirements.md](Requirements.md) to understand features
2. Study [SolutionDesign.md](SolutionDesign.md) for architecture
3. Examine the tour-mgmt-app reference implementation
4. Start implementing features following the project structure

---

## Related Documentation

- [Requirements](Requirements.md) — Feature specifications
- [Solution Design](SolutionDesign.md) — Architecture and design
- [Project Structure](project-structure.md) — Folder organization
- [Deployment Guide](deployment-guide.md) — AWS resource deployment

---

[← Back to README](../README.md)
