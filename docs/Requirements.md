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
- Rider profile fields are fully configuration-driven from `GET /v1/config`
- The rider app uses only enabled `RIDER_PROFILE_SECTION`, `RIDER_PROFILE_ATTRIBUTE`, and `LOV` entries for the current signed-in session
- The active `definitionsVersion` comes from the server response (`GET /v1/config`), and if that response does not include one yet, the app falls back to the `definitionsVersion` returned by the rider profile response
- The current contract is defined in `kvijay77-in/tour-data-api/docs/rider-profile-attributes-design.md`
- Riders must complete a profile after account verification and first authenticated sign-in
- App access is gated only by required **system** profile attributes, so adding a new non-system required field does not block existing riders until their next save
- Profile creation shows enabled rider-editable attributes, grouped and ordered by section configuration
- Required fields are enforced on save
- Admin-only attributes are never rider-editable
- Disabled or unknown attributes are never shown, even if legacy values still exist in backend storage
- Removed attributes are not cleaned up automatically; unsent stored values are retained by backend merge behavior
- Seeded fields continue to be provided through configuration, including:
  - Name
  - Email address (read-only, derived from Cognito)
  - Phone number, entered as a searchable country dialing code and local number
  - Emergency contact object (Name, relationship, and phone number with searchable country dialing code)
  - Date of birth
  - Gender
  - Address object (`Line 1`, `City`, `State`, `Country`, and `Postal Code` are required; `Line 2` is optional)
  - Personal code (read-only, organizer-managed)
  - Profile photo
  - Dietary preference, blood group, medical-condition flags, and other configured attributes
- Country/state and other select options come only from configured LOV items; the app does not replace them with built-in lists
- Country defaults come from the configured attribute or sub-field `defaultValue`, and otherwise use the first configured COUNTRY LOV item by order
- When a dependent state/province LOV has no child entries, the field falls back to free text when configured
- When loading existing profiles, stored select values are matched by configured value or label (case-insensitive); unmatched legacy values are kept and shown as raw text instead of being dropped

### Profile Picture
- Riders must upload a profile picture during profile creation when the configured `PROFILE_PHOTO` attribute is required and may replace it later from profile settings
- Supported formats: JPEG, PNG
- Maximum file size: 5MB
- Image upload flow:
  - App requests a pre-signed upload URL from `POST /v1/riders/profile/{profileId}/picture`
  - App uploads raw image bytes with `PUT` to the pre-signed URL
  - App updates rider profile with returned `photoS3Key` via profile update endpoint
- Other configured `FILE` and `IMAGE` attributes use the profile attribute upload/download endpoints
- For configured `IMAGE` and `FILE` attributes, the app validates `allowedMimeTypes` and `maxFileSizeBytes` before upload, requests a presigned upload URL with both `contentType` and `sizeBytes`, uploads the binary with `PUT`, and stores `{ s3Key, fileName, contentType, sizeBytes, uploadedAt }` under `attributes.<key>`
- The current build supports inline uploads for `IMAGE` attributes via `expo-image-picker`; `FILE` attributes support view/download, but file picking remains unavailable until a document-picker dependency is added
- Default placeholder avatar shown if no picture uploaded

### Profile Management
- At sign-in, the app refreshes profile definitions alongside the active-tour snapshot refresh and caches the definitions locally for the session
- If the config refresh fails, the app uses the last stored copy; if no stored copy exists, the profile screens show an error state with retry
- Riders can view their complete enabled profile after login
- Riders can edit rider-editable profile details while admin-only fields remain read-only
- Sensitive attributes are shown normally to the rider because they are viewing their own data
- Profile changes sync to tour-data-api backend
- Save requests include only changed CORE fields, changed dynamic `attributes`, and the active `definitionsVersion`
- The profile photo update path sends only `photoS3Key` plus the server-sourced `definitionsVersion`
- On `PROFILE_DEFINITIONS_CHANGED`, the app reloads definitions, preserves entered values for surviving keys, and prompts the rider to review and save again
- Profile data persists across tours within the organizer's data infrastructure
- On successful profile update, app displays a temporary success banner

## Authentication & Authorization

