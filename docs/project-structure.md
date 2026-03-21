# Project Structure

[← Back to README](../README.md)

This document describes the folder organization and code structure for the Tour Rider App.

## Overview

The Tour Rider App follows the same project structure as the tour-mgmt-app (Check-In App) to maintain consistency and enable knowledge sharing across both applications.

```
tour-rider-app/
├── .github/                      # GitHub configuration
│   ├── copilot-instructions.md  # Copilot/Claude Code instructions
│   └── workflows/               # CI/CD workflows (future)
├── assets/                      # Static assets
│   ├── images/                  # App images and illustrations
│   │   ├── logo.png
│   │   ├── default-avatar.png
│   │   └── splash.png
│   └── icons/                   # App icons
├── docs/                        # Project documentation
│   ├── docs-index.md           # Documentation navigation
│   ├── Requirements.md         # Functional requirements
│   ├── SolutionDesign.md       # Architecture and design
│   ├── development-guide.md    # Development setup and workflows
│   └── project-structure.md    # This file
├── src/                         # Source code
│   ├── components/             # Reusable UI components
│   │   ├── common/            # Shared components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── tour/              # Tour-specific components
│   │   │   ├── TourCard.tsx
│   │   │   └── TourInfoBanner.tsx
│   │   ├── checkin/           # Check-in-specific components
│   │   │   ├── StageIndicator.tsx
│   │   │   └── CheckInCard.tsx
│   │   └── profile/           # Profile-specific components
│   │       └── ProfilePicture.tsx
│   ├── config/                 # Configuration files
│   │   └── amplify.ts         # AWS Amplify configuration
│   ├── constants/              # Application constants
│   │   ├── colors.ts          # Color palette
│   │   ├── stages.ts          # Stage definitions
│   │   └── index.ts           # Exports
│   ├── context/                # React Context providers
│   │   ├── AuthContext.tsx    # Authentication state
│   │   ├── RiderContext.tsx   # Rider profile state
│   │   └── TourContext.tsx    # Tour enrollment state
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts         # Authentication hook
│   │   ├── useRider.ts        # Rider profile hook
│   │   └── useTour.ts         # Tour data hook
│   ├── navigation/             # Navigation configuration
│   │   ├── AppNavigator.tsx   # Root navigator
│   │   ├── AuthNavigator.tsx  # Authentication flow
│   │   └── MainNavigator.tsx  # Main app navigation
│   ├── screens/                # Screen components
│   │   ├── auth/              # Authentication screens
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── SignUpScreen.tsx
│   │   │   └── ForgotPasswordScreen.tsx
│   │   ├── home/              # Home screens
│   │   │   └── HomeScreen.tsx
│   │   ├── tour/              # Tour screens
│   │   │   ├── TourListScreen.tsx
│   │   │   ├── TourDetailsScreen.tsx
│   │   │   ├── TourDashboardScreen.tsx
│   │   │   └── TourRegistrationScreen.tsx
│   │   ├── checkin/           # Check-in screens
│   │   │   ├── CheckInStatusScreen.tsx
│   │   │   └── CheckInHistoryScreen.tsx
│   │   ├── profile/           # Profile screens
│   │   │   └── ProfileScreen.tsx
│   │   └── notifications/     # Notification screens
│   │       └── NotificationsScreen.tsx
│   ├── services/               # Business logic and services
│   │   ├── api/               # API service layer
│   │   │   ├── apiClient.ts   # Base HTTP client
│   │   │   ├── riderApi.ts    # Rider profile API
│   │   │   ├── tourApi.ts     # Tour API
│   │   │   ├── tourRegistrationApi.ts # Tour registration API
│   │   │   ├── rideApi.ts     # Ride API
│   │   │   ├── checkInApi.ts  # Check-in API
│   │   │   └── notificationApi.ts # Notification API
│   │   └── config/            # Runtime configuration
│   │       └── orgConfigService.ts # Org config secure storage
│   ├── types/                  # TypeScript type definitions
│   │   ├── rider.ts           # Rider types
│   │   ├── tour.ts            # Tour types
│   │   ├── ride.ts            # Ride types
│   │   ├── checkin.ts         # Check-in types
│   │   ├── notification.ts    # Notification types
│   │   └── index.ts           # Exports
│   └── utils/                  # Utility functions
│       ├── logger.ts          # Logging utility
│       ├── dateFormatter.ts   # Date formatting
│       ├── validation.ts      # Input validation
│       └── permissions.ts     # Permission checks
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
├── App.tsx                     # App entry point
├── app.json                    # Expo configuration
├── eslint.config.js            # ESLint configuration
├── index.ts                    # Metro bundler entry
├── package.json                # Dependencies and scripts
├── README.md                   # Project README
├── tsconfig.json               # TypeScript configuration
├── tour-mgmt-app-main.zip           # Reference app (for development)
└── tour-data-api-main.zip     # Backend API reference (for development)
```

