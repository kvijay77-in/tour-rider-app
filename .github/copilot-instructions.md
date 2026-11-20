# Instructions for GitHub Copilot for the Project

_Last updated: 2026-09-29_

## Primary Instructions
These instructions are general for our interaction and MUST BE STRICTLY FOLLOWED.
- Read the relevant topics under /docs/requirements/ before development work.
- Refer to /docs/design/architecture.md and the relevant topic under /docs/design/ for design principles.
- Follow the project structure in /docs/guides/development.md. Flag structural changes for review and, once approved, update that guide.
- Refer to the relevant /docs/requirements/ topic for feature clarifications.
- If any inputs during our interaction contradict the requirement, flag it and ask for clarifications.
- Understand the project requirements and constraints in /docs/requirements/.
- Ensure implementations adhere to the requirements in /docs/requirements/.
- Always follow what was asked, do not suggest or code extra features or changes unless explicitly requested.
- Follow instructions and do not deviate from the task at hand.
- Do not go overboard and keep suggestions concise and relevant.
- Stick to design and instructions.
- Always ask for clarifications if the requirements are ambiguous or incomplete.
- Always prioritize security, performance, and maintainability in code suggestions.
- Always provide brief explanation on any command that you are running or suggesting to run.

## Technology Stack and Design Considerations
- Platform: Mobile (iOS and Android) and Web
- Programming Languages: Node.js, JavaScript, TypeScript
- Frameworks/Libraries: React Native, Expo CLI, AWS Amplify
- Authentication: AWS Cognito via AWS Amplify Auth SDK; rider pool owned by tour-data-api
- API: tour-data-api API Gateway HTTP API (RiderApi), with rider-pool JWT authorizer
- Storage: Backend-managed AWS storage; limited local SQLite caches for profile definitions and tour data

### Design Considerations
- The mobile app should be built using React Native with Expo managed workflow for ease of development and deployment.
- Use AWS Cognito via AWS Amplify Auth for user authentication; the backend manages the pool and all AWS resources.
- Consume the backend HTTP API through the app's apiClient. The backend API contract is at https://github.com/kvijay77-in/tour-data-api/blob/main/docs/design/api-reference.md.
- Use backend permission names from https://github.com/kvijay77-in/tour-data-api/blob/main/src/layers/common/rbac.py.
- Ensure the application is responsive and works well on various screen sizes and orientations for mobile devices.
- Details of resources created externally will be provided as needed. If not provided, ask for details.
- API calls use fetch (built-in) with a custom apiClient wrapper.
- Details of AWS resources (Cognito User Pool, API URL) will be provided via environment variables.
- DynamoDB tables are created and managed by the tour-data-api backend. This app only consumes the API.
- Local caches do not provide an offline feature; app actions require connectivity.

## Library and Package Usage
- Use only well-known and widely accepted libraries and packages.
- Libraries used in the project must be open source and free to use. No paid or proprietary libraries are allowed.
- Do not use any obscure or less known libraries without prior approval.
- Always prefer libraries that are actively maintained and have good community support.
- Ensure compatibility of libraries with React Native and AWS Amplify.
- Ensure compatibility with Expo managed workflow.
- Ensure compatibility with both iOS and Android platforms. If not possible, flag it and suggest alternatives.
- Keep the number of external dependencies to a minimum to reduce bundle size and potential security vulnerabilities.

## Coding Standards and Best Practices
- Strictly follow security best practices for mobile and web applications.
- Data protection and user privacy must be prioritized.
- Optimize performance for mobile devices, including efficient state management and minimizing re-renders.
- Follow standard coding conventions for TypeScript.
- Use environment variables for sensitive information and configuration settings.
- No hardcoding of any credentials, URLs, or configuration values directly in the codebase.
- Styling should not be inline. Use StyleSheet or styled-components for React Native styling.
- Ensure proper error handling and logging throughout the application.
- Use ESLint and Prettier for code formatting and linting.
- Always run linting to ensure code quality before compilation and deployment.
- Write unit tests for critical components and functions.
- Document code with JSDoc comments where necessary.
- Follow best practices for AWS Amplify integration and usage. 
- Ensure accessibility standards are met for mobile apps.

### Additional Guidelines
- Use functional components and React Hooks in React Native (no class components).
- Ensure code is modular and reusable.
- Follow RESTful API consumption patterns.
- Use the centralized logger utility.

### AWS Cost Management

- Always look for free tier options and optimize resource usage.
- This app does NOT create AWS resources — all resources managed by tour-data-api.
- Minimize API calls through efficient caching and data management.
- Use existing SQLite caches only where already supported by the app.

# Do's and Don'ts
Some specific or explicit instructions that must be followed. Same will be updated here if not covered above.  

## Do's
- Create unit test for all critical components and functions.
- Keep tests as lightweight and focused on specific functionality.
- Tests should be updated whenever the related code changes.

## Don'ts
- Do not install Expo CLI globally as this is deprecated. Use npx/npm exec to run Expo CLI commands.
- Do not create UI Tests. It will be done manually.

