# Initial Development Planning - Summary

**Date**: March 15, 2026
**Author**: Claude (AI Assistant)
**Purpose**: Document the design and approach for initial development of the Tour Rider App

---

## Overview

This document summarizes the initial development planning work completed for the Tour Rider App, a mobile and web application for cycling tour riders to manage their tour participation, track progress, and access self-service features.

## What Was Accomplished

### 1. Comprehensive Requirements Documentation

**File**: `docs/Requirements.md` (433 lines)

Created detailed functional requirements covering:
- User types (General Riders vs Registered Riders)
- Rider profile management (creation, picture upload, editing)
- Authentication & authorization (sign-up, login, password reset, session management)
- Tour features (registration, dashboard, daily check-in information, notifications)
- Self-service features (Not Riding, Quit Riding with detailed business rules)
- General rider features (settings, help, history)
- Offline capability (what works offline vs online-only)
- Backend integration (API endpoints, data storage rules)
- Non-functional requirements (performance, security, usability)

### 2. Solution Design Documentation

**File**: `docs/SolutionDesign.md` (538 lines)

Documented architecture and technical decisions:
- Design principles (common codebase, no direct AWS access, follow tour-mgmt-app patterns)
- Technology stack (exact same as tour-mgmt-app: React Native, Expo, TypeScript, Amplify Auth)
- Application architecture (layer responsibilities, data flow)
- Component architecture (screens, reusable components, guidelines)
- State management (Context providers: Auth, Rider, Tour)
- Authentication (Cognito integration, token management)
- Backend integration (API service layer, data flow: API → SQLite → UI)
- Offline architecture (SQLite caching, sync service)
- Navigation structure (Auth vs Main navigators)
- Styling strategy (color system, guidelines)
- Logging (centralized logger, levels, configuration)
- Platform considerations (mobile vs web)

### 3. Project Structure Documentation

**File**: `docs/project-structure.md` (301 lines)

Established folder organization:
- Complete directory tree structure
- Detailed folder descriptions
- File naming conventions
- Import organization guidelines
- Code organization principles
- Testing structure (for future)

### 4. Development Guide

**File**: `docs/development-guide.md` (290 lines)

Created developer onboarding guide:
- Prerequisites (Node.js, Expo Go, platform requirements)
- Initial setup (clone, install, verify)
- Environment configuration (AWS credentials, API URL)
- Running the app (mobile, simulator, web)
- Development workflow (branching, testing, linting, committing)
- Code quality standards
- Troubleshooting common issues
- Useful commands reference

### 5. Documentation Index

**File**: `docs/docs-index.md` (62 lines)

Navigation hub for all documentation with:
- Document descriptions
- Quick navigation guides (for developers, features, backend, architecture)
- External resources links

### 6. Updated README

**File**: `README.md` (232 lines)

Comprehensive project overview:
- Feature highlights
- Architecture diagram
- Technology stack
- Key features by category
- Getting started guide
- Security measures
- Documentation links
- Related projects

### 7. Copilot/Claude Instructions

**File**: `.github/copilot-instructions.md` (271 lines)

AI assistant guidelines covering:
- Primary instructions (follow docs, requirements, design)
- Reference applications (tour-mgmt-app, tour-data-api)
- Technology stack and design considerations
- Backend integration rules
- Library and package usage
- Coding standards and best practices
- Logging standards
- User types and access control
- Self-service features implementation
- Do's and Don'ts
- Environment variables
- Development workflow
- Testing guidelines

### 8. Environment Configuration Template

**File**: `.env.example`

Template for environment variables:
- AWS Cognito configuration
- API base URL
- Log level

---

## Documentation Format Compliance

All documentation follows the **exact format** used in:
- **tour-mgmt-app** (Check-In App) - for structure, style, and content patterns
- **tour-data-api** - for backend integration guidance

### Key Format Elements Followed:

1. **Markdown structure** with navigation links
2. **Table of contents** for long documents
3. **Consistent heading levels** and formatting
4. **Code blocks** with language specifications
5. **Tables** for structured information
6. **Diagrams** using ASCII art for architecture
7. **Back to README** links for navigation
8. **Related documentation** sections

---

## Key Design Decisions

### 1. Technology Stack

