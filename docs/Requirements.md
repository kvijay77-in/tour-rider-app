# Requirements

[← Back to README](../README.md)

Detailed functional requirements, use cases, and feature specifications for the Tour Rider App.

## Table of Contents

- [Introduction](#introduction)
- [User Types](#user-types)
- [Rider Profile Management](#rider-profile-management)
- [Authentication & Authorization](#authentication--authorization)
- [Tour Features](#tour-features)
  - [Tour Registration](#tour-registration)
  - [Tour Dashboard](#tour-dashboard)
  - [Daily Check-In Information](#daily-check-in-information)
  - [Tour Notifications](#tour-notifications)
- [Self-Service Features](#self-service-features)
  - [Not Riding](#not-riding)
  - [Quit Riding](#quit-riding)
- [General Rider Features](#general-rider-features)
- [Offline Capability](#offline-capability)
- [Backend Integration](#backend-integration)
- [Non-Functional Requirements](#non-functional-requirements)

---

## Introduction

The Tour Rider App is a mobile and web application designed for cycling tour riders. It enables riders to manage their tour participation, track their daily progress, receive notifications from tour organizers, and access self-service features during active tours.

This app focuses on the **rider experience** and complements the Check-In App (used by tour administrators and staff) by providing riders with visibility into their tour participation and self-service capabilities.

## User Types

The app supports two types of users, collectively referred to as **riders**:

### General Riders
- Users who have registered in the app but are not currently enrolled in any active tour
- Can view general tour information and access non-tour-specific features
- Can browse available tours and submit registration requests
- Have limited access to tour-specific features

### Registered Riders
- Users who have been approved by a tour organizer to participate in a specific tour
- Have full access to tour-specific features including:
  - Daily check-in status and progress tracking
  - Tour notifications from organizers
  - Self-service options (Not Riding, Quit Riding)
  - Tour route and schedule information

> **Important**: A rider becomes a "Registered Rider" only after tour organizer approval. The registration process involves the rider submitting a request, which must be approved through the tour-data-api backend.

## Rider Profile Management

### Profile Creation
- Riders must complete a profile during initial sign-up
- Required profile information:
  - Full name (First name, Last name)
  - Email address (used for authentication)
  - Phone number (for emergency contact and notifications)
  - Emergency contact details (Name, relationship, phone number)
  - Date of birth
  - Gender
  - Address (optional)

### Profile Picture
- Riders can upload a profile picture during sign-up or later from profile settings
- Supported formats: JPEG, PNG
- Maximum file size: 5MB
- Image stored in backend S3 storage via tour-data-api
- Default placeholder avatar shown if no picture uploaded

### Profile Management
- Riders can view their complete profile after login
- Riders can edit profile details (except email, which is the primary identifier)
- Profile changes sync to tour-data-api backend
- Profile data persists across tours in the RiderProfile table

## Authentication & Authorization

### Sign-Up Flow
1. Rider provides email, password, and basic profile information
2. App validates input and creates account via AWS Cognito
3. Verification code sent to email
4. Rider verifies email to activate account
5. Profile data stored in tour-data-api RiderProfile table
6. Rider can now log in and access the app

### Login Flow
1. Rider enters email and password
2. App authenticates via AWS Amplify Auth SDK → Cognito
3. Cognito returns JWT tokens (ID token, Access token, Refresh token)
4. App stores tokens securely via expo-secure-store
5. JWT token included in all API requests to tour-data-api
6. Rider navigated to appropriate home screen based on tour enrollment status

### Password Reset
- Rider can initiate password reset from login screen
- Reset code sent to registered email
- Rider enters code and new password
- Password updated in Cognito

### Logout
- Clear authentication tokens from secure storage
- Navigate back to login screen
- Clear any cached tour data from local storage

### Session Management
- JWT tokens auto-refresh via Amplify SDK
- Session expires after 30 days of inactivity
- On 401 response from API, attempt token refresh once
- If refresh fails, redirect to login screen

## Tour Features

### Tour Registration

#### Browsing Tours
- General riders can browse available tours
- Tour list shows:
  - Tour name and organizer
  - Tour dates (start date, end date)
  - Tour status (PLANNED, ACTIVE, COMPLETED)
  - Tour location/region
  - Number of rides
  - Registration status (Open/Closed)

#### Registration Request
- Rider selects a tour and submits registration request
- Required information for registration:
  - Rider profile details (auto-populated from RiderProfile)
  - Rider ID assigned by organizer (optional, may be assigned later)
  - Cycling experience level (Beginner, Intermediate, Advanced)
  - Medical conditions/allergies (optional but recommended)
  - Special requirements (dietary, accommodation preferences)
- Registration request sent to tour-data-api
- Rider receives confirmation that request is pending approval

#### Registration Approval Process
- Tour organizer reviews registration via Check-In App or admin portal
- Organizer assigns unique Rider ID
- Organizer approves or rejects registration
- Rider receives notification of approval/rejection
- Upon approval, rider becomes a "Registered Rider" for that tour

### Tour Dashboard

The Tour Dashboard is the home screen for registered riders during an active tour.

#### Dashboard Features
- Current tour information banner:
  - Tour name
  - Current day number (e.g., "Day 3 of 7")
  - Today's ride date and name
  - Tour status
- Today's ride summary:
  - Ride route name
  - Start location and time
  - Pit stop locations (if any)
  - Finish location and expected arrival time
  - Total distance
- Personal statistics card:
  - Rides completed
  - Rides not completed (Not Riding days)
  - Current streak
  - Total distance covered
- Quick access to:
  - Daily check-in status
  - Tour notifications
  - Self-service options
  - Tour schedule/calendar

### Daily Check-In Information

Riders can view their check-in status for the current ride in real-time.

#### Check-In Status Display
- Visual indicator showing rider's progress through the day's stages:
  - Start (Flag Off)
  - Pit Stop 1 (if applicable)
  - Pit Stop 2 (if applicable)
  - Finish
- Color-coded status:
  - **Green**: Checked in at stage
  - **Gray**: Not yet checked in
  - **Orange**: Currently at this stage (last check-in)
  - **Red**: Quit Riding status
  - **Blue**: Not Riding for today

#### Check-In Details
- Timestamp for each check-in
- Location where check-in occurred (if available)
- Check-in type (Normal, Not Riding, Quit Riding)
- Stage name

#### Historical Check-Ins
- Riders can view check-in history for previous rides
- Ride selection via calendar or list view
- Read-only view of past check-ins
- Ride summary statistics

### Tour Notifications

Riders receive notifications from tour organizers throughout the tour.

#### Notification Types
- **Tour Announcements**: General information for all riders
- **Ride Updates**: Changes to ride schedule, route, or logistics
- **Safety Alerts**: Weather warnings, road closures, safety information
- **Personal Messages**: Direct messages from organizers to specific riders
- **Check-In Reminders**: Reminders to check in at stages
- **Registration Status**: Approval/rejection notifications

#### Notification Features
- In-app notification center with unread count badge
- Push notifications (if permissions granted)
- Notifications sorted by date (newest first)
- Mark as read/unread
- Notification details view with full message
- Archive old notifications
- Filter by notification type

#### Push Notification Implementation
- Request notification permissions on first app launch
- Device token registered with tour-data-api
- Notifications sent via AWS SNS or similar service
- Notifications work when app is in background or closed
- Notification settings in rider profile

## Self-Service Features

Registered riders can manage their participation status for the current ride using self-service features.

### Not Riding

**Business Rule**: A rider who cannot complete a ride (e.g., illness, injury, or transported via support vehicle) can mark themselves as "Not Riding" for that specific ride.

#### Not Riding Process
1. Rider navigates to Tour Dashboard
2. Selects "Not Riding" option for today's ride
3. App shows confirmation dialog:
   - "Are you sure you want to mark yourself as Not Riding for [Ride Name]?"
   - "You will be transported to the finish location and cannot check in at any stages today."
4. Rider confirms
5. App sends Not Riding check-in to tour-data-api
6. Rider's status updated to "Not Riding" for the current ride
7. Dashboard updated to reflect Not Riding status
8. Tour organizers notified via Check-In App

#### Not Riding Rules
- Can only be set before the rider has checked in at any stage for the current ride
- Once set, rider cannot check in at any stage for that ride
- Only one Not Riding check-in allowed per rider per ride
- Does not affect future rides (rider can participate normally tomorrow)
- Rider's status automatically resets for the next ride

#### Not Riding Display
- Tour Dashboard shows "Not Riding - [Ride Name]" status
- Check-in progress shows blue "NR" indicator for all stages
- Historical view shows Not Riding days in rider's history

### Quit Riding

**Business Rule**: A rider who decides to quit the tour permanently (e.g., injury, personal reasons, cannot continue) can mark themselves as "Quit Riding". This ends their participation in the entire tour.

#### Quit Riding Process
1. Rider navigates to Tour Dashboard
2. Selects "Quit Riding" option
3. App shows strong confirmation dialog:
   - "Are you sure you want to quit the tour?"
   - "This will end your participation in [Tour Name]. You cannot undo this action."
   - "You will need to contact the tour organizer to re-join."
4. Rider must confirm twice (prevent accidental activation)
5. Optional: Rider can provide reason for quitting
6. App sends Quit Riding check-in to tour-data-api
7. Rider's status updated to "Quit Riding" for entire tour
8. Rider can no longer access tour-specific features
9. Tour organizers notified immediately

#### Quit Riding Rules
- Can be set at any time during the tour
- Ends participation for the entire tour, not just the current ride
- Once set, rider cannot check in at any future stages or rides
- Rider remains in tour data for historical/statistical purposes
- Rider status shows as "Quit Riding" in Check-In App dashboard
- Cannot be self-reversed (requires organizer intervention)

#### Post-Quit Access
- Rider can still view historical data (past check-ins, ride history)
- Rider cannot access current ride information or check-in features
- Dashboard shows "Quit Riding - [Tour Name]" message
- Option to contact tour organizer displayed

#### Quit Riding Location
- If rider quits between stages (not at a pit stop), they can specify their current location
- Location info sent to organizers for support vehicle dispatch
- Optional: Rider can share GPS coordinates

## General Rider Features

Features available to all riders, regardless of tour enrollment status:

### App Settings
- Profile management
- Notification preferences
- Language selection (if multi-language supported)
- Units preference (km vs miles)
- Theme selection (light/dark mode)

### Help & Support
- FAQ section
- Contact tour organizer
- App usage guide
- Emergency contact information

### Tour History
- View past tours rider has participated in
- Tour completion status
- Statistics for each completed tour

## Offline Capability

The app should work with limited connectivity, which is common during cycling tours in remote areas.

### Offline Features
- View cached tour information
- View cached daily check-in status
- View cached notifications (already downloaded)
- View rider profile (from local cache)

### Online-Only Features
- Submitting Not Riding or Quit Riding requests
- Receiving new notifications
- Updating profile information
- Browsing/registering for new tours
- Real-time check-in status updates

### Sync Strategy
- App caches tour data, ride information, and notifications locally using SQLite
- When online, app fetches latest data every 5 minutes (configurable)
- When offline, app shows cached data with "Offline" indicator
- When connectivity restored, app syncs local changes to backend
- Conflict resolution: Server data takes precedence for read-only data

## Backend Integration

All rider data must be stored in the tour-data-api backend. This app is a **consumer** of the tour-data-api.

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `POST /v1/riders/profile` | Create rider profile during sign-up |
| `GET /v1/riders/profile/{profileId}` | Get rider profile |
| `PUT /v1/riders/profile/{profileId}` | Update rider profile |
| `GET /v1/tours` | List available tours |
| `GET /v1/tours/{tourId}` | Get tour details |
| `GET /v1/tours/{tourId}/riders/{riderId}` | Get tour rider details (enrollment status) |
| `POST /v1/tours/{tourId}/riders` | Submit tour registration request |
| `GET /v1/tours/{tourId}/rides/today` | Get today's ride |
| `GET /v1/tours/{tourId}/rides/{rideId}/checkins` | Get rider's check-ins for a ride |
| `POST /v1/tours/{tourId}/checkins` | Submit Not Riding or Quit Riding check-in |
| `GET /v1/tours/{tourId}/notifications` | Get tour notifications (requires backend extension) |

### Backend Extensions Required

The tour-data-api may need to be extended to support:
1. **Rider-Initiated Registration**: Endpoint for riders to submit tour registration requests
2. **Notifications System**: Endpoints for creating, listing, and managing rider notifications
3. **Rider Statistics**: Aggregated statistics for rider's tour participation

> **Note**: Any new backend requirements should be documented and submitted to the tour-data-api team for implementation. The tour-rider-app should not deviate from tour-data-api design patterns.

### Data Storage Rules

- **Profile data**: Stored in tour-data-api `RiderProfile` table (shared across tours)
- **Tour enrollment**: Stored in tour-data-api `TourRider-{tourId}` table
- **Check-ins**: Stored in tour-data-api `CheckIn-{tourId}` table
- **User authentication**: Managed by AWS Cognito (same user pool as Check-In App)
- **Notifications**: Stored in tour-data-api (new table required: `Notification-{tourId}`)
- **Profile pictures**: Stored in S3 via tour-data-api upload endpoint

## Non-Functional Requirements

### Performance
- App launch time < 3 seconds on mid-range devices
- API response rendering < 1 second for typical payloads
- Image loading progressive (show placeholder while loading)
- Smooth scrolling at 60 FPS

### Scalability
- Support 100-200 riders per tour
- Handle 10-15 concurrent API requests
- Efficient data caching to minimize API calls

### Security
- All API communication over HTTPS
- JWT tokens stored securely (expo-secure-store on mobile, secure cookies on web)
- No hardcoded credentials or API keys
- Input validation on all forms
- Protection against XSS, injection attacks

### Usability
- Simple, intuitive UI suitable for non-technical users
- Clear error messages and user guidance
- Consistent design language
- Accessibility: support for screen readers, high contrast mode
- Multi-language support (future enhancement)

### Reliability
- Graceful degradation when offline
- Automatic retry on network failures
- Error recovery without data loss
- Session persistence across app restarts

### Compatibility
- iOS 13+ (mobile)
- Android 8+ (mobile)
- Modern web browsers (Chrome, Safari, Firefox, Edge)
- Responsive design for tablets

---

## Related Documentation

- [Solution Design](SolutionDesign.md) — Architecture, technology stack, design principles
- [Development Guide](development-guide.md) — Environment setup, running the app, testing
- [Project Structure](project-structure.md) — Folder organization and code structure

---

[← Back to README](../README.md)
