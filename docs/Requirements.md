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
- Can manage their rider profile
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

> **Important**: All AWS resources — including Cognito User Pools — must be part of the tour organizer's subscription. Nothing is shared across organizers. Each organizer has their own Cognito User Pool for their riders, provisioned as part of their subscription setup.

### Sign-Up Flow
1. Rider receives an invitation code from a tour organizer
2. Rider enters the invitation code in the app
3. App validates the code via tour-data-api and retrieves the organizer's Cognito pool configuration
4. App dynamically configures authentication with the organizer's Cognito User Pool
5. Rider provides email, password, and basic profile information
6. App validates input and creates account in the organizer's Cognito User Pool
7. Verification code sent to email
8. Rider verifies email to activate account
9. Profile data stored in tour-data-api RiderProfile table (within organizer scope)
10. Rider can now log in and access the app

> See [Sign-Up Approach Design](design-signup-approach.md) for detailed design including invitation-based sign-up, bot protection, and multi-organizer support.

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

Tour registration follows the organizer's chosen model. Two models are supported:

#### Model 1: Pre-Registration (Primary)

In this model, participation is by pre-registration. Only approved riders can be registered or are registered by the tour organizer. Pre-registration represents an "interest to participate in a tour". Based on organizer-defined criteria, the tour organizer reviews and approves entries.

- Riders who are signed up or provided access to the app by the organizer (or via subscription) can use non-tour features in the app (profile management, etc.)
- Tour organizer manages rider enrollment via the Check-In App (tour-mgmt-app)
- Upon approval, riders become "Registered Riders" for that tour

#### Model 2: Browse and Register (Future — Not Enabled)

> **Note**: This model requires additional workflow support in tour-mgmt-app and is **not enabled** in the current version.

In this model, riders can browse available tours and submit registration requests directly through the app. This requires the tour-mgmt-app to implement a registration approval workflow, which is not currently available.

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
  - **Red**: Quit Riding status (ended current ride midway)
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

**Business Rule**: A rider who starts a ride but decides to stop midway (e.g., injury, mechanical issue, fatigue) can mark themselves as "Quit Riding" for the current ride. This ends their participation in that ride only — the rider can participate in the next ride.

#### Quit Riding Process
1. Rider navigates to Tour Dashboard
2. Selects "Quit Riding" option for today's ride
3. App shows confirmation dialog:
   - "Are you sure you want to quit the current ride?"
   - "You will not be able to check in at any remaining stages for this ride."
4. Rider must confirm twice (prevent accidental activation)
5. Optional: Rider can provide reason for quitting the ride
6. App sends Quit Riding check-in to tour-data-api
7. Rider's status updated to "Quit Riding" for the current ride
8. Dashboard updated to reflect Quit Riding status
9. Tour organizers notified for support vehicle dispatch if needed

#### Quit Riding Rules
- Can be set during an active ride (after the ride has started)
- Ends participation for the current ride only, not the entire tour
- Once set, rider cannot check in at remaining stages for that ride
- Does not affect future rides (rider can participate normally in the next ride)
- Rider's status automatically resets for the next ride
- Rider remains in tour data for historical/statistical purposes

#### Quit Riding Display
- Tour Dashboard shows "Quit Riding - [Ride Name]" status
- Check-in progress shows red "QR" indicator for remaining stages
- Historical view shows Quit Riding days in rider's history

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

> **Principle**: All AWS resources must be part of the organizer's subscription. Nothing is shared across organizers.

- **User authentication**: Managed by AWS Cognito — each tour organizer has their own dedicated Cognito User Pool for riders, provisioned as part of their subscription. Riders in different organizer pools are completely isolated.
- **Profile data**: Stored in tour-data-api `RiderProfile` table (within organizer scope)
- **Tour enrollment**: Stored in tour-data-api `TourRider-{tourId}` table
- **Check-ins**: Stored in tour-data-api `CheckIn-{tourId}` table
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
