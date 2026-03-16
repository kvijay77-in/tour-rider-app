# Check-In App (poc-app)

Mobile and web application for managing rider check-ins during non-competitive cycling tours. Built with React Native and Expo, supporting iOS, Android, and Web from a single codebase.

## 📋 Overview

The Check-In App is used by cycling tour administrators, pit stop crew, and hotel staff to track riders during daily rides. It provides:

- **Dashboard**: Real-time rider tracking with color-coded status grid, stage views, sorting, and zoom levels
- **QR Check-In**: Scan rider QR codes at each stage (Start, Pit Stops, Finish)
- **Special Check-Ins**: Not Riding and Quit Riding handling with proper business rule enforcement
- **Offline Support**: Full offline capability for remote pit stop locations using SQLite local storage
- **Role-Based Access**: Five roles (Administrator, Super User, Pit Stop Crew, Hotel Staff, Guest) with feature-level permissions

## 🏗️ Architecture

- **Platform**: React Native with Expo managed workflow (iOS, Android, Web)
- **Language**: TypeScript
- **Backend**: [tour-data-api](https://github.com/kvijay77-in/tour-data-api) — AWS SAM, Lambda, API Gateway HTTP API, DynamoDB
- **Authentication**: AWS Cognito via AWS Amplify Auth SDK
- **Local Storage**: SQLite (via `expo-sqlite`) for offline support and caching
- **Navigation**: React Navigation (native stack + bottom tabs)
- **State Management**: React Context + Hooks

### Data Flow

```
Mobile/Web App
    ↓
[Amplify Auth (Cognito)]     ← Authentication, JWT token management
    ↓ (JWT token)
[API Service Layer]           ← src/services/api/
    ↓ (HTTP calls with Bearer token)
[tour-data-api]               ← API Gateway HTTP API → Lambda → DynamoDB
```

### Offline Architecture

The app uses **SQLite as the single source of truth** for all UI reads. Two independent background processes keep data synchronized:

```
┌─────────────┐     write      ┌──────────┐     async push     ┌──────────────┐
│  Check-In   │ ──────────────→│  SQLite  │ ──────────────────→│  Backend API │
│  (UI)       │                │  (local) │                    │  (tour-data) │
└─────────────┘                │          │←───────────────────│              │
                               │          │   periodic pull    │              │
┌─────────────┐     read       │          │                    └──────────────┘
│  Dashboard  │ ←──────────────│          │
│  (UI)       │                └──────────┘
└─────────────┘
```

- **Outbound sync**: Check-ins written to SQLite first, then pushed to backend asynchronously
- **Inbound sync**: Dashboard data polled from backend every 5 seconds (active ride) and written to SQLite
- **Seamless transitions**: Online/offline mode changes only pause/resume sync processes — no separate code paths

## 🎯 Key Features

### Dashboard (Home Screen)
- Grid display of all riders with color-coded stage status
- Cumulative stage count summary in header
- Stage-specific view toggle (per stage perspective)
- Sort toggle (by stage progression or Rider ID)
- 4-level zoom (Rider ID → Name → Contact → Photo)
- Historical ride view (read-only)
- Floating QR scanner button (draggable)

### Check-In System
- QR code scanning for rider identification
- Three check-in types: Normal, Not Riding, Quit Riding
- Manual entry fallback (auto-activates after scan failures)
- Remote manual check-in for Quit Riding scenarios
- Full offline check-in capture with automatic sync

### Role-Based Access Control (RBAC)

| Role | Dashboard | Check-In | Manual Check-In | Ride Management |
|------|-----------|----------|-----------------|-----------------|
| Administrator | ✅ Full | ✅ All types | ✅ | ✅ Add/Modify/Close |
| Super User | ✅ Full | ✅ All types | ✅ | ❌ |
| Pit Stop Crew | ✅ Full + Stage filter | ✅ All types (QR only) | ❌ | ❌ |
| Hotel Staff | ❌ | ✅ Finish only | ❌ | ❌ |
| Guest | ✅ Read-only | ❌ | ❌ | ❌ |

### Offline Mode
- Manual toggle for user control in unstable connectivity
- Automatic detection via NetInfo
- Local check-in capture with pending sync queue
- Dashboard reads from SQLite cache
- Pit Stop Crew auto-switches to assigned stage view
- Offline indicator in Dashboard header

## 🔧 Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Framework | React Native 0.81 + Expo SDK 54 | Cross-platform mobile and web |
| Language | TypeScript | Type safety |
| Authentication | AWS Amplify Auth + Cognito | JWT-based authentication |
| API Client | fetch (built-in) | HTTP calls to tour-data-api |
| Local Database | expo-sqlite | Offline storage and caching |
| Navigation | React Navigation 7 | Screen navigation |
| QR Scanning | expo-camera + expo-barcode-scanner | Rider QR code scanning |
| Connectivity | @react-native-community/netinfo | Network state detection |
| Icons | @expo/vector-icons | UI icons |
| SVG | react-native-svg | Custom SVG components |

## 🚀 Getting Started

- **Developers**: See the [Development Guide](docs/development-guide.md) for environment setup, running the app, and development workflows.
- **Requirements**: See [Requirements](docs/Requirements.md) for detailed feature specifications.
- **Architecture**: See [Solution Design](docs/SolutionDesign.md) for technical design decisions.

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd poc-app

# Install dependencies
npm install

# Start the development server
npx expo start

# Run on specific platforms
npx expo start --android
npx expo start --ios
npx expo start --web
```

> **Note**: Do not install Expo CLI globally — use `npx` to run Expo commands.

### Mock Data Mode (No Backend Required)

To explore the app without a backend or AWS account, enable mock data mode in your `.env` file:

```
EXPO_PUBLIC_USE_MOCK_DATA=true
```

This returns synthetic test data from the service layer — all screens work normally. Set to any other value or remove to use the real backend API. See the [Development Guide](docs/development-guide.md#development-with-mock-data) for details.

## 📁 Project Structure

For detailed project organization and folder structure, see [docs/project-structure.md](docs/project-structure.md).

**Quick Overview:**
- `src/screens/` — Screen components (dashboard, check-in, admin, auth)
- `src/components/` — Reusable UI components
- `src/services/` — Business logic, API integration, database, sync
- `src/context/` — React Context providers (Auth, Tour, Offline, Role)
- `src/types/` — TypeScript type definitions
- `src/constants/` — Application constants (colors, roles, stages)
- `amplify/` — AWS Amplify backend configuration
- `docs/` — Project documentation

## 🔐 Security

### Authentication Flow

1. **User Login**: App authenticates via Amplify Auth SDK → Cognito
2. **Token Issued**: Cognito returns JWT tokens (ID, Access, Refresh)
3. **API Requests**: API service layer includes JWT in `Authorization: Bearer <token>` header
4. **Token Validation**: API Gateway validates JWT with Cognito
5. **Token Refresh**: Amplify SDK automatically refreshes expired tokens

### Security Measures

- **No direct AWS access** — all data access through tour-data-api (API Gateway → Lambda → DynamoDB)
- **No hardcoded credentials** — API URLs and Cognito config via environment variables
- **Secure token storage** — JWT tokens managed by Amplify SDK, sensitive data via `expo-secure-store`
- **Sandboxed local data** — SQLite stored in app sandbox (OS-level protection)
- **HTTPS only** — all API communication encrypted in transit
- **RBAC enforcement** — feature-level access control based on user roles

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Documentation Index](docs/docs-index.md) | Complete guide to all project documentation |
| [Development Guide](docs/development-guide.md) | Environment setup, running the app, testing, troubleshooting |
| [Requirements](docs/Requirements.md) | Detailed functional requirements, use cases, and feature specifications |
| [Solution Design](docs/SolutionDesign.md) | Architecture, design principles, component structure, technical decisions |
| [Dashboard Feature](docs/Dashboard-Feature.md) | Dashboard screen specification — grid, stages, sorting, zoom |
| [Data Integration Design](docs/DataIntegrationDesign.md) | Backend integration architecture, offline sync, conflict resolution |
| [Project Structure](docs/project-structure.md) | Project folder organization and code structure |

## 🔗 Related Projects

| Project | Description |
|---------|-------------|
| [tour-data-api](https://github.com/kvijay77-in/tour-data-api) | Backend REST API — AWS SAM, Lambda, API Gateway, DynamoDB |

The Check-In App consumes the tour-data-api for all data operations. The backend manages tours, riders, rides, check-ins, and user data. See the [Data Integration Design](docs/DataIntegrationDesign.md) for the complete integration architecture.

## 🤝 Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run linting: `npm run lint`
4. Submit a pull request to `main`

## 📝 License

[Specify your license here]
