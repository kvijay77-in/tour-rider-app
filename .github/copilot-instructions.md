# Instructions for GitHub Copilot / Claude Code for the Tour Rider App

## Primary Instructions
These instructions are general for our interaction and MUST BE STRICTLY FOLLOWED.
- /docs/Requirements.md must be read and understood before any development work is taken up.
- /docs/SolutionDesign.md must be referred to for design principles and architecture.
- Follow the project folder structure as described in /docs/project-structure.md for placing files and organizing code. Any changes to the structure must be flagged for review and once approved should be updated in that document.
- Always refer to /docs/Requirements.md for any clarifications on features, functions, and requirements.
- If any inputs during our interaction contradict the requirement, flag it and ask for clarifications.
- Understand the overall project requirements, features, and constraints as described in /docs/Requirements.md.
- Ensure all code suggestions and implementations strictly adhere to the requirements specified in /docs/Requirements.md.
- Always follow what was asked, do not suggest or code extra features or changes unless explicitly requested.
- Follow instructions and do not deviate from the task at hand.
- Do not go overboard and keep suggestions concise and relevant.
- Stick to design and instructions.
- Always ask for clarifications if the requirements are ambiguous or incomplete.
- Always prioritize security, performance, and maintainability in code suggestions.
- Always provide brief explanation on any command that you are running or suggesting to run.

## Reference Applications

This app follows the same technology stack and architecture patterns as the tour-mgmt-app (Check-In App). When implementing features:

1. **Refer to tour-mgmt-app** for implementation patterns:
   - Authentication flow (AWS Amplify + Cognito)
   - API service layer design
   - SQLite database structure for offline support
   - Logger implementation
   - Navigation patterns
   - Component structure

2. **Consult tour-data-api** for backend integration:
   - API endpoint specifications
   - Data model structure
   - Business rules enforcement
   - Error handling patterns

3. **Maintain consistency** between apps:
   - Use the same TypeScript patterns
   - Follow the same folder structure
   - Use the same naming conventions
   - Share utility functions where possible

## Technology Stack and Design Considerations

- Platform: Mobile (iOS and Android) and Web
- Programming Languages: TypeScript (strictly typed)
- Frameworks/Libraries: React Native, Expo CLI (managed workflow), AWS Amplify Auth
- Backend Services: tour-data-api (REST API)
- AWS Cognito for authentication (same user pool as tour-mgmt-app)
- Storage: DynamoDB (via tour-data-api), SQLite (for offline caching)
- API: REST API via tour-data-api (NOT GraphQL, NOT AppSync)
- Authentication: AWS Cognito via AWS Amplify Auth SDK

### Design Considerations

- The mobile app should be built using React Native with Expo managed workflow for ease of development and deployment.
- The web application should be built using react-native-web to achieve common codebase and UI components with the mobile app.
- **DO NOT use AWS Amplify for API or data** — all data access must go through tour-data-api REST API.
- Use AWS Cognito via AWS Amplify Auth SDK for user authentication and management.
- API calls use fetch (built-in) with a custom apiClient wrapper (follow tour-mgmt-app pattern).
- For offline support, use SQLite for local caching (expo-sqlite).
- Ensure the application is responsive and works well on various screen sizes and orientations for mobile devices.
- Details of AWS resources (Cognito User Pool, API URL) will be provided via environment variables.
- DynamoDB tables are created and managed by tour-data-api. This app only consumes the API.

> **Important**: This app is a consumer of tour-data-api. It must NOT create AWS resources directly. All data operations must go through the tour-data-api REST API.

## Backend Integration Rules

### API Endpoints
- All API endpoints are defined in tour-data-api
- Use the service layer pattern from tour-mgmt-app (src/services/api/)
- Base URL configured via `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL` environment variable
- All API calls must include JWT token in Authorization header

### Data Storage
- **Profile data**: Stored in tour-data-api RiderProfile table (shared across tours)
- **Tour enrollment**: Stored in tour-data-api TourRider-{tourId} table
- **Check-ins**: Stored in tour-data-api CheckIn-{tourId} table
- **User authentication**: Managed by AWS Cognito (same user pool as tour-mgmt-app)
- **Local cache**: SQLite for offline support (tour data, ride info, notifications)

### Backend Extensions
If new features require backend changes:
1. Document the required API endpoints in docs/Requirements.md
2. Specify the data model changes needed
3. Follow tour-data-api design patterns (Lambda + DynamoDB)
4. Submit requirements to tour-data-api team
5. Do NOT implement backend changes in this repository

## Library and Package Usage

- Use only well-known and widely accepted libraries and packages.
- Libraries used in the project must be open source and free to use. No paid or proprietary libraries are allowed.
- Do not use any obscure or less known libraries without prior approval.
- Always prefer libraries that are actively maintained and have good community support.
- Ensure compatibility of libraries with React Native and AWS Amplify.
- Ensure compatibility with Expo managed workflow.
- Ensure compatibility with both iOS and Android platforms. If not possible, flag it and suggest alternatives.
- Keep the number of external dependencies to a minimum to reduce bundle size and potential security vulnerabilities.
- **Use the exact same versions as tour-mgmt-app** for shared dependencies (React Native, Expo SDK, Amplify, etc.)

> Web version is a simplified version of the mobile app with limited features. Primarily for viewing tour dashboard and profile.

## Coding Standards and Best Practices

