# Data Backend Integration Design

[← Back to README](../README.md)

This document provides the analysis and design for integrating the `tour-data-api` backend with the Check-In App (poc-app) frontend. It must be reviewed and approved before any development work begins.

## Table of Contents

- [1. API Approach Analysis](#1-api-approach-analysis)
- [2. Integration Architecture](#2-integration-architecture)
- [3. Data Model Alignment](#3-data-model-alignment)
- [4. Offline Support Design](#4-offline-support-design)
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
| **Offline Support** | ✅ Compatible | API responses are simple JSON — easily cached in SQLite for offline use |
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
├── database/               # SQLite for offline support
│   ├── database.ts         # Database initialisation, schema management
│   ├── riderStore.ts       # Rider data local storage
│   ├── rideStore.ts        # Ride data local storage
│   ├── checkInStore.ts     # Check-in data local storage
│   └── pendingStore.ts     # Pending sync queue storage
└── sync/                   # Data synchronisation
    └── syncService.ts      # Background sync logic
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

## 4. Offline Support Design

### 4.1 Overview

Offline support is critical for Pit Stop Crew users at remote locations. The design uses SQLite (via `expo-sqlite`) as the local database for caching and offline check-in capture.

### 4.2 SQLite Schema

```sql
-- Tour context (single active tour cached)
CREATE TABLE IF NOT EXISTS tour (
  tourId TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  startDate TEXT,
  endDate TEXT,
  lastSyncedAt TEXT
);

-- Riders (cached from API - read only locally)
CREATE TABLE IF NOT EXISTS riders (
  riderId TEXT PRIMARY KEY,
  profileId TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  emergencyContactName TEXT,
  emergencyContactPhone TEXT,
  photoS3Key TEXT,
  qrCodeData TEXT,
  status TEXT,
  lastSyncedAt TEXT
);

-- Current ride (cached from API - read only locally)
CREATE TABLE IF NOT EXISTS rides (
  rideId TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  rideNo INTEGER,
  name TEXT,
  startLocation TEXT,
  finishLocation TEXT,
  totalDistance REAL,
  flagOffTime TEXT,
  status TEXT,
  stagesJson TEXT,  -- JSON serialized stages array
  description TEXT,
  startedAt TEXT,
  completedAt TEXT,
  closedAt TEXT,
  lastSyncedAt TEXT
);

-- Check-ins (cached from API + locally created)
CREATE TABLE IF NOT EXISTS check_ins (
  checkInId TEXT PRIMARY KEY,
  riderId TEXT NOT NULL,
  rideId TEXT NOT NULL,
  stageNumber INTEGER NOT NULL,
  stageId TEXT,
  timestamp TEXT NOT NULL,
  checkedInBy TEXT,
  method TEXT,
  isNotRiding INTEGER DEFAULT 0,
  isQuitRiding INTEGER DEFAULT 0,
  isManualEntry INTEGER DEFAULT 0,
  notes TEXT,
  locationLat REAL,
  locationLng REAL,
  isLocal INTEGER DEFAULT 0,  -- 1 if created locally (not yet synced)
  syncStatus TEXT DEFAULT 'SYNCED',  -- SYNCED | PENDING | SYNCING | FAILED
  syncError TEXT,
  syncRetryCount INTEGER DEFAULT 0,
  createdAt TEXT,
  lastSyncedAt TEXT
);

-- Pending operations queue (for offline writes)
CREATE TABLE IF NOT EXISTS pending_operations (
  localId TEXT PRIMARY KEY,
  operationType TEXT NOT NULL,  -- CHECK_IN
  payload TEXT NOT NULL,  -- JSON serialized request body
  createdAt TEXT NOT NULL,
  syncStatus TEXT DEFAULT 'PENDING',  -- PENDING | SYNCING | FAILED
  syncError TEXT,
  retryCount INTEGER DEFAULT 0,
  lastAttemptAt TEXT
);
```

### 4.2.1 Storage Estimation and Optimisation

**Estimated storage per active ride:**

| Table | Row Count (max) | Estimated Row Size | Total |
|-------|----------------:|-------------------:|------:|
| `tour` | 1 | ~200 bytes | ~200 B |
| `riders` | 100 | ~500 bytes | ~50 KB |
| `rides` | 1 (active) + 7 (history) | ~1 KB | ~8 KB |
| `check_ins` | 600 per ride × 8 rides | ~350 bytes | ~1.7 MB |
| `pending_operations` | 0–50 (transient) | ~500 bytes | ~25 KB |
| **Total** | | | **~1.8 MB** |

SQLite overhead (indexes, metadata) adds ~20%, bringing the total to approximately **2–3 MB** for a full tour's data. This is negligible on modern mobile devices (which typically have 64–256 GB storage).

**Optimisation strategies:**

1. **Purge completed ride data:** After a ride is `CLOSED` and the tour moves on, retain only the current and most recent ride's check-in data locally. Older ride data can be fetched on-demand from the API when viewing historical rides.
2. **SQLite VACUUM:** Run `VACUUM` periodically (e.g., during app idle time or after purging data) to reclaim unused space. Avoid running on startup to prevent user-facing delays.
3. **Avoid storing large blobs:** Photos are not stored locally — only S3 keys are cached. Photo images are fetched/cached separately via the standard image caching mechanism (e.g., `expo-image` cache).
4. **Index only necessary columns:** Primary keys and foreign keys (`riderId`, `rideId`, `stageNumber`) are indexed. No additional indexes unless query performance requires it.

### 4.3 Data Flow

#### Design Principle: SQLite as Single Source of Truth

The **Dashboard always reads from SQLite** — never directly from the API. Two independent background processes keep SQLite current:

1. **Outbound sync (check-in → backend):** All check-ins are written to SQLite first, then an async process pushes them to the backend via `pending_operations`. This is the **same mechanism for both online and offline modes** — there is no separate "online check-in" path.
2. **Inbound sync (backend → SQLite):** A background polling process fetches updated dashboard data from the API and writes it into SQLite. The Dashboard UI observes SQLite for changes.

This architecture ensures:
- Dashboard is always responsive (reads are local, never blocked by network)
- Check-in is always instant (write to SQLite, async push to backend)
- Online/offline transitions are seamless — only the sync processes pause/resume

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

#### Offline Mode Control

Per requirements, the app provides a **manual offline mode toggle** in addition to automatic connectivity detection:

1. **Automatic detection:** `@react-native-community/netinfo` uses OS-level event-driven callbacks (not polling) to detect connectivity changes. Battery impact is negligible.

   ```typescript
   NetInfo.addEventListener(state => {
     // Fires only on actual connectivity changes (event-driven, not polled)
     // state.isConnected: boolean
     // state.isInternetReachable: boolean (optional deeper check)
   });
   ```

2. **Manual toggle:** Users can explicitly switch to offline mode via a toggle in the Dashboard header. This is useful when connectivity is unstable or intermittent — the user gets control rather than relying on automatic detection which may flip back and forth.

3. **Effective mode:** The app is considered offline if **either** the manual toggle is ON **or** NetInfo reports no connectivity. Both sync processes (outbound and inbound) pause when offline.

4. **Offline indicator:** The Dashboard header displays an offline indicator whenever the app is in offline mode (manual or automatic), clearly communicating the current state to the user.

#### Standard Check-In Flow (Online and Offline)

The check-in flow is **identical** regardless of connectivity:

1. User performs check-in (QR scan or manual entry)
2. Write check-in to `check_ins` table in SQLite (`isLocal = 1`, `syncStatus = PENDING`)
3. Add corresponding entry to `pending_operations` queue
4. Dashboard immediately reflects the new check-in (reads from SQLite)

The **outbound sync process** runs independently:
- When online: continuously processes `pending_operations` queue (FIFO, one at a time)
- When offline: paused — operations accumulate in the queue
- On transition to online: resumes processing from where it left off

#### Outbound Sync Process (Check-In → Backend)

The sync process runs as a background task, triggered by connectivity events and a periodic timer:

1. **Sync processor acquires a mutex lock** — only one sync runs at a time. If already in progress, subsequent triggers are ignored. The mutex is a promise-based lock (boolean flag guarded by `async`/`await` in the single-threaded JS runtime, or `async-mutex` library).

2. **Process `pending_operations` queue sequentially (FIFO):**
   - Set operation `syncStatus` to `SYNCING` before each API call
   - POST to API with the **original capture timestamp** from the pending operation
   - On success: update `check_ins` record (`isLocal = 0`, `syncStatus = SYNCED`), remove from queue
   - On conflict (409): apply conflict resolution rules (see §4.5)
   - On network error: mark as `PENDING` again, release mutex, wait for next trigger
   - On other error: retry with exponential backoff (max 5 retries), then mark as `FAILED`

3. **Race condition prevention:** The `syncStatus` column acts as an optimistic lock. Before processing, the sync service queries only `PENDING` operations and atomically updates them to `SYNCING`. If the app is restarted mid-sync, any `SYNCING` records are reset to `PENDING` on startup.

#### Inbound Sync Process (Backend → SQLite)

A separate background process polls the backend API and writes updated data into SQLite:

1. **Active ride, online:** Poll dashboard endpoint every 5 seconds (see §4.4)
2. **No active ride:** No polling needed (see §4.4)
3. **Offline or backgrounded:** Paused
4. Write API response data into SQLite tables (`check_ins`, `riders`, `rides`)
5. **Merge strategy:** Backend data is authoritative for non-local records. Local pending check-ins (`isLocal = 1`) are preserved and not overwritten by inbound data.

#### App Launch

1. Fetch active tour → store in context and SQLite
2. Fetch today's ride → cache in SQLite
3. Fetch riders → cache in SQLite
4. Fetch dashboard data (check-ins) → cache in SQLite
5. Resume outbound sync for any pending operations from previous session
6. Start inbound sync polling

#### Dashboard (Offline)

When offline (manual toggle or auto-detected):
- Dashboard reads from SQLite cache (same as online — single source of truth)
- For Pit Stop Crew: automatically switch to their assigned stage context view
- "Not Riding" and "Quit Riding" statuses synced before going offline are visible
- Locally captured check-ins are visible immediately

### 4.4 Dashboard Refresh Strategy

Since the Dashboard reads exclusively from SQLite, "refresh" means the **inbound sync process** fetching updated data from the backend API and writing it into SQLite. The Dashboard UI observes SQLite for changes and re-renders accordingly.

#### Adaptive Refresh Intervals

| Context | Interval | Rationale |
|---------|----------|-----------|
| **Dashboard active, online, ride in progress** | **5 seconds** | Organising team at ride start/finish needs near-real-time visibility. 5-second interval keeps the dashboard live with minimal perceived delay. |
| **Viewing historical ride (no active ride)** | **One-time pull** | No ongoing refresh needed. Data is fetched once when the user selects a historical ride to view. Historical data doesn't change. |
| **App backgrounded** | **Paused** | No polling when the app is not visible. Resume on foreground. This is critical for battery conservation. |
| **Offline** | **Paused** | No API calls. Dashboard reads from SQLite cache (which already has locally captured check-ins). |

#### Battery and Data Usage Impact

- **5-second polling (active ride):** Each dashboard request is ~50-80 KB. At 5-second intervals, this is ~600-960 KB/minute. During a typical ride (4-6 hours), a continuously active dashboard would use ~150-350 MB. However, in practice:
  - Dashboard screen is not continuously active for 6 hours — users switch between screens, lock the phone, etc.
  - **Conditional requests** (`If-None-Match` / ETag) reduce payload to near-zero when data hasn't changed. The server returns `304 Not Modified` with no body.
  - With ETags, actual data transfer during quiet periods drops to ~1 KB per request (headers only).
- **Battery:** HTTP requests over an existing connection are lightweight. The primary battery drain is the radio staying active. Grouping requests (single dashboard call vs multiple endpoints) and pausing when backgrounded keeps battery impact low.

#### Live-Feed Considerations

The SQLite-as-source architecture positions the app well for future live-feed enhancements:
- The Dashboard already observes SQLite for changes, so any mechanism that updates SQLite (polling, WebSocket, push notification) will instantly reflect on the Dashboard.
- A future WebSocket-based push mechanism would simply replace the polling inbound sync with a persistent connection that writes updates to SQLite as they arrive. The Dashboard UI code would not need to change.
- The current API Gateway HTTP API does not support WebSocket — this would require an API Gateway WebSocket API or a separate service.
- See issue #7 for tracking live-feed enhancement if 5-second polling proves insufficient.

#### Pre-Sync for Offline Readiness

Per requirements, "Not Riding" and "Quit Riding" data captured before a pit stop stage should be available locally. This is handled by:

1. **On app launch / when online:** Fetch and cache the complete dashboard data in SQLite
2. **Inbound sync while online:** The 5-second polling keeps the SQLite cache updated with the latest "Not Riding" and "Quit Riding" statuses
3. **Before going to pit stop:** Pit stop crew should have the app open with a recent sync. The 5-second refresh ensures the cache is current when connectivity is lost (or when the user manually switches to offline mode)
4. **Manual refresh:** A pull-to-refresh gesture is available on the dashboard for on-demand data sync

### 4.5 Conflict Resolution

#### Design Principle: Timestamp-Based Validity

Offline check-ins are **captured at a point in time** and carry their original `timestamp`. A check-in that was valid when captured remains valid regardless of when it is synced. The backend should accept check-ins based on their capture timestamp, not the current rider status or ride status at sync time. This requires backend enhancements described in §9.

#### Scenario: PS1 Offline, PS2 Online (Cross-Stage Sync)

Consider:
1. Rider R1 checks in at PS1 (stage 1) — PS1 crew is **offline**. Check-in recorded locally with timestamp `T1`.
2. Rider R1 continues to PS2 (stage 2) — PS2 crew is **online**. Check-in recorded and synced immediately at timestamp `T2 > T1`.
3. At PS2, rider R1 decides to quit riding. Quit-riding recorded and synced at `T3 > T2`.
4. Later, PS1 crew regains connectivity (or switches off manual offline mode) and syncs their pending operations.

**Resolution:** The PS1 check-in (stage 1, timestamp `T1`) is **valid and must be accepted** by the backend. Rationale:
- The `checkInId` format is `<riderId>#<stageNumber>#<timestamp>` — this is a **unique record** (stage 1 ≠ stage 2).
- The check-in timestamp `T1` predates the quit-riding timestamp `T3`.
- The rider was actively riding at `T1` — the check-in was legitimate when captured.

**Backend requirement:** This scenario requires the backend to validate check-in requests by comparing the check-in `timestamp` against the quit/not-riding timestamp, not just the rider's current status. If the check-in timestamp predates the quit, it should be accepted. See §9.1 for the specific enhancement request.

#### Scenario: Ride CLOSED with Valid Offline Check-Ins

A ride may be closed by an administrator while pit stop crew at a remote location still have pending offline check-ins. These check-ins were captured **while the ride was active** and are valid data.

**Resolution:** Check-ins captured before `closedAt` are valid and should be accepted by the backend (requires enhancement per §9.2). The sync process sends the original capture `timestamp`, and the backend validates:
- If `check-in timestamp < ride closedAt` → **accept** (valid late-synced check-in)
- If `check-in timestamp ≥ ride closedAt` → **reject** (genuinely occurred after ride closure)

**Backend requirement:** This scenario requires the check-in endpoint to compare the submitted `timestamp` against the ride's `closedAt` time, not just the current ride status. See §9.2 for the specific enhancement request.

#### Scenario: Duplicate Check-In

A user may attempt to check in a rider who has already been checked in at the same stage — either because:
- Another crew member already checked in the rider (e.g., at a busy pit stop)
- The user accidentally scanned the same QR code twice
- An offline check-in was captured locally, and the rider was also checked in by another crew member online

**Resolution:** When the backend returns a 409 Conflict indicating a duplicate check-in (same rider + same stage already exists):
1. Mark the pending operation as `SYNCED` (the check-in already exists — no data is lost)
2. Display a non-blocking notification to the user: _"Rider [ID] already checked in at [Stage]. No further action required."_
3. No retry, no manual intervention needed

On the **frontend**, before queuing a check-in, the app should also check SQLite for an existing check-in for the same rider at the same stage and warn the user proactively (reducing unnecessary API calls).

#### Conflict Resolution Summary

| Scenario | Resolution | Auto? |
|----------|-----------|-------|
| Offline check-in syncs successfully | Mark as `SYNCED` | ✅ Yes |
| Duplicate check-in (409: same rider + stage) | Mark as `SYNCED` (already exists), notify user "already checked in" | ✅ Yes |
| Rider quit after check-in was captured (409) | Backend accepts if check-in `T` < quit `T` (timestamp-based validation) | ✅ Yes |
| Rider quit before check-in was captured (409) | Mark `FAILED`, notify user — check-in is genuinely invalid | ✅ Yes |
| Ride CLOSED, check-in captured before closure (409) | Backend accepts if check-in `T` < `closedAt` (timestamp-based validation) | ✅ Yes |
| Ride CLOSED, check-in captured after closure (409) | Mark `FAILED`, notify user | ✅ Yes |
| Network error (timeout, no connection) | Retry with exponential backoff (2s → 4s → 8s → 16s → 32s), max 5 retries | ✅ Yes |
| Server error (500) | Retry with exponential backoff, max 3 retries | ✅ Yes |
| Authentication error (401) | Refresh JWT token via Amplify Auth, retry once | ✅ Yes |

> **Note:** All conflict scenarios are designed to be resolved automatically — no manual intervention or reconciliation process is required. However, the timestamp-based scenarios (rider quit, ride closed) depend on backend enhancements listed in §9. Until those enhancements are implemented, the sync service will flag these as `FAILED` with descriptive error messages for the organising team to review.

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

### Phase 2: Offline Support
1. SQLite database setup and schema
2. Data caching layer (riders, rides, check-ins)
3. Offline check-in capture
4. Connectivity detection and indicator
5. Pending operations queue

### Phase 3: Sync Service
1. Background sync for pending operations
2. Conflict resolution
3. Full dashboard reconciliation on reconnect
4. Periodic refresh while online

### Phase 4: User/Auth Integration
1. Amplify Auth configuration
2. Login/logout flow
3. User profile and role resolution
4. RBAC enforcement in UI

---

## 7. Security Considerations

1. **JWT tokens** are managed by Amplify Auth SDK — no manual token storage needed
2. **No AWS credentials** in the app — all access through API with JWT authentication
3. **SQLite data** is stored in the app's sandboxed storage (OS-level protection)
4. **Sensitive data** (tokens, credentials) stored via `expo-secure-store`
5. **API base URL** configured via environment variables, not hardcoded
6. **HTTPS only** for all API communication

---

## 8. Open Questions and Decisions

### 8.1 Resolved

1. **Tour selection:** Currently assumes a single active tour per organisation. This is confirmed as the current use case. A TODO issue should be created for handling concurrent multiple active tours as a future enhancement.

2. **Multi-stage pit stop crew offline:** When a pit stop crew user is assigned to multiple stages, the app will provide a **stage context selector** allowing the user to choose which stage is their active context for the dashboard. This avoids confusion since the pit stop crew's main objective is the currently active pit stop. The selector will be prominent in the dashboard header when the user has multiple stage assignments.

3. **Dashboard refresh interval:** 5-second polling during active rides is confirmed as acceptable. Live-feed enhancement (WebSocket) tracked in issue #7. The SQLite-as-source architecture ensures any future live-feed mechanism (WebSocket, push notifications) can be adopted without changing the Dashboard UI — only the inbound sync process needs updating.

4. **Photo URL resolution:** Separated to issue #9 for independent handling. No blocker for current design — `photoS3Key` is stored in types and SQLite schema. URL resolution can be added later without schema changes.

---

## 9. Suggested Backend Enhancements (`tour-data-api`)

The following enhancements to the `tour-data-api` backend are needed to support the fully automatic conflict resolution described in §4.5. Without these changes, some offline sync scenarios would require manual intervention, which should be avoided.

### 9.1 Timestamp-Based Check-In Validation

**Current gap:** The check-in endpoint likely validates against the rider's current status (e.g., rejects if rider is `QUIT_RIDING`) without considering when the check-in was captured.

**Enhancement needed:** The `POST /v1/tours/{tourId}/checkins` endpoint should compare the submitted check-in `timestamp` against:
- The rider's quit-riding timestamp (if applicable)
- The rider's not-riding timestamp (if applicable)

**Rule:** If `check-in timestamp < quit/not-riding timestamp`, the check-in is valid and should be accepted regardless of the rider's current status.

**Example:** Rider quits at PS2 (timestamp T3). A check-in captured at PS1 (timestamp T1, where T1 < T3) arrives later via offline sync. This check-in should be accepted.

### 9.2 Late-Sync for Closed Rides

**Current gap:** The check-in endpoint likely rejects all check-ins when the ride status is `CLOSED`.

**Enhancement needed:** The check-in endpoint should compare the submitted check-in `timestamp` against the ride's `closedAt` time.

**Rule:** If `check-in timestamp < ride closedAt`, the check-in is valid and should be accepted even though the ride is now closed. Only check-ins with `timestamp ≥ closedAt` should be rejected.

**Implementation option:** Add a flag to the existing endpoint (e.g., `lateSync: true` in the request body) or create a dedicated endpoint (`POST /v1/tours/{tourId}/checkins/late-sync`).

### 9.3 Duplicate Check-In Handling

**Current gap:** Behaviour when a duplicate check-in (same rider + same stage) is submitted may not be clearly defined.

**Enhancement needed:** The check-in endpoint should return a **409 Conflict** with a clear error code (e.g., `DUPLICATE_CHECKIN`) when a check-in for the same rider at the same stage already exists. A confirmation that the duplicate exists is sufficient — no need to return the full existing check-in data in the error response.

### 9.4 ETag Support for Dashboard Endpoint

**Enhancement needed:** The `GET /v1/tours/{tourId}/rides/{rideId}/dashboard` endpoint should support conditional requests via `ETag` / `If-None-Match` headers. When data hasn't changed, return `304 Not Modified` with no body. This significantly reduces data transfer during 5-second polling.

### 9.5 Summary

| Enhancement | Impact | Priority |
|------------|--------|----------|
| Timestamp-based check-in validation (§9.1) | Eliminates manual resolution for offline cross-stage sync | **High** |
| Late-sync for closed rides (§9.2) | Eliminates manual resolution for offline check-ins after ride closure | **High** |
| Duplicate check-in handling (§9.3) | Clean user experience for duplicate attempts | **Medium** |
| ETag support for dashboard (§9.4) | Reduces data transfer during 5-second polling | **Medium** |

---

## Related Documentation

- [Solution Design](SolutionDesign.md) — Architecture, design principles, component structure
- [Requirements](Requirements.md) — Feature specifications and business rules
- [Dashboard Feature](Dashboard-Feature.md) — Dashboard screen specification
- [tour-data-api Solution Design](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/SolutionDesign.md) — Backend data model and API specifications
- [tour-data-api Requirements](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/Requirements.md) — Backend data requirements

---

[← Back to README](../README.md)