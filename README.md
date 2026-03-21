# Tour Rider App

Mobile and web application for cycling tour riders to manage their tour participation, track daily progress, receive notifications, and access self-service features. Built with React Native and Expo, supporting iOS, Android, and Web from a single codebase.

## Overview

The Tour Rider App is designed for cyclists participating in non-competitive cycling tours. It provides riders with:

- **Tour Registration**: Pre-registration for tours managed by tour organizers
- **Tour Dashboard**: Real-time view of current tour status and personal progress
- **Daily Check-In Status**: Track check-ins at each stage (Start, Pit Stops, Finish)
- **Tour Notifications**: Receive announcements, ride updates, and alerts from organizers
- **Self-Service Features**: Mark yourself as "Not Riding" or "Quit Riding" for the current ride
- **Profile Management**: Maintain rider profile and emergency contact information

## Architecture

- **Platform**: React Native with Expo managed workflow (iOS, Android, Web)
- **Language**: TypeScript
- **Backend**: [tour-data-api](https://github.com/kvijay77-in/tour-data-api) — AWS SAM, Lambda, API Gateway HTTP API, DynamoDB
- **Authentication**: AWS Cognito via AWS Amplify Auth SDK (dedicated user pool for riders)
- **Navigation**: React Navigation (native stack + bottom tabs)
- **State Management**: React Context + Hooks

### Data Flow

```
Mobile/Web App (Rider)
    |
[Amplify Auth (Cognito)]     --> Authentication, JWT token management
    | (JWT token)
[API Service Layer]           --> src/services/api/
    | (HTTP calls with Bearer token)
[tour-data-api]               --> API Gateway HTTP API --> Lambda --> DynamoDB
```

## Key Features

### User Types

| User Type | Description | Access |
|-----------|-------------|--------|
| **General Rider** | Registered in app but not enrolled in a tour | Manage profile, view non-tour features |
| **Registered Rider** | Approved to participate in a specific tour | Full tour features: dashboard, check-in status, notifications, self-service |

### Tour Registration

The app supports two registration models (based on tour organizer's preference):

1. **Pre-Registration** (primary model): Riders express interest; tour organizer reviews and approves. Only approved riders are enrolled. Other signed-up users can use non-tour features.
2. **Browse and Register** (future): Riders browse available tours and submit registration requests. This model requires additional workflow in tour-mgmt-app and is not enabled currently.

### Tour Dashboard (Registered Riders)
- Current tour information (day number, tour status)
- Today's ride summary (route, stages, distance)
- Personal statistics (rides completed, streak, total distance)
- Quick access to check-in status and notifications

### Daily Check-In Status
- Visual progress through today's stages (Start -> PS1 -> PS2 -> Finish)
- Color-coded status indicators
- Check-in timestamps and locations
- Historical check-in view for past rides

### Tour Notifications
- Receive announcements, ride updates, and alerts from organizers
- In-app notification center with unread count
- Push notifications (when permissions granted)
- Filter and archive notifications

### Self-Service Features

#### Not Riding
- Mark yourself as "Not Riding" for the current ride
- Used when unable to ride that day (illness, rest day, transported via support vehicle)
- Must be set before any check-ins for the ride
- Applies to current ride only (can ride tomorrow)
- Cannot check in at any stages once set

#### Quit Riding
- End the current ride midway after starting
- Used when the rider starts a ride but decides to stop (injury, mechanical issue, fatigue)
- Applies to the current ride only (can participate in the next ride)
- Rider can optionally provide reason and location for support vehicle dispatch
- Requires double confirmation

### Profile Management
- Create and maintain rider profile
- Upload profile picture
- Edit contact information and emergency contacts
- View tour participation history

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Framework | React Native 0.81 + Expo SDK 54 | Cross-platform mobile and web |
| Language | TypeScript | Type safety |
| Authentication | AWS Amplify Auth + Cognito | JWT-based authentication |
| API Client | fetch (built-in) | HTTP calls to tour-data-api |
| Navigation | React Navigation 7 | Screen navigation |
| Icons | @expo/vector-icons | UI icons |
| SVG | react-native-svg | Custom SVG components |

## Getting Started

- **Developers**: See the [Development Guide](docs/development-guide.md) for environment setup, running the app, and development workflows.
- **Requirements**: See [Requirements](docs/Requirements.md) for detailed feature specifications.
- **Architecture**: See [Solution Design](docs/SolutionDesign.md) for technical design decisions.

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd tour-rider-app

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

### Environment Configuration

Create a `.env` file based on `.env.example`:

```
EXPO_PUBLIC_AWS_USER_POOL_ID=<your-cognito-user-pool-id>
EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=<your-cognito-client-id>
EXPO_PUBLIC_AWS_IDENTITY_POOL_ID=<your-cognito-identity-pool-id>
EXPO_PUBLIC_TOUR_DATA_API_BASE_URL=<your-tour-data-api-url>
EXPO_PUBLIC_LOG_LEVEL=DEBUG
```

> **Important**: All environment variables must use the `EXPO_PUBLIC_` prefix for Expo to bundle them.

## Project Structure

For detailed project organization and folder structure, see [docs/project-structure.md](docs/project-structure.md).

**Quick Overview:**
- `src/screens/` — Screen components (auth, home, tour, check-in, profile, notifications)
- `src/components/` — Reusable UI components
- `src/services/` — Business logic, API integration
- `src/context/` — React Context providers (Auth, Rider, Tour)
- `src/types/` — TypeScript type definitions
- `src/constants/` — Application constants (colors, stages)
- `docs/` — Project documentation

## Security

### Authentication Flow

1. **User Sign-Up**: App creates account via Amplify Auth SDK -> Cognito
2. **Email Verification**: Rider verifies email to activate account
3. **Profile Creation**: Rider profile stored in tour-data-api RiderProfile table
4. **User Login**: App authenticates via Amplify Auth SDK -> Cognito
5. **Token Issued**: Cognito returns JWT tokens (ID, Access, Refresh)
6. **API Requests**: API service layer includes JWT in `Authorization: Bearer <token>` header
7. **Token Validation**: API Gateway validates JWT with Cognito
8. **Token Refresh**: Amplify SDK automatically refreshes expired tokens

### Security Measures

- **No direct AWS access** — all data access through tour-data-api (API Gateway -> Lambda -> DynamoDB)
- **No hardcoded credentials** — API URLs and Cognito config via environment variables
- **Secure token storage** — JWT tokens managed by Amplify SDK, sensitive data via `expo-secure-store`
- **HTTPS only** — all API communication encrypted in transit
- **Dedicated rider user pool** — Dedicated Cognito User Pool for riders, separate from staff (Check-In App)

## Documentation

| Document | Description |
|----------|-------------|
| [Documentation Index](docs/docs-index.md) | Complete guide to all project documentation |
| [Requirements](docs/Requirements.md) | Detailed functional requirements, use cases, and feature specifications |
| [Solution Design](docs/SolutionDesign.md) | Architecture, design principles, component structure, technical decisions |
| [Development Guide](docs/development-guide.md) | Environment setup, running the app, testing, troubleshooting (to be created) |
| [Project Structure](docs/project-structure.md) | Project folder organization and code structure |

## Related Projects

| Project | Description |
|---------|-------------|
| [tour-data-api](https://github.com/kvijay77-in/tour-data-api) | Backend REST API — AWS SAM, Lambda, API Gateway, DynamoDB |
| [tour-mgmt-app](https://github.com/kvijay77-in/tour-mgmt-app) | Check-In App — Used by tour administrators and staff |

The Tour Rider App consumes the tour-data-api for all data operations and shares the same technology stack as the tour-mgmt-app (Check-In App).

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Run linting: `npm run lint`
4. Submit a pull request to `main`

## License

[Specify your license here]
