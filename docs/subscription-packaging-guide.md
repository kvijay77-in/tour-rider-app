# Subscription-Specific App Packaging Guide

[← Back to Documentation Index](docs-index.md)

> **Last Updated**: 2026-04-26

## Table of Contents

- [Overview](#overview)
- [Subscription Modes](#subscription-modes)
- [Single Subscription Mode](#single-subscription-mode)
  - [Configuration Steps](#configuration-steps)
  - [Environment Variables](#environment-variables)
  - [App Branding](#app-branding)
  - [Build Process](#build-process)
- [Multi Subscription Mode](#multi-subscription-mode)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Tour Rider App supports two operating modes to accommodate different deployment scenarios:

1. **Single Subscription Mode**: App is tied to a specific organizer's subscription at build time. Users can directly sign up and login without providing invitation codes.

2. **Multi Subscription Mode**: App supports multiple organizers via invitation-based sign-up. Users must provide an invitation code to identify their organizer.

This guide focuses on configuring and building the app for **single subscription mode**, which is ideal for individual tour operators who want a dedicated app for their riders.

---

## Subscription Modes

### When to Use Single Subscription Mode

Use single subscription mode when:
- You are a tour operator with your own subscription
- You want a dedicated, branded app for your riders
- You don't want riders to deal with invitation codes
- You have complete control over user account creation
- You are deploying to app stores under your own developer account

### When to Use Multi Subscription Mode

Use multi subscription mode when:
- You are building a SaaS platform supporting multiple organizers
- You want one app to serve riders from different tour operators
- You need dynamic organizer switching
- You want riders to use invitation codes to identify their organizer

---

## Single Subscription Mode

### Configuration Steps

#### 1. Set Subscription Mode

Create a `.env` file (or update `.env.local` for development) with:

```bash
EXPO_PUBLIC_SUBSCRIPTION_MODE=single
```

#### 2. Configure Organizer Details

Add your organizer-specific AWS and API configuration:

```bash
# Organizer Identification
EXPO_PUBLIC_ORGANIZER_ID=my-tour-company
EXPO_PUBLIC_ORGANIZER_NAME=My Tour Company

# AWS Cognito Configuration
EXPO_PUBLIC_AWS_USER_POOL_ID=us-east-1_XXXXXXXXX
EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_AWS_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# API Configuration
EXPO_PUBLIC_TOUR_DATA_API_BASE_URL=https://api.my-tour-company.com

# Logging
EXPO_PUBLIC_LOG_LEVEL=WARN
```

**Important Notes:**
- `ORGANIZER_ID`: A unique identifier for your organization (lowercase, no spaces)
- `ORGANIZER_NAME`: Display name shown to users in the app
- AWS Cognito settings come from your subscription's Cognito User Pool
- API base URL points to your subscription's tour-data-api deployment
- Use `LOG_LEVEL=WARN` or `ERROR` for production builds

#### 3. Customize App Branding (Optional)

Edit `app.json` to customize the app name and package identifiers:

```json
{
  "expo": {
    "name": "My Tour Company Rider",
    "slug": "my-tour-company-rider",
    "ios": {
      "bundleIdentifier": "com.mytourcompany.rider"
    },
    "android": {
      "package": "com.mytourcompany.rider"
    }
  }
}
```

#### 4. Replace App Assets (Optional)

Replace the following files with your branded assets:
- `assets/icon.png` — App icon (1024x1024 px)
- `assets/adaptive-icon.png` — Android adaptive icon (1024x1024 px)
- `assets/splash-icon.png` — Splash screen image
- `assets/favicon.png` — Web favicon (48x48 px)

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EXPO_PUBLIC_SUBSCRIPTION_MODE` | Yes | Operating mode | `single` |
| `EXPO_PUBLIC_ORGANIZER_ID` | Yes | Unique organizer ID | `acme-cycling` |
| `EXPO_PUBLIC_ORGANIZER_NAME` | Yes | Display name | `ACME Cycling Tours` |
| `EXPO_PUBLIC_AWS_USER_POOL_ID` | Yes | Cognito User Pool ID | `us-east-1_ABC123DEF` |
| `EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID` | Yes | Cognito Client ID | `1a2b3c4d5e6f7g8h9i0j` |
| `EXPO_PUBLIC_AWS_IDENTITY_POOL_ID` | No | Cognito Identity Pool ID | `us-east-1:xxx-xxx-xxx` |
| `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL` | Yes | API base URL | `https://api.acme.com` |
| `EXPO_PUBLIC_LOG_LEVEL` | No | Logging level | `WARN` (production) |

### Build Process

#### Development Build

For local development and testing:

```bash
# Install dependencies
npm install

# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run web version
npm run web
```

#### Production Build (Expo EAS)

For production deployment to app stores:

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```

2. **Configure EAS**:
   ```bash
   eas init
   ```

3. **Create `eas.json`** with your environment variables:
   ```json
   {
     "build": {
       "production": {
         "env": {
           "EXPO_PUBLIC_SUBSCRIPTION_MODE": "single",
           "EXPO_PUBLIC_ORGANIZER_ID": "my-tour-company",
           "EXPO_PUBLIC_ORGANIZER_NAME": "My Tour Company",
           "EXPO_PUBLIC_AWS_USER_POOL_ID": "us-east-1_XXXXXXXXX",
           "EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID": "xxxxxxxxxx",
           "EXPO_PUBLIC_TOUR_DATA_API_BASE_URL": "https://api.my-tour-company.com",
           "EXPO_PUBLIC_LOG_LEVEL": "WARN"
         }
       }
     }
   }
   ```

4. **Build for iOS**:
   ```bash
   eas build --platform ios --profile production
   ```

5. **Build for Android**:
   ```bash
   eas build --platform android --profile production
   ```

6. **Submit to App Stores**:
   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

### App Behavior in Single Subscription Mode

When the app runs in single subscription mode:

1. **No Invitation Code Required**: Users go directly to sign-up/login screens
2. **Pre-Configured Organizer**: AuthContext is initialized with the organizer details
3. **Direct API Access**: All API calls automatically go to the configured tour-data-api instance
4. **Simplified UX**: No organizer selection or switching — one app, one subscription

---

## Multi Subscription Mode

For multi-subscription (SaaS) mode, set:

```bash
EXPO_PUBLIC_SUBSCRIPTION_MODE=multi
```

In this mode:
- Users must provide an invitation code during sign-up
- Organizer details are resolved dynamically from invitation validation
- App can switch between organizers (if user has multiple)
- Requires invitation URL implementation (future feature, see `docs/design-signup-approach.md`)

**Note**: Multi-subscription mode requires additional development work for invitation code validation and organizer discovery. See issue #5 and PR #7 for the invitation-based sign-up implementation.

---

## Migration Guide

### From Generic to Single Subscription

If you have an existing generic build and want to create a subscription-specific version:

1. **Backup your `.env` file** (if you have one)
2. **Create a new `.env` file** with single-subscription mode settings
3. **Update `app.json`** with your branding
4. **Replace assets** with your branded versions
5. **Test locally** with `npm start`
6. **Build with EAS** using the production profile
7. **Submit to app stores** under your developer account

### From Single to Multi Subscription

If you want to revert to multi-subscription mode:

1. Set `EXPO_PUBLIC_SUBSCRIPTION_MODE=multi` in `.env`
2. Remove or comment out the single-subscription-specific variables
3. Implement invitation code validation (see `docs/design-signup-approach.md`)
4. Rebuild the app

---

## Troubleshooting

### Common Issues

#### 1. "Incomplete subscription configuration" error

**Cause**: Missing or invalid environment variables in single-subscription mode.

**Solution**: Verify all required variables are set in `.env`:
- `EXPO_PUBLIC_SUBSCRIPTION_MODE=single`
- `EXPO_PUBLIC_ORGANIZER_ID`
- `EXPO_PUBLIC_ORGANIZER_NAME`
- `EXPO_PUBLIC_AWS_USER_POOL_ID`
- `EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID`
- `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL`

#### 2. "API base URL is not configured" error

**Cause**: The `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL` is missing or empty.

**Solution**: Add the API base URL to your `.env` file:
```bash
EXPO_PUBLIC_TOUR_DATA_API_BASE_URL=https://api.your-domain.com
```

#### 3. "Missing Cognito configuration" warning

**Cause**: Cognito User Pool ID or Client ID is missing.

**Solution**: Add the Cognito settings from your subscription's AWS resources:
```bash
EXPO_PUBLIC_AWS_USER_POOL_ID=us-east-1_XXXXXXXXX
EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 4. App shows "Login required" but can't log in

**Cause**: Cognito pool mismatch or incorrect configuration.

**Solution**:
1. Verify the Cognito pool ID and client ID match your subscription's resources
2. Ensure the user account exists in the correct Cognito pool
3. Check the app logs for authentication errors (set `LOG_LEVEL=DEBUG`)

#### 5. API calls fail with 401 or 403

**Cause**: API base URL points to wrong organizer's API, or JWT token is invalid.

**Solution**:
1. Verify `TOUR_DATA_API_BASE_URL` matches your subscription's API endpoint
2. Ensure the Cognito pool is trusted by the API Gateway authorizer
3. Check the API logs for detailed error messages

### Validation Checklist

Before building for production, verify:

- [ ] `.env` file has all required variables for single-subscription mode
- [ ] `SUBSCRIPTION_MODE` is set to `single`
- [ ] Organizer ID and Name are correct
- [ ] Cognito User Pool ID and Client ID match your subscription
- [ ] API base URL is correct and reachable
- [ ] App branding in `app.json` is customized (if desired)
- [ ] App assets (icon, splash) are replaced with your branding (if desired)
- [ ] Test sign-up and login work correctly
- [ ] Test API calls (profile, tours, check-ins) succeed
- [ ] Log level is set to `WARN` or `ERROR` for production

---

## Related Documentation

- [Requirements](Requirements.md) — Feature specifications and business rules
- [Solution Design](SolutionDesign.md) — Architecture and technology stack
- [Development Guide](development-guide.md) — Environment setup and local development
- [Deployment Guide](deployment-guide.md) — Production deployment instructions
- [Sign-Up Approach Design](design-signup-approach.md) — Multi-organizer invitation-based sign-up

---

[← Back to Documentation Index](docs-index.md)