> **Important**: All AWS resources and data must be part of the tour organizer's subscription. Nothing is shared across organizers at any level. Each organizer has their own Cognito User Pool, DynamoDB tables, S3 buckets, API infrastructure, and Lambda functions — all provisioned as part of their subscription setup. Rider profiles, invitation data, tour data, and check-in data are completely isolated per organizer.

### App Packaging Modes

The app supports two packaging modes to accommodate different deployment scenarios:

#### Single Subscription Mode (Default for Individual Operators)

In this mode, the app is tied to a specific organizer's subscription at build time:

**Sign-Up Flow:**
1. Rider opens the app (no invitation code needed)
2. Rider directly accesses sign-up screen
3. Rider provides email and password only
4. App creates account in the pre-configured organizer's Cognito User Pool
5. Verification code sent to email
6. Rider verifies email to activate account
7. App auto-signs in the rider
8. App links Cognito `sub` to rider profile identity using `POST /v1/riders/link/{cognitoUserName}`
9. Rider is routed to profile creation to complete required profile details

**Login Flow:**
1. Rider enters email and password
2. App authenticates via AWS Amplify Auth SDK → pre-configured Cognito User Pool
3. Cognito returns JWT tokens (ID token, Access token, Refresh token)
4. App optionally stores remembered credentials in expo-secure-store when Remember Me is enabled
5. App resolves linked `profileId` using `GET /v1/riders/link/{cognitoUserName}` (Cognito `sub`)
6. JWT token included in all API requests to the organizer's tour-data-api instance
7. Rider navigated to appropriate home screen based on tour enrollment status

**Configuration:**
- Organizer details (Cognito pool, API URL) embedded at build time
- Set via `EXPO_PUBLIC_SUBSCRIPTION_MODE=single` environment variable
- `EXPO_PUBLIC_ORGANIZER_ID` and `EXPO_PUBLIC_ORGANIZER_NAME` are optional labels/logging metadata only
- See [Subscription Packaging Guide](subscription-packaging-guide.md) for setup

#### Multi Subscription Mode (Future SaaS Extension)

In this mode, the app supports multiple organizers via invitation-based sign-up:

**Sign-Up Flow:**
1. Rider receives an invitation code from a tour organizer
2. Rider enters the invitation code in the app
3. App validates the code via tour-data-api and retrieves the organizer's Cognito pool configuration
4. App dynamically configures authentication with the organizer's Cognito User Pool
5. Rider provides email and password
6. App validates input and creates account in the organizer's Cognito User Pool
7. Verification code sent to email
8. Rider verifies email to activate account
9. App auto-signs in rider and links Cognito `sub` to rider profile identity
10. Rider completes profile creation after authentication

**Configuration:**
- Set via `EXPO_PUBLIC_SUBSCRIPTION_MODE=multi` only for a future SaaS deployment
- Requires invitation code validation implementation
- See [Sign-Up Approach Design](design-signup-approach.md) for detailed design

> **Note**: Single subscription mode is the default and recommended approach for dedicated organizer builds. Multi subscription mode is a future extension for SaaS platforms that serve multiple organizers with a single app deployment.

### Password Reset
- Rider can initiate password reset from login screen
- Reset code sent to registered email
- Rider enters code and new password
- Password updated in Cognito

### Change Password
- Authenticated rider can change password from the in-app Change Password screen
- Rider provides current password and new password
- Password updated in Cognito via Amplify Auth SDK

### Logout
- Clear authentication tokens from secure storage
- Navigate back to login screen
- Clear the sign-in-refreshed active tour cache from local storage
- Clear the locally cached rider profile definitions copy

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

- When the authenticated rider reaches the home/dashboard flow and a rider profile exists, the app must refresh the current active tour snapshot once for that sign-in.
- The active snapshot refresh must fetch the active tour and the active tour ride list, replace any previously cached active snapshot in SQLite, and serve subsequent active-tour reads from that local cache until the rider explicitly refreshes or signs in again.

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

### Tour Ride Plan View

The app provides a dedicated Tour page in the authenticated menu for viewing ride plans of the active tour.