- Strictly follow security best practices for mobile and web applications.
- Data protection and user privacy must be prioritized.
- Optimize performance for mobile devices, including efficient state management and minimizing re-renders.
- Follow standard coding conventions for TypeScript.
- Use environment variables for sensitive information and configuration settings.
- No hardcoding of any credentials, URLs, or configuration values directly in the codebase.
- Styling should not be inline. Use StyleSheet.create() for React Native styling.
- Ensure proper error handling and logging throughout the application.
- Use ESLint for code linting (follow tour-mgmt-app ESLint configuration).
- Always run linting to ensure code quality before compilation and deployment.
- Write unit tests for critical components and functions (follow tour-mgmt-app test patterns).
- Document code with JSDoc comments where necessary.
- Follow best practices for AWS Amplify Auth integration (refer to tour-mgmt-app).
- Ensure accessibility standards are met for both mobile and web applications.

### Additional Guidelines

- Use functional components and React Hooks in React Native (no class components).
- Ensure code is modular and reusable.
- Follow RESTful API consumption patterns.
- Use the centralized logger utility (src/utils/logger.ts) — do NOT use console.log directly.

### Logging Standards

- **ALWAYS** use the centralized logger from src/utils/logger.ts
- **NEVER** use console.log, console.warn, console.error directly in application code
- Follow the logging pattern from tour-mgmt-app:
  ```typescript
  import { logger } from '../utils/logger';

  logger.info('ComponentName', 'Action description', { data });
  logger.error('ComponentName', 'Error description', error);
  ```
- Log levels: DEBUG, INFO, WARN, ERROR
- Configure log level via EXPO_PUBLIC_LOG_LEVEL environment variable

### AWS Cost Management

- Always look for free tier options and optimize resource usage.
- This app does NOT create AWS resources — all resources managed by tour-data-api.
- Minimize API calls through efficient caching and data management.
- Use SQLite caching to reduce redundant API calls.

### Offline Support

- Mobile App must have ability to work in offline mode for viewing features.
- When offline, display cached data from SQLite.
- Self-service actions (Not Riding, Quit Riding) require online connectivity.
- Show clear offline indicator when network is unavailable.
- Background sync updates cache when connectivity is restored.

## User Types and Access Control

This app has 2 user types (NOT roles like tour-mgmt-app):

### General Rider
- Registered in the app but not enrolled in any tour
- Can browse available tours
- Can submit tour registration requests
- Can manage profile
- Cannot access tour-specific features

### Registered Rider
- Enrolled in a specific tour (approved by organizer)
- Can access tour dashboard
- Can view daily check-in status
- Can receive tour notifications
- Can use self-service features (Not Riding, Quit Riding)
- Can view tour ride schedules

**Implementation Notes:**
- User type determined by enrollment status in TourContext
- Navigation and feature access based on enrollment status
- No RBAC required (unlike tour-mgmt-app which has 5 roles)

## Self-Service Features

### Not Riding
- Rider marks themselves as "Not Riding" for the current ride
- Business rule: Can only be set before any check-ins for the ride
- Once set, rider cannot check in at any stages for that ride
- Applies to current ride only (rider can participate in next ride)
- Implementation: POST to tour-data-api check-in endpoint with type "Not Riding"

### Quit Riding
- Rider ends participation in the entire tour
- Business rule: Requires double confirmation (irreversible via app)
- Once set, rider cannot check in at any future stages or rides
- Rider can still view historical data
- Implementation: POST to tour-data-api check-in endpoint with type "Quit Riding"
- Optional: Include reason and location

## Do's and Don'ts

### Do's
- Follow tour-mgmt-app patterns for authentication, API calls, and database
- Use TypeScript strict mode
- Type all props, state, and function parameters
- Use the centralized logger utility
- Cache data in SQLite for offline support
- Show loading states and error messages
- Validate user input
- Handle network errors gracefully
- Test on both iOS and Android

### Don'ts
- Do not install Expo CLI globally — use npx/npm exec to run Expo CLI commands
- Do not use console.log — use the logger utility
- Do not create AWS resources in this app — all resources managed by tour-data-api
- Do not use inline styles — use StyleSheet.create()
- Do not use class components — use functional components with hooks
- Do not hardcode API URLs or credentials — use environment variables
- Do not deviate from tour-data-api data models
- Do not implement features not specified in Requirements.md
- Do not use GraphQL or AppSync — use REST API via tour-data-api
- Do not directly access DynamoDB — use tour-data-api endpoints

## Environment Variables

All environment variables must use the `EXPO_PUBLIC_` prefix:

```
EXPO_PUBLIC_AWS_USER_POOL_ID=<cognito-user-pool-id>
EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=<cognito-client-id>
EXPO_PUBLIC_AWS_IDENTITY_POOL_ID=<cognito-identity-pool-id>
EXPO_PUBLIC_TOUR_DATA_API_BASE_URL=<api-base-url>
EXPO_PUBLIC_LOG_LEVEL=DEBUG|INFO|WARN|ERROR|NONE
```

## Development Workflow

1. **Before starting any feature**:
   - Read the relevant section in Requirements.md
   - Check SolutionDesign.md for architecture guidance
   - Review tour-mgmt-app implementation for similar features
   - Understand the tour-data-api endpoints needed

2. **During development**:
   - Follow project-structure.md for file placement
   - Use TypeScript strict typing
   - Implement using functional components and hooks
   - Add logging using the logger utility
   - Handle errors gracefully
   - Test on mobile (iOS/Android) and web if applicable

3. **Before committing**:
   - Run `npm run lint` and fix all issues
   - Test on at least one mobile platform
   - Verify environment variables are not hardcoded
   - Check that all imports are correctly organized

## Testing Guidelines

When implementing tests (future):
- Follow tour-mgmt-app testing patterns
- Test critical business logic (API calls, data transformations)
- Test custom hooks
- Test utility functions
- Use Jest and React Native Testing Library
- Place tests alongside source files or in tests/ directory

---

For detailed requirements, architecture, and implementation guidelines, always refer to the documentation in the /docs folder.