**Decision**: Use the exact same stack as tour-mgmt-app (Check-In App)

**Reasoning**:
- Ensures consistency across applications
- Enables knowledge sharing between teams
- Allows for potential code reuse
- Reduces learning curve for developers working on both apps

**Stack**:
- React Native 0.81.x + Expo SDK 54
- TypeScript ~5.x
- AWS Amplify Auth 6.x for Cognito
- expo-sqlite for offline caching
- React Navigation 7.x
- fetch for API calls

### 2. Backend Integration

**Decision**: Use tour-data-api REST API exclusively (no direct AWS access)

**Reasoning**:
- Enforces security best practices
- Centralizes business logic in backend
- Simplifies frontend code
- Enables backend to enforce data integrity and business rules

**Approach**:
- All data operations via tour-data-api endpoints
- JWT token authentication
- Service layer pattern (src/services/api/)
- SQLite caching for offline support

### 3. User Types

**Decision**: Two user types (General Rider, Registered Rider) instead of RBAC roles

**Reasoning**:
- Simpler than tour-mgmt-app's 5-role RBAC system
- User type based on tour enrollment status
- Clear distinction between enrolled and non-enrolled users
- Easier to implement and maintain

### 4. Offline Support

**Decision**: Read-only offline mode with SQLite caching

**Reasoning**:
- Riders need to view tour info in areas with limited connectivity
- Self-service actions (Not Riding, Quit Riding) are critical and should require confirmation from backend
- Simpler conflict resolution (server is source of truth)
- Reduces complexity compared to tour-mgmt-app's full offline check-in capability

### 5. Authentication

**Decision**: Share Cognito User Pool with tour-mgmt-app and tour-data-api

**Reasoning**:
- Single user identity across all applications
- Simplified user management
- Riders and staff in same pool, differentiated by groups
- Consistent authentication experience

---

## Backend Requirements

### Existing tour-data-api Endpoints to Use

