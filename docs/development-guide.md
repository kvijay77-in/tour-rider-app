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
EXPO_PUBLIC_AWS_USER_POOL_ID=<your-cognito-user-pool-id>
EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=<your-cognito-client-id>
EXPO_PUBLIC_AWS_IDENTITY_POOL_ID=<your-cognito-identity-pool-id>
EXPO_PUBLIC_TOUR_DATA_API_BASE_URL=<your-tour-data-api-url>
EXPO_PUBLIC_LOG_LEVEL=DEBUG
```

> **Important**: All environment variables must use the `EXPO_PUBLIC_` prefix. This is an Expo requirement for bundling variables into the app.

### 3. Obtain AWS Credentials

Contact the tour-data-api team or AWS administrator to obtain:
- Cognito User Pool ID
- Cognito Client ID
- Cognito Identity Pool ID
- tour-data-api Base URL

These should be the **same credentials** used by the poc-app (Check-In App).

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
- Verify offline functionality works
- Test with different user types (General Rider, Registered Rider)

### 4. Lint Your Code

```bash
npm run lint
```

Fix any linting errors before committing.

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

Follow the ESLint configuration from poc-app for consistent formatting.

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
3. Examine the poc-app reference implementation
4. Start implementing features following the project structure

---

## Related Documentation

- [Requirements](Requirements.md) — Feature specifications
- [Solution Design](SolutionDesign.md) — Architecture and design
- [Project Structure](project-structure.md) — Folder organization
- [poc-app Development Guide](../../poc-app-main/docs/development-guide.md) — Reference guide

---

[← Back to README](../README.md)
