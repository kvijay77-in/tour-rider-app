# Development Guide

[← Back to README](../README.md)

Complete guide for setting up your development environment, running the app, testing, and daily development workflows.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Running the App](#running-the-app)
- [Code Quality](#code-quality)
- [Environment Configuration](#environment-configuration)
- [Useful Commands](#useful-commands)
- [Troubleshooting](#troubleshooting)
- [Support](#support)

---

## Prerequisites

| Tool | Version | Purpose | Install Guide |
|------|---------|---------|---------------|
| **Node.js** | 18+ (LTS recommended) | JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| **npm** | 9+ (comes with Node.js) | Package manager | Bundled with Node.js |
| **Git** | Any | Version control | [git-scm.com](https://git-scm.com/) |
| **Expo Go** | Latest | Run app on physical device | [App Store](https://apps.apple.com/app/expo-go/id982107779) / [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) |

**For iOS development (macOS only):**

| Tool | Version | Purpose |
|------|---------|---------|
| **Xcode** | Latest | iOS Simulator |
| **Watchman** | Latest | File watching for hot reload |

**For Android development:**

| Tool | Version | Purpose |
|------|---------|---------|
| **Android Studio** | Latest | Android Emulator and SDK |
| **Java JDK** | 17+ | Required by Android toolchain |

> **Note**: For quick development and testing, Expo Go on a physical device is sufficient — no need for simulators or emulators.

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd poc-app
```

### 2. Install Dependencies

```bash
npm install
```

This installs all dependencies listed in `package.json`, including React Native, Expo, AWS Amplify, and all supporting libraries.

### 3. Environment Configuration

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Update the `.env` file with your environment-specific values:

```
# Tour Data API (dev-mode fallback — overridden by runtime OrgConfig)
EXPO_PUBLIC_TOUR_DATA_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/v1

# AWS Cognito (dev-mode fallback — overridden by runtime OrgConfig)
EXPO_PUBLIC_AWS_REGION=<region>
EXPO_PUBLIC_AWS_USER_POOL_ID=<user-pool-id>
EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=<client-id>
EXPO_PUBLIC_AWS_IDENTITY_POOL_ID=<identity-pool-id>

# HMAC signing key for setup link verification (must match publisher's key)
EXPO_PUBLIC_SETUP_HMAC_KEY=<hex-encoded-256-bit-key>

# Logging (optional — defaults to DEBUG in dev, WARN in production)
# Valid values: DEBUG, INFO, WARN, ERROR, NONE
EXPO_PUBLIC_LOG_LEVEL=DEBUG
```

> **Dev-mode fallback**: When the app has no stored OrgConfig (first launch, no setup link/QR), it falls back to reading the `EXPO_PUBLIC_AWS_*` and `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL` env vars. This allows local development without the setup flow. In production builds these vars are typically empty — the app shows the OrgSetupScreen instead.

> **Important**: All environment variables must use the `EXPO_PUBLIC_` prefix to be accessible in the app at runtime. This is an Expo requirement — variables without this prefix are not bundled into the app. See [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/) for details.

### Cognito User Role Setup (User Groups)

The app resolves each user's role from **Cognito User Group** membership.
The ID token's `cognito:groups` claim is read at login / session restore — no extra API call is needed.

1. **Create groups** in the Cognito User Pool (one-time, via Console or CLI):
   ```
   ADMINISTRATOR
   SUPER_USER
   PIT_STOP_CREW
   HOTEL_STAFF
   GUEST
   ```
   Group names must match the `UserRole` enum values exactly (case-sensitive).

2. **Assign users to a group** via the Cognito Console → User Pool → Users → select user → Group memberships → Add to group.
   Each user should belong to exactly **one** role group. If a user is in multiple groups, the first matching `UserRole` (by enum declaration order) is used.

3. **Ensure the App Client** is configured to include `cognito:groups` in the ID token (this is the default for new app clients).

If the user belongs to no recognised group, the app defaults to `GUEST` (read-only dashboard).

These values come from the [tour-data-api](https://github.com/kvijay77-in/tour-data-api) deployment. See the tour-data-api [Deployment Guide](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/deployment-guide.md#after-deployment-getting-your-api-url) for how to retrieve API URLs and Cognito configuration.

### 4. Verify Setup

```bash
# Start the app to verify everything works
npx expo start
```

You should see the Expo developer tools with a QR code. Scan it with Expo Go to run on your device, or press the appropriate key to open in a simulator/browser.

---

## Running the App

### Development Server

```bash
# Start Expo development server (interactive mode)
npx expo start

# Or use npm scripts
npm start
```

The Expo CLI will display options:
- Press `a` to open on Android emulator
- Press `i` to open on iOS simulator
- Press `w` to open in web browser
- Scan the QR code with Expo Go on a physical device

### Tunnel Mode (Network Issues)

If your local network blocks connections between your development machine and physical device (common with corporate/restricted WiFi, VPNs, or firewalls), use the `--tunnel` flag to route traffic through an `ngrok` tunnel instead of LAN:

```bash
# Start with tunnel mode
npx expo start --tunnel
```

**When to use `--tunnel`:**
- Device and computer are on the same WiFi but QR code scan fails or app can't connect
- Corporate or guest WiFi networks that isolate clients
- VPN is active on either the device or computer
- Firewall blocks port 8081
- Working from a remote/cloud development environment

> **Note**: Tunnel mode requires `@expo/ngrok` to be installed. Expo will prompt you to install it on first use. Tunnel connections are slower than LAN — use LAN mode when your network allows it.

### Platform-Specific

```bash
# Android
npm run android
# or
npx expo start --android

# iOS (macOS only)
npm run ios
# or
npx expo start --ios

# Web
npm run web
# or
npx expo start --web
```

> **Tip**: The `--tunnel` flag can be combined with platform flags, e.g. `npx expo start --android --tunnel`.

### Development with Mock Data

The app supports a **mock data mode** that allows running entirely without a backend or AWS account. This is useful for:

- Exploring the app and its features
- UI development without a live backend
- Demo and testing scenarios
- Onboarding new developers before AWS access is set up

To enable mock data mode, set the following in your `.env` file:

```
EXPO_PUBLIC_USE_MOCK_DATA=true
```

When enabled, the API service layer (`tourApi.ts`, `rideApi.ts`, `dashboardApi.ts`) returns synthetic test data from `mockData.ts` instead of making HTTP calls. This is transparent to all screens and components — they receive data in the same shape as the real API.

To switch back to the real backend, set the variable to any other value or remove it:

```
EXPO_PUBLIC_USE_MOCK_DATA=
```

> **Note**: Changes to environment variables require restarting the Expo development server (`npx expo start`) to take effect.

---

## Code Quality

### Linting

The project uses ESLint with TypeScript support for code quality:

```bash
# Run linter
npm run lint

# Run linter with auto-fix
npm run lint:fix
```

### ESLint Configuration

ESLint is configured in `eslint.config.js` with:
- TypeScript ESLint plugin and parser
- React and React Hooks plugins
- Expo ESLint configuration

### Before Committing

Always run the linter before committing code:

```bash
npm run lint
```

Fix all errors and warnings before creating a pull request.

### Coding Standards

- **Functional components** with React Hooks (no class components)
- **TypeScript** for all files (`.ts` / `.tsx`)
- **StyleSheet** or styled-components for styling (no inline styles)
- **JSDoc comments** for complex functions and components
- **Modular code** — keep components small and reusable
- **Constants** for magic values — use `src/constants/` for colors, roles, stages
- **Environment variables** for all configuration — no hardcoded URLs or credentials

### Date and Time Standards

All date/time values should follow **ISO 8601** format, consistent with the backend:

| Format | Example | Usage |
|--------|---------|-------|
| Date | `YYYY-MM-DD` | `2026-03-01` |
| DateTime | `YYYY-MM-DDTHH:MM:SSZ` | `2026-03-01T17:00:00Z` |
| Time | `HH:MM` (24-hour) | `06:30` |

All timestamps should be in UTC with the `Z` suffix.

---

## Environment Configuration

### Required Environment Variables

> **Note**: All variables must use the `EXPO_PUBLIC_` prefix. This is an Expo requirement — only variables with this prefix are embedded into the app bundle by Metro. Variables without the prefix are silently ignored and will be `undefined` at runtime.

| Variable | Description | Source |
|----------|-------------|--------|
| `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL` | Base URL for the tour-data-api | tour-data-api deployment output |
| `EXPO_PUBLIC_AWS_REGION` | AWS region (e.g., `ap-south-1`) | Your AWS configuration |
| `EXPO_PUBLIC_AWS_USER_POOL_ID` | Cognito User Pool ID | tour-data-api deployment output |
| `EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID` | Cognito App Client ID | tour-data-api deployment output |
| `EXPO_PUBLIC_AWS_IDENTITY_POOL_ID` | Cognito Identity Pool ID | tour-data-api deployment output (if applicable) |
| `EXPO_PUBLIC_USE_MOCK_DATA` | Set to `true` to use synthetic test data without a backend | Optional — for development/demo |

### Amplify Configuration

AWS Amplify is configured in `src/config/amplify.ts` (as per project structure). The configuration reads from environment variables — never hardcode values.

```typescript
// Example: src/config/amplify.ts
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

> **Security Note**: Variables prefixed with `EXPO_PUBLIC_` are embedded in the client bundle and visible to end users. This is acceptable for Cognito User Pool IDs and API URLs (they are not secrets — authentication still requires valid credentials). Never put actual secrets (passwords, API keys with write access) in `EXPO_PUBLIC_` variables.

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npx expo start` | Start Expo development server |
| `npm run android` | Start on Android emulator/device |
| `npm run ios` | Start on iOS simulator/device |
| `npm run web` | Start in web browser |
| `npm run lint` | Run ESLint linter |
| `npm run lint:fix` | Run ESLint with auto-fix |

### Expo CLI Commands

| Command | Description |
|---------|-------------|
| `npx expo start --clear` | Start with cache cleared |
| `npx expo start --tunnel` | Start with tunnel (for network issues) |
| `npx expo install <package>` | Install Expo-compatible package version |
| `npx expo doctor` | Check for common issues |

> **Important**: Do not install Expo CLI globally (`npm install -g expo-cli` is deprecated). Always use `npx expo` to run Expo commands.

---

## Troubleshooting

### `npx expo start` Fails

```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

**Common causes:**
- **Node version mismatch**: Ensure Node.js 18+ is installed (`node --version`)
- **Corrupted node_modules**: Delete and reinstall (`rm -rf node_modules && npm install`)
- **Port conflict**: Default port 8081 may be in use. Use `npx expo start --port 8082`
- **Stale cache**: Use `--clear` flag to clear Expo cache

### Metro Bundler Errors

```bash
# Clear Metro cache
npx expo start --clear

# Reset watchman (macOS)
watchman watch-del-all
```

**Common causes:**
- **Import errors**: Verify all imports point to existing files
- **Type errors**: Check TypeScript errors with your IDE
- **Missing module**: Run `npm install` if a dependency is missing

### Android Emulator Not Detected

```bash
# Verify ADB is accessible
adb devices

# Start emulator manually from Android Studio
# Then run:
npx expo start --android
```

### iOS Simulator Not Opening (macOS)

```bash
# Verify Xcode is installed
xcode-select --install

# Open simulator manually
open -a Simulator

# Then run:
npx expo start --ios
```

### Expo Go Connection Issues

- Ensure your phone and computer are on the **same WiFi network**
- **Use `npx expo start --tunnel`** if LAN connection fails — this is the most common fix for network-related issues. See [Tunnel Mode](#tunnel-mode-network-issues) above for details.
- Update Expo Go to the latest version on your device
- Check firewall settings — Expo needs port 8081
- If using a VPN, try disconnecting it or switch to tunnel mode
- Corporate/guest networks often isolate devices — tunnel mode bypasses this

### Build or Dependency Issues

```bash
# Check for known issues
npx expo doctor

# Re-install with clean slate
rm -rf node_modules package-lock.json
npm install

# Verify compatible package versions
npx expo install --check
```

### ESLint Errors

```bash
# Run lint to see all issues
npm run lint

# Auto-fix what can be fixed
npm run lint:fix
```

**Common causes:**
- **Unused imports**: Remove imports that are not referenced
- **Missing types**: Add TypeScript type annotations
- **Hook violations**: Follow React Hooks rules (no conditional hooks, hooks only in components/custom hooks)

---

## Support

1. **Check documentation** in the `docs/` folder
2. **Review [Data Integration Design](DataIntegrationDesign.md)** for backend-related questions
3. **Check tour-data-api docs** for backend API details
4. **GitHub Issues** — create an issue with:
   - Error messages and screenshots
   - Steps to reproduce
   - Environment details (OS, Node version, Expo version, device/simulator)

### Useful Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Navigation Documentation](https://reactnavigation.org/docs/getting-started)
- [AWS Amplify Gen 2 Documentation](https://docs.amplify.aws/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [expo-sqlite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)

---

[← Back to README](../README.md)