#### Tour Page Features
- Reads the active tour and active ride list from the SQLite-backed active snapshot populated during sign-in
- Pull-to-refresh refreshes the active snapshot from `GET /v1/tours/active` plus `GET /v1/tours/{tourId}/rides`, replaces the cached active snapshot, and then serves the updated data locally
- Shows each ride's date, route summary, distance, and stage count
- Historical tours and their rides continue using the separate long-lived historical cache

#### Ride Details Features
- Rider can open a ride details page by selecting any ride from the Tour page
- Ride details are fetched from `GET /v1/tours/{tourId}/rides/{rideId}`
- Screen displays route, distance, status, flag-off time (if available), and stage list

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

### App Navigation Menu

Authenticated users navigate through a side drawer menu (hamburger menu) with the following entries:
- Home
- View Profile
- Training Challenge
- Tour
- Change Password
- Sign Out

Sign Out is presented as an explicit drawer action and ends the current authenticated session.

### Home Screen Layout

Home uses a three-row layout for authenticated riders:
- Row 1 (30%): profile summary card with photo, name, email, and phone; tapping opens View Profile
- Row 2 (20%): two cards side-by-side for Training Challenge and Tour
- Row 3 (50%): Announcements/News placeholder with "Under Construction" state

If Home is opened after profile creation, the screen shows a temporary success banner.

### Training Challenge

Training Challenge is currently a placeholder page and displays "Coming soon...." with a themed image.

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

Each tour organizer has their own dedicated tour-data-api deployment (API Gateway, Lambda, DynamoDB, S3) as part of their subscription. The entire backend ecosystem is subscription-specific — there is no shared or central tour-data-api instance. This app connects to the organizer's own tour-data-api instance, with the API base URL resolved dynamically from the organizer context.

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/config` | Refresh configuration-driven rider profile definitions and LOVs |
| `POST /v1/riders/profile` | Create rider profile during sign-up |
| `POST /v1/riders/link/{cognitoUserName}` | Link Cognito user (`sub`) to rider profile |
| `GET /v1/riders/link/{cognitoUserName}` | Resolve linked profileId for Cognito user (`sub`) |
| `DELETE /v1/riders/link/{cognitoUserName}` | Remove link between Cognito user (`sub`) and rider profile |
| `GET /v1/riders/profile/{profileId}` | Get rider profile |
| `PUT /v1/riders/profile/{profileId}` | Update rider profile |
| `POST /v1/riders/profile/{profileId}/picture` | Request pre-signed profile picture upload URL |
| `POST /v1/riders/profile/{profileId}/attributes/{key}/upload` | Request pre-signed upload URL for a configured file/image attribute |
| `GET /v1/riders/profile/{profileId}/attributes/{key}/download` | Request pre-signed download URL for a configured file/image attribute |
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
4. **Profile Creation With Existing Link**: `POST /v1/riders/profile` should accept optional `profileId` in request body for pre-linked users
5. **Profile Link Lookup**: `GET /v1/riders/link/{cognitoUserName}` endpoint is required to resolve `profileId` from Cognito `sub` on returning logins

> **Note**: Any new backend requirements should be documented and submitted to the tour-data-api team for implementation. The tour-rider-app should not deviate from tour-data-api design patterns.

### Data Storage Rules

> **Principle**: All AWS resources and data must be part of the organizer's subscription. Nothing is shared across organizers at any level. Each organizer has a completely isolated environment.

- **User authentication**: Managed by AWS Cognito — each tour organizer has their own dedicated Cognito User Pool for riders, provisioned as part of their subscription. Riders in different organizer pools are completely isolated.
- **Profile data**: Stored in the organizer's `RiderProfile` DynamoDB table (within organizer's data infrastructure)
- **Tour enrollment**: Stored in the organizer's `TourRider-{tourId}` DynamoDB table
- **Check-ins**: Stored in the organizer's `CheckIn-{tourId}` DynamoDB table
- **Notifications**: Stored in the organizer's infrastructure (table: `Notification-{tourId}`)
- **Profile pictures**: Stored in the organizer's S3 bucket via tour-data-api upload endpoint
- **Invitations**: Stored in the organizer's `Invitation` DynamoDB table

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