The following endpoints are already available in tour-data-api:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/riders/profile/{profileId}` | GET, PUT | Rider profile operations |
| `/v1/tours` | GET | List available tours |
| `/v1/tours/{tourId}` | GET | Get tour details |
| `/v1/tours/{tourId}/riders/{riderId}` | GET | Get tour rider details |
| `/v1/tours/{tourId}/rides/today` | GET | Get today's ride |
| `/v1/tours/{tourId}/rides/{rideId}/checkins` | GET | Get rider's check-ins |
| `/v1/tours/{tourId}/checkins` | POST | Create check-in (for Not Riding, Quit Riding) |

### Backend Extensions Required

The following features will require new tour-data-api endpoints:

1. **Rider-Initiated Tour Registration**
   - Endpoint: `POST /v1/tours/{tourId}/riders` (registration request)
   - Purpose: Allow riders to submit tour registration requests
   - Note: Approval process handled by tour organizers via Check-In App

2. **Notifications System**
   - Endpoints:
     - `GET /v1/tours/{tourId}/notifications` (list notifications)
     - `POST /v1/tours/{tourId}/notifications` (create - admin only)
     - `PUT /v1/tours/{tourId}/notifications/{notificationId}` (mark as read)
   - Storage: New table `Notification-{tourId}`
   - Purpose: Tour organizers send announcements, updates, alerts to riders

3. **Rider Statistics**
   - Endpoint: `GET /v1/tours/{tourId}/riders/{riderId}/statistics`
   - Purpose: Aggregated stats (rides completed, streak, total distance)
   - Note: May be computed on-demand from existing check-in data

4. **Profile Picture Upload**
   - Endpoint: `POST /v1/riders/profile/{profileId}/picture`
   - Storage: S3 bucket with URL stored in RiderProfile table
   - Purpose: Allow riders to upload profile pictures

**Action Required**: Submit these backend requirements to the tour-data-api team with detailed specifications.

---

## Next Steps for Development

### Phase 1: Project Setup (Immediate)

1. **Initialize React Native/Expo Project**
   - Run `npx create-expo-app` or copy structure from tour-mgmt-app
   - Install dependencies (match versions from tour-mgmt-app)
   - Configure TypeScript
   - Set up ESLint
   - Create folder structure as per `docs/project-structure.md`

2. **Configure AWS Amplify**
   - Set up Amplify Auth (copy from tour-mgmt-app)
   - Configure Cognito user pool (same as tour-mgmt-app)
   - Create `.env` file from `.env.example`
   - Test authentication flow

3. **Create Base Infrastructure**
   - Implement centralized logger (`src/utils/logger.ts`)
   - Create API client wrapper (`src/services/api/apiClient.ts`)
   - Set up SQLite database (`src/services/database/database.ts`)
   - Implement navigation structure

### Phase 2: Authentication & Profile (Week 1-2)

1. **Authentication Screens**
   - LoginScreen
   - SignUpScreen (with profile creation)
   - ForgotPasswordScreen

2. **Rider Profile Management**
   - Profile creation during sign-up
   - Profile viewing and editing
   - Profile picture upload (requires backend endpoint)

3. **Context Providers**
   - AuthContext (authentication state)
   - RiderContext (profile data)

### Phase 3: Tour Features (Week 3-4)

1. **Tour Browsing & Registration**
   - TourListScreen (browse available tours)
   - TourDetailsScreen (view tour information)
   - TourRegistrationScreen (submit registration request)
   - TourContext (enrollment status)

2. **Tour Dashboard (Registered Riders)**
   - TourDashboardScreen (current tour overview)
   - Today's ride summary
   - Personal statistics
   - Quick access navigation

### Phase 4: Check-In & Self-Service (Week 5-6)

1. **Check-In Status**
   - CheckInStatusScreen (daily progress through stages)
   - CheckInHistoryScreen (past rides)
   - Visual stage indicators
   - Color-coded status

2. **Self-Service Features**
   - Not Riding functionality
   - Quit Riding functionality
   - Confirmation dialogs
   - API integration

### Phase 5: Notifications (Week 7)

1. **Notification System**
   - NotificationsScreen (notification center)
   - Push notification setup
   - Badge counts
   - Mark as read/unread
   - (Requires backend notification endpoints)

### Phase 6: Offline Support (Week 8)

1. **SQLite Caching**
   - Database schema implementation
   - Cache tour data, rides, check-ins
   - Background sync service
   - Offline indicator

### Phase 7: Testing & Polish (Week 9-10)

1. **Testing**
   - Unit tests for critical functions
   - Integration tests for API calls
   - UI testing on iOS and Android
   - Web version testing

2. **Polish**
   - Error handling refinement
   - Loading states
   - Empty states
   - Accessibility improvements
   - Performance optimization

---

## Development Team Recommendations

### Skills Required

1. **React Native/Expo** - Core framework knowledge
2. **TypeScript** - Strict typing experience
3. **AWS Amplify Auth** - Cognito integration
4. **REST API Integration** - HTTP client, error handling
5. **SQLite** - Database operations for offline support
6. **React Navigation** - Navigation patterns

### Reference Code

Developers should heavily reference **tour-mgmt-app** for:
- Authentication implementation
- API service layer pattern
- Logger utility
- SQLite setup for offline
- Navigation structure
- TypeScript patterns

### Collaboration with Backend Team

Close collaboration needed with tour-data-api team for:
- New endpoint specifications (notifications, registration)
- Data model alignment
- Business rule clarification
- Testing with real backend

---

## Documentation Maintenance

As development progresses, the following documents should be updated:

1. **development-guide.md** - Expand with actual setup steps once project is initialized
2. **SolutionDesign.md** - Update with any architecture decisions made during implementation
3. **Requirements.md** - Add any new requirements discovered during development
4. **project-structure.md** - Keep synchronized with actual folder structure

---

## Conclusion

The initial development planning for the Tour Rider App is **complete**. All necessary documentation has been created following the format and structure of tour-mgmt-app and tour-data-api.

The app is well-designed to:
- Provide riders with a simple, intuitive interface for tour participation
- Follow the exact same technology stack as tour-mgmt-app for consistency
- Integrate seamlessly with tour-data-api backend
- Support offline viewing of tour data
- Enable self-service features for rider independence

Development can now proceed with confidence, following the documented requirements, architecture, and project structure.

---

**Next Action**: Begin Phase 1 (Project Setup) to initialize the React Native/Expo project and base infrastructure.
