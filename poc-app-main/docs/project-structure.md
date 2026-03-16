# Project Folder Structure

[← Back to README](../README.md)

Following structure will be used in the project and any addition/restructure should be updated here. But first changes should be approved before it be applied.

```
poc-app/
│
├── .git/
├── .github/
│   └── copilot-instructions.md
│
├── docs/
│   ├── Requirements.md
│   ├── SolutionDesign.md
│   ├── Dashboard-Feature.md
│   ├── DataIntegrationDesign.md
│   ├── Generic-App-Distribution-Analysis.md
│   ├── development-guide.md
│   ├── docs-index.md
│   ├── project-structure.md
│   └── Images/
│
├── src/
│   ├── screens/                    # Screen components
│   │   ├── dashboard/              # Dashboard related screens
│   │   ├── checkin/                # Check-in related screens
│   │   ├── admin/                  # Admin feature screens
│   │   └── auth/                   # Authentication screens
│   │
│   ├── components/                 # Reusable UI components
│   │   ├── common/                 # Common components (buttons, inputs, etc.)
│   │   ├── dashboard/              # Dashboard specific components
│   │   └── checkin/                # Check-in specific components
│   │
│   ├── navigation/                 # Navigation configuration
│   │   ├── AppNavigator.tsx        # Main app navigation
│   │   └── AuthNavigator.tsx       # Authentication navigation
│   │
│   ├── services/                   # Business logic & API integration
│   │   ├── api/                    # tour-data-api RESTful HTTP calls
│   │   │   ├── apiClient.ts        # Base HTTP client with auth, retry, error handling
│   │   │   ├── tourApi.ts          # Tour endpoints
│   │   │   ├── riderApi.ts         # Rider endpoints
│   │   │   ├── rideApi.ts          # Ride endpoints
│   │   │   ├── checkInApi.ts       # Check-in endpoints
│   │   │   ├── dashboardApi.ts     # Dashboard composite endpoint
│   │   │   └── mockData.ts         # Mock data for dev/demo mode (EXPO_PUBLIC_USE_MOCK_DATA)
│   │   ├── config/                 # Runtime org configuration service
│   │   │   └── orgConfigService.ts # HMAC verification, expo-secure-store persistence
│   │   ├── auth/                   # AWS Cognito authentication
│   │   └── qrcode/                 # QR code scanning service
│   │
│   ├── hooks/                      # Custom React hooks
│   │   └── useAuth.ts              # Authentication hook
│   │
│   ├── context/                    # React Context providers
│   │   ├── AuthContext.tsx         # Authentication context
│   │   ├── TourContext.tsx         # Active tour context (resolves tourId at startup)
│   │   ├── OfflineContext.tsx      # Network connectivity context (drives offline banner)
│   │   └── RoleContext.tsx         # RBAC role context
│   │
│   ├── types/                      # TypeScript type definitions
│   │   ├── models.ts               # Data models
│   │   ├── api.ts                  # API types
│   │   ├── config.ts               # OrgConfig type for runtime org configuration
│   │   └── navigation.ts           # Navigation types
│   │
│   ├── utils/                      # Helper utility functions
│   │   ├── logger.ts               # Structured, level-gated logging utility
│   │   ├── permissions.ts          # RBAC permission utilities
│   │   ├── validators.ts           # Input validation
│   │   └── formatters.ts           # Data formatting utilities
│   │
│   ├── constants/                  # Application constants
│   │   ├── colors.ts               # Color scheme constants
│   │   ├── roles.ts                # Role definitions
│   │   └── stages.ts               # Ride stage definitions
│   │
│   └── config/                     # Configuration files
│       └── amplify.ts              # AWS Amplify configuration
│
├── assets/                         # Static assets
│   ├── images/                     # Image files
│   ├── fonts/                      # Custom fonts
│   └── icons/                      # Icon files
│
├── tools/                          # Publisher/admin utilities (not part of the app bundle)
│   └── setup-link-generator.html   # HMAC-signed setup link & QR code generator
│
├── node_modules/                   # Dependencies (not in git)
│
├── .gitignore                      # Git ignore rules
├── .env.example                    # Environment variables template
├── App.tsx                         # Root application component
├── app.json                        # Expo configuration
├── package.json                    # NPM dependencies and scripts
└── tsconfig.json                   # TypeScript configuration
```

**Key Structure Notes:**

### Source Code (`src/`)
- **`screens/`**: Page-level components organized by feature domain (dashboard, check-in, admin, auth). Each screen connects to context providers and services.
- **`components/`**: Reusable UI components. `common/` for shared components, feature-specific folders for domain components.
- **`services/`**: Business logic layer isolated from UI. Contains API client, org configuration service.
- **`context/`**: React Context providers for global state — authentication, active tour, offline status (for banner), RBAC roles.
- **`types/`**: TypeScript type definitions and interfaces for data models, API responses, and navigation.
- **`constants/`**: Application-wide constants — color definitions, role definitions, stage definitions.
- **`hooks/`**: Custom React hooks for reusable stateful logic (auth).
- **`utils/`**: Pure utility functions — permissions checking, input validation, data formatting.
- **`config/`**: Configuration files for Amplify setup.

### Documentation (`docs/`)
- **`Requirements.md`**: Detailed functional requirements, use cases, and feature specifications
- **`SolutionDesign.md`**: Architecture, design principles, component structure, technical decisions
- **`Dashboard-Feature.md`**: Dashboard screen specification — grid, stages, sorting, zoom, colors
- **`DataIntegrationDesign.md`**: Backend API integration architecture and offline status
- **`Generic-App-Distribution-Analysis.md`**: Feasibility analysis for distributing one generic app across multiple organizer AWS subscriptions
- **`development-guide.md`**: Environment setup, running the app, testing, troubleshooting
- **`docs-index.md`**: Complete documentation index with persona-based navigation
- **`project-structure.md`**: This file — project folder organization

### Infrastructure
- **`amplify/`**: AWS Amplify Gen 2 backend configuration (authentication, data resources). Auto-generated structure managed by Amplify CLI.
- **`App.tsx`**: Root application component — single entry point for Android, iOS, and Web.
- **`app.json`**: Expo configuration (app name, splash screen, platform settings).

### Additional Notes
- **Single Entry Point**: `App.tsx` serves as the root component for Android, iOS, and Web
- **Platform Agnostic**: All code in `/src` is shared across platforms
- **Services Layer**: Business logic isolated in `/services` for reusability
- **Offline Banner**: Simple status banner shown when device connectivity is lost
- **Type Safety**: TypeScript definitions in `/types` for type checking
- **RBAC Support**: Context and utilities for role-based access control
- **AWS Integration**: Amplify backend folder for cloud resources (auto-generated)

---

[← Back to README](../README.md)