## Folder Descriptions

### `/assets`
Static assets like images, icons, and fonts. Organized by type.

### `/docs`
All project documentation following the format defined in tour-mgmt-app and tour-data-api.

### `/src/components`
Reusable UI components organized by scope:
- **common/**: Shared components used across multiple screens
- **tour/**: Tour-specific components
- **checkin/**: Check-in-specific components
- **profile/**: Profile-specific components

**Guidelines:**
- One component per file
- Co-locate styles using `StyleSheet.create()`
- Type all props with TypeScript interfaces
- Use functional components and hooks

### `/src/config`
Configuration files for AWS Amplify and other services. Environment-specific values loaded from `.env` files.

### `/src/constants`
Application-wide constants:
- **colors.ts**: Color palette (follow tour-mgmt-app color system)
- **stages.ts**: Stage definitions (Start, PS1, PS2, Finish)
- Keep constants immutable and well-typed

### `/src/context`
React Context providers for global state management:
- **AuthContext**: Authentication state, login/logout
- **RiderContext**: Rider profile, statistics
- **TourContext**: Active tour, enrollment status

**Guidelines:**
- Each context in its own file
- Provide custom hooks for consuming context (e.g., `useAuth()`)
- Minimize context updates to avoid unnecessary re-renders

### `/src/hooks`
Custom React hooks for reusable stateful logic:
- Extract complex state logic from components
- Follow React hooks naming convention (`use*`)
- Keep hooks focused and single-purpose

### `/src/navigation`
React Navigation configuration:
- **AppNavigator.tsx**: Root navigator, handles auth flow
- **AuthNavigator.tsx**: Login, sign-up, password reset
- **MainNavigator.tsx**: Bottom tab navigation for authenticated users

### `/src/screens`
Screen-level components, one per screen. Organized by feature area.

**Guidelines:**
- Screens orchestrate components and connect to contexts
- Keep screens thin — business logic belongs in services
- Each screen exports a default component
- Type navigation props with TypeScript

### `/src/services`
Business logic and API communication:

#### `/src/services/api`
HTTP client and API service layer for tour-data-api integration:
- **apiClient.ts**: Base fetch wrapper with auth, retry, error handling
- Feature-specific API files (riderApi, tourApi, etc.)

**Guidelines:**
- All API calls go through apiClient
- Handle errors consistently
- Return typed responses
- Log API calls at DEBUG level

### `/src/types`
TypeScript type definitions and interfaces:
- One file per domain (rider, tour, ride, etc.)
- Export types from index.ts
- Use interfaces for object shapes
- Use type aliases for unions and primitives

### `/src/utils`
Pure utility functions:
- **logger.ts**: Centralized logging (follow tour-mgmt-app logger pattern)
- **dateFormatter.ts**: Date/time formatting
- **validation.ts**: Input validation functions
- **permissions.ts**: Permission checks

**Guidelines:**
- Keep functions pure (no side effects)
- One function per export
- Write unit tests for utilities

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| React Components | PascalCase.tsx | `TourDashboardScreen.tsx` |
| Hooks | camelCase.ts (prefix `use`) | `useAuth.ts` |
| Utils | camelCase.ts | `dateFormatter.ts` |
| Types | camelCase.ts | `rider.ts` |
| Constants | camelCase.ts | `colors.ts` |
| Config | camelCase.ts | `amplify.ts` |

## Import Organization

Organize imports in this order:

1. React and React Native imports
2. Third-party library imports
3. Absolute imports from `src/`
4. Relative imports from current directory
5. Type imports

Example:
```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { logger } from '../utils/logger';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../constants/colors';

import { TourCard } from './TourCard';

import type { Tour } from '../types/tour';
```

## Code Organization Principles

1. **Separation of Concerns**: UI components should be separate from business logic
2. **Single Responsibility**: Each file/function should have one clear purpose
3. **DRY (Don't Repeat Yourself)**: Extract reusable logic into hooks, utilities, or components
4. **Type Safety**: Leverage TypeScript for all code
5. **Consistency**: Follow the patterns established in tour-mgmt-app

## Testing Structure (Future)

When tests are added, they should mirror the source structure:

```
tests/
├── components/
├── hooks/
├── services/
│   └── api/
└── utils/
```

Test files should be named `{name}.test.ts` or `{name}.test.tsx`.

---

## Related Documentation

- [Solution Design](SolutionDesign.md) — Architecture and design decisions
- [Development Guide](development-guide.md) — Setup and development workflows
- [tour-mgmt-app Project Structure](../../tour-mgmt-app-main/docs/project-structure.md) — Reference structure

---

[← Back to README](../README.md)
