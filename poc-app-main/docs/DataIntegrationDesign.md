# Data Backend Integration Design

[← Back to README](../README.md)

This document provides the analysis and design for integrating the `tour-data-api` backend with the Check-In App (poc-app) frontend. It must be reviewed and approved before any development work begins.

## Table of Contents

- [1. API Approach Analysis](#1-api-approach-analysis)
- [2. Integration Architecture](#2-integration-architecture)
- [3. Data Model Alignment](#3-data-model-alignment)
- [4. Offline Status](#4-offline-status)
- [5. Environment Configuration](#5-environment-configuration)
- [6. Implementation Phases](#6-implementation-phases)
- [7. Security Considerations](#7-security-considerations)
- [8. Open Questions and Decisions](#8-open-questions-and-decisions)
- [9. Suggested Backend Enhancements](#9-suggested-backend-enhancements-tour-data-api)

---

## 1. API Approach Analysis

### 1.1 Backend Overview

> **Terminology Note:** AWS API Gateway offers two products: **API Gateway HTTP API** (newer, cheaper, lower latency) and **API Gateway REST API** (older, more features, higher cost). The `tour-data-api` backend uses **API Gateway HTTP API**. Throughout this document, "RESTful" refers to the architectural style (resource-based URLs, standard HTTP methods, JSON responses), while "HTTP API" and "REST API" refer to the specific AWS API Gateway product types.

The `tour-data-api` provides a RESTful API built with AWS SAM, Lambda, API Gateway HTTP API, and DynamoDB. Key characteristics:

- **20 Lambda functions** covering tours, riders, rides, check-ins, and users
- **JWT authentication** via AWS Cognito
- **Tour-scoped tables** — each tour has its own set of DynamoDB tables (TourRider, Ride, CheckIn, User)
- **Dashboard endpoint** (`GET /v1/tours/{tourId}/rides/{rideId}/dashboard`) returns a composite response with ride details, all riders with profiles, all check-ins, and summary statistics in a single call
- **Small data volume** — ~100 riders, ~8 rides per tour, ~600 check-ins per ride maximum

### 1.2 Efficiency for Mobile App

**Assessment: The RESTful API approach is efficient and suitable for this mobile app.**

Reasons:

| Aspect | Assessment | Detail |
|--------|-----------|--------|
| **Data Volume** | ✅ Low | ~100 riders, max 600 check-ins per ride. Total dashboard payload estimated at 50-80KB uncompressed |
| **Network Calls** | ✅ Optimised | Dashboard endpoint returns all data in a single call (ride + riders + check-ins + summary), avoiding N+1 queries |
| **Payload Size** | ✅ Acceptable | API returns only needed fields. No bloat from GraphQL type overhead or over-fetching |
| **Latency** | ✅ Acceptable | Lambda cold starts are acceptable for 10-15 concurrent users. API Gateway HTTP API has lower latency than API Gateway REST API |
| **Cost** | ✅ Minimal | API Gateway HTTP API is 70% cheaper than API Gateway REST API. Estimated <$10/month during tour |
| **Offline Support** | ✅ Compatible | Offline status is shown via a simple banner when connectivity is lost |
| **Authentication** | ✅ Standard | JWT tokens from Cognito — standard flow, tokens can be refreshed by Amplify SDK |

**Why RESTful API over GraphQL for this use case:**

1. **Dashboard is the primary view** — the backend already provides a composite dashboard endpoint that returns everything needed. GraphQL's selective querying advantage is minimal here since we need all the data anyway.
2. **Low complexity queries** — most reads are "get all riders," "get all check-ins for ride," "get today's ride." These are simple and don't benefit from GraphQL's flexibility.
3. **Write operations are simple** — check-in creation is a single POST with a fixed payload structure.
4. **Amplify Data (AppSync)** would require redefining the data model in Amplify schema, which contradicts the design principle that DynamoDB tables are managed externally by `tour-data-api`.

**Recommendation:** Use the `tour-data-api` RESTful API directly via `fetch`/HTTP client with JWT authentication from Amplify Auth. No need for AppSync/GraphQL — it would add complexity without benefit for this use case.

### 1.3 Design Principle Compliance

Per `docs/SolutionDesign.md`:
> "Any direct access to AWS Resource access from Mobile App or Web client must not be permitted. Such access must always be through Amplify backend."

**Interpretation:** The app must not access DynamoDB, S3, or other AWS resources directly. Access through the `tour-data-api` (API Gateway HTTP API → Lambda → DynamoDB) satisfies this requirement since the API acts as the intermediary. Amplify Auth will be used for Cognito authentication to obtain JWT tokens.

---

## 2. Integration Architecture

### 2.1 High-Level Flow

```
Mobile/Web App
    ↓
[Amplify Auth (Cognito)]     ← Authentication, token management
    ↓ (JWT token)
[API Service Layer]           ← src/services/api/
    ↓ (HTTP calls with Bearer token)
[tour-data-api]               ← API Gateway HTTP API → Lambda → DynamoDB
```

### 2.2 Service Layer Design

The services layer follows the project structure defined in `docs/project-structure.md`:

```
src/services/
├── api/                    # API client (RESTful HTTP calls)
│   ├── apiClient.ts        # Base HTTP client with auth, error handling, retry
│   ├── tourApi.ts          # Tour endpoints
│   ├── riderApi.ts         # Rider endpoints
│   ├── rideApi.ts          # Ride endpoints
│   ├── checkInApi.ts       # Check-in endpoints
│   ├── dashboardApi.ts     # Dashboard endpoint
│   ├── userApi.ts          # User endpoints
│   └── mockData.ts         # Mock data for dev/demo mode (EXPO_PUBLIC_USE_MOCK_DATA)
└── config/                 # Runtime configuration
    └── orgConfigService.ts # Org config secure storage
```

### 2.3 API Client (`apiClient.ts`)

Responsibilities:
- Base URL configuration from environment variables
- JWT token injection from Amplify Auth session
- Automatic token refresh on 401 responses
- Standardised error handling matching backend error format
- Request retry with exponential backoff (for network failures)
- Request/response logging (non-sensitive data only)

```typescript
// Conceptual interface
interface ApiClient {
  get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>>;
  post<T>(path: string, body: unknown): Promise<ApiResponse<T>>;
  put<T>(path: string, body: unknown): Promise<ApiResponse<T>>;
}
```

The client uses `fetch` (available in React Native) — no additional HTTP library needed.

### 2.4 Tour Context

A `tourId` is required for most API calls. This will be resolved once at app startup:

1. Call `GET /v1/tours/active` to get the current active tour
2. Store `tourId` in app context (React Context)
3. All subsequent API calls use this `tourId`

If no active tour exists, the app shows an appropriate message.

---

## 3. Data Model Alignment

### 3.1 Backend → Frontend Type Mapping

The frontend types in `src/types/models.ts` need updates to align with the backend data model.

#### New Types Needed

| Backend Entity | Frontend Type | Notes |
|---------------|--------------|-------|
| Tour (TourMaster) | `Tour` | New — needed for tour context |
| TourRider | `TourRider` | New — links riderId to profileId |

#### Updated Types

| Frontend Type | Changes Needed |
|--------------|---------------|
| `Rider` | Add `profileId`, `photoS3Key`; remove `qrCodeData` (moved to TourRider) |
| `Ride` | Add `rideNo`, `flagOffTime`, `description`; change status `IN_PROGRESS` → `ACTIVE` |
| `Stage` | Add `location` field |
| `CheckIn` | Replace `status` enum with `isNotRiding`/`isQuitRiding` boolean flags (status is derived); add `stageNumber`; `checkInId` format is `<riderId>#<stageNumber>#<timestamp>` |

#### Key Differences to Note

1. **Check-in status**: Backend does not store a `status` field. Status is derived from `isNotRiding` and `isQuitRiding` flags. The frontend `CheckInStatus` enum remains for UI purposes but the mapping function handles derivation.

2. **Ride status values**: Backend uses `ACTIVE` where frontend currently uses `IN_PROGRESS`. The frontend types should align with the backend (`PLANNED | ACTIVE | COMPLETED | CLOSED`).

3. **Rider ID format**: Backend uses `R1`, `R57` (no zero-padding). Frontend mock data uses `R001`, `R025` (3-digit padded). Frontend should align with backend format.

4. **Tour-scoping**: Backend API paths include `tourId` (e.g., `/v1/tours/{tourId}/rides`). The service layer abstracts this by using the active tour context.

### 3.2 API Response Mapping

The backend returns camelCase JSON (as stored in DynamoDB). The frontend types should use matching property names. Key response structures:

**Dashboard Response** (`GET /v1/tours/{tourId}/rides/{rideId}/dashboard`):
```json
{
  "success": true,
  "data": {
    "ride": { "rideId": "RIDE001", "stages": [...], ... },
    "riders": [
      {
        "riderId": "R1",
        "profileId": "uuid",
        "name": "John Doe",
        "phone": "+1-555-1234",
        "photoS3Key": "photos/R1.jpg",
        ...
      }
    ],
    "checkIns": [
      {
        "rideId": "RIDE001",
        "checkInId": "R1#001#2026-02-10T08:00:00Z",
        "riderId": "R1",
        "stageNumber": 1,
        "stageId": "S001",
        "isNotRiding": false,
        "isQuitRiding": false,
        "method": "QR_SCAN",
        "timestamp": "2026-02-10T08:00:00Z",
        "checkedInBy": "user-uuid"
      }
    ],
    "summary": {
      "totalRiders": 100,
      "checkedIn": 75,
      "notRiding": 5,
      "quitRiding": 2,
      "notCheckedIn": 18
    }
  },
  "timestamp": "2026-02-10T10:00:00Z"
}
```

**Check-in Request** (`POST /v1/tours/{tourId}/checkins`):
```json
{
  "riderId": "R57",
  "rideId": "RIDE001",
  "stageNumber": 2,
  "method": "QR_SCAN",
  "isNotRiding": false,
  "isQuitRiding": false,
  "notes": ""
}
```

---

## 4. Offline Status

The app does not support offline data caching or sync. When the device loses connectivity, the `OfflineBanner` component (powered by `OfflineContext` + `@react-native-community/netinfo`) displays a **"You are offline"** status bar. All features require an active internet connection.

---

## 5. Environment Configuration

The `.env` file needs the following variables. All must use the `EXPO_PUBLIC_` prefix — this is an Expo requirement for variables to be accessible at runtime.

```
# Tour Data API
EXPO_PUBLIC_TOUR_DATA_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/v1

# AWS Cognito (for JWT authentication)
EXPO_PUBLIC_AWS_REGION=<region>
EXPO_PUBLIC_AWS_USER_POOL_ID=<user-pool-id>
EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID=<client-id>
EXPO_PUBLIC_AWS_IDENTITY_POOL_ID=<identity-pool-id>

# Mock Data Mode (optional — for development/demo without a backend)
EXPO_PUBLIC_USE_MOCK_DATA=true
```

These values are provided by the `tour-data-api` deployment. The Cognito User Pool is shared between the backend and the frontend app.

When `EXPO_PUBLIC_USE_MOCK_DATA` is set to `true`, the API service functions (`getActiveTour`, `getActiveRide`, `getDashboardData`) return synthetic data from `mockData.ts` without making HTTP calls. All other environment variables can be left empty in this mode.

> **Note**: Variables prefixed with `EXPO_PUBLIC_` are embedded in the client bundle. This is acceptable for User Pool IDs and API URLs (not secrets). See [Development Guide → Environment Configuration](development-guide.md#environment-configuration) for full details.

---

## 6. Implementation Phases

### Phase 1: Core API Integration
1. ~~API client with authentication (`apiClient.ts`)~~ ✅
2. ~~Tour context (active tour resolution)~~ ✅
3. ~~Dashboard API integration (replace mock data)~~ ✅
4. Rider API integration
5. Ride API integration
6. Check-in API integration

### Phase 2: User/Auth Integration
1. Amplify Auth configuration
2. Login/logout flow
3. User profile and role resolution
4. RBAC enforcement in UI

---

## 7. Security Considerations

1. **JWT tokens** are managed by Amplify Auth SDK — no manual token storage needed
2. **No AWS credentials** in the app — all access through API with JWT authentication
3. **Sensitive data** (tokens, credentials) stored via `expo-secure-store`
4. **API base URL** configured via environment variables, not hardcoded
5. **HTTPS only** for all API communication

---

## 8. Open Questions and Decisions

### 8.1 Resolved

1. **Tour selection:** Currently assumes a single active tour per organisation. This is confirmed as the current use case. A TODO issue should be created for handling concurrent multiple active tours as a future enhancement.

2. **Multi-stage pit stop crew:** When a pit stop crew user is assigned to multiple stages, the app will provide a **stage context selector** allowing the user to choose which stage is their active context for the dashboard.

3. **Photo URL resolution:** Separated to issue #9 for independent handling. No blocker for current design — `photoS3Key` is stored in types. URL resolution can be added later.

---

## 9. Suggested Backend Enhancements (`tour-data-api`)

### 9.1 Duplicate Check-In Handling

**Current gap:** Behaviour when a duplicate check-in (same rider + same stage) is submitted may not be clearly defined.

**Enhancement needed:** The check-in endpoint should return a **409 Conflict** with a clear error code (e.g., `DUPLICATE_CHECKIN`) when a check-in for the same rider at the same stage already exists.

### 9.2 ETag Support for Dashboard Endpoint

**Enhancement needed:** The `GET /v1/tours/{tourId}/rides/{rideId}/dashboard` endpoint should support conditional requests via `ETag` / `If-None-Match` headers. When data hasn't changed, return `304 Not Modified` with no body. This reduces data transfer during repeated polling.

### 9.3 Summary

| Enhancement | Impact | Priority |
|------------|--------|----------|
| Duplicate check-in handling (§9.1) | Clean user experience for duplicate attempts | **Medium** |
| ETag support for dashboard (§9.2) | Reduces data transfer during repeated refreshes | **Medium** |

---

## Related Documentation

- [Solution Design](SolutionDesign.md) — Architecture, design principles, component structure
- [Requirements](Requirements.md) — Feature specifications and business rules
- [Dashboard Feature](Dashboard-Feature.md) — Dashboard screen specification
- [tour-data-api Solution Design](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/SolutionDesign.md) — Backend data model and API specifications
- [tour-data-api Requirements](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/Requirements.md) — Backend data requirements

---

[← Back to README](../README.md)