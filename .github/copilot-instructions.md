# Instructions for GitHub Copilot for the Project

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

## Technology Stack and Design Considerations
- Platform: Mobile (iOS and Android) and Web
- Programming Languages: Node.js, JavaScript, TypeScript
- Frameworks/Libraries: React Native, Expo CLI, AWS Amplify
- Backend Services - Standard: AWS Amplify (Authentication, API, Storage)
- Backend Services - from the App platform: tour-data-api (REST API)
- Storage: AWS DynamoDB, AWS S3, SQLite (for offline support)  
- Authentication: AWS Cognito via AWS Amplify Auth SDK
- API: AWS AppSync (GraphQL), API Gateway (HTTP REST API)
- AWS Lambda for serverless functions  

### Design Considerations
- The mobile app should be built using React Native with Expo managed workflow for ease of development and deployment.
- The backend should not rely entirely on AWS Amplify services for API and storage since they have limitations. Use AWS AppSync and DynamoDB directly where necessary.
- Use AWS Cognito via AWS Amplify for user authentication and management. 
- Create API using AWS AppSync with GraphQL for efficient data querying and manipulation independent of the client platform.
- For reusable business logic, use AWS Lambda functions.
- Ensure the application is responsive and works well on various screen sizes and orientations for mobile devices.
- Details of resources created externally will be provided as needed. If not provided, ask for details.
- API calls use fetch (built-in) with a custom apiClient wrapper.
- Details of AWS resources (Cognito User Pool, API URL) will be provided via environment variables.
- DynamoDB tables are created and managed by the tour-data-api backend. This app only consumes the API.
- No offline support is required.

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
- Use SQLite caching to reduce redundant API calls.

# Do's and Don'ts
Some specific or explicit instructions that must be followed. Same will be updated here if not covered above.  

## Do's

## Don'ts
- Do not install Expo CLI globally as this is deprecated. Use npx/npm exec to run Expo CLI commands.
