# Sign-Up Approach — Design Document

[← Back to Documentation Index](docs-index.md)

> **Status**: Design Proposal — No development to be taken up  
> **Related Issue**: Sign Up approach  
> **Last Updated**: 2026-03-23

## Table of Contents

- [Problem Statement](#problem-statement)
- [Current State](#current-state)
- [Constraints and Requirements](#constraints-and-requirements)
- [Proposed Sign-Up Approaches](#proposed-sign-up-approaches)
  - [Option 1: Invitation-Based Sign-Up (Recommended)](#option-1-invitation-based-sign-up-recommended)
  - [Option 2: Organizer-Scoped Registration Code](#option-2-organizer-scoped-registration-code)
  - [Option 3: Admin-Only User Creation](#option-3-admin-only-user-creation)
- [Recommendation](#recommendation)
- [Bot and Abuse Protection](#bot-and-abuse-protection)
- [Multi-Organizer Support (Future)](#multi-organizer-support-future)
  - [Data Model](#data-model)
  - [App Behavior](#app-behavior)
  - [Sign-Up Integration with Multi-Organizer](#sign-up-integration-with-multi-organizer)
- [Impact on Existing Architecture](#impact-on-existing-architecture)
- [Open Questions](#open-questions)

---

## Problem Statement

The current sign-up approach uses traditional Cognito self-registration, which is inadequate for the following reasons:

1. **No organizer context**: When a rider signs up, the app has no way to associate the rider with a specific tour organizer or their subscription. The app requires organizer-specific initialization (branding, tour data, subscription limits).

2. **Bot and abuse vulnerability**: Open self-registration exposes the system to automated sign-ups, bulk account creation, and potential backend abuse (DynamoDB write costs, Cognito user pool limits).

3. **No subscription enforcement**: Tour organizers operate under subscriptions that may limit the number of riders. Open sign-up bypasses these controls entirely.

4. **Future multi-organizer requirement**: The system should eventually support riders registering with multiple tour organizers, each with isolated data. The sign-up approach must not preclude this.

---

## Current State

| Aspect | Current Implementation |
|--------|----------------------|
| **Cognito User Pool** | Single dedicated rider pool (`tour-rider-{env}-users`), separate from staff pool |
| **Self-Registration** | Enabled (`AllowAdminCreateUserOnly: false`) |
| **Sign-Up Flow** | Email + password → email verification code → account active |
| **Organizer Association** | None — riders exist independently of any organizer |
| **Bot Protection** | None beyond email verification |
| **Custom Attributes** | `custom:profileId` links to RiderProfile table |
| **Profile Storage** | `RiderProfile` table in tour-data-api (shared, not organizer-scoped) |
| **AWS Resource Ownership** | Single shared Cognito pool — **violates** organizer subscription isolation |

### Why Traditional Self-Registration Fails

- A rider creating an account has no organizer context → the app cannot determine which organizer's tours to show, which subscription limits apply, or what organizer-specific branding to display.
- Without gating, anyone can create accounts, flooding the Cognito user pool and the RiderProfile table.
- The Pre-Registration model (Model 1 in Requirements.md) assumes the organizer controls who can access the app, but the current sign-up flow does not enforce this.
- **All AWS resources (including Cognito) must be part of the organizer's subscription**. A single shared rider pool violates this principle — each organizer must have their own Cognito User Pool provisioned as part of their subscription. Nothing is shared across organizers.

---

## Constraints and Requirements

1. **Organizer-initiated access**: Only riders invited or authorized by a tour organizer should be able to sign up.
2. **Bot protection**: Automated or bulk sign-ups must be blocked.
3. **Subscription awareness**: Sign-up must respect the organizer's subscription limits (e.g., max riders).
4. **Per-organizer AWS resources**: All AWS resources — including Cognito User Pools — must be part of the organizer's subscription. Nothing is shared across organizers. Each organizer has their own Cognito User Pool for their riders.
5. **No direct AWS resource access**: All validation must go through tour-data-api (Design Principle #2).
6. **Mobile and web support**: Solution must work on iOS, Android, and web.
7. **Future-proof**: Must not preclude multi-organizer support.

---

## Proposed Sign-Up Approaches

### Option 1: Invitation-Based Sign-Up (Recommended)

#### How It Works

The tour organizer generates invitation links or codes through the Check-In App (tour-mgmt-app). Riders use these invitations to sign up.

#### Flow

```
Tour Organizer (Check-In App)         tour-data-api              Rider (Tour Rider App)
        │                                    │                           │
        │  1. Generate invitation             │                           │
        │─────────────────────────────────────>│                           │
        │  (organizerId, optional tourId,      │                           │
        │   expiry, maxUses)                   │                           │
        │                                      │                           │
        │  2. Returns invitation code/link     │                           │
        │<─────────────────────────────────────│                           │
        │                                      │                           │
        │  3. Organizer shares link/code       │                           │
        │      with riders (email, WhatsApp,   │                           │
        │      etc.)                           │                           │
        │                                      │                           │
        │                                      │   4. Rider opens app/link │
        │                                      │      enters invitation    │
        │                                      │      code                 │
        │                                      │                           │
        │                                      │   5. App validates code   │
        │                                      │<──────────────────────────│
        │                                      │                           │
        │                                      │   6. Returns organizer    │
        │                                      │      context (orgId,      │
        │                                      │      orgName, tourId,     │
        │                                      │      cognitoPoolId,       │
        │                                      │      cognitoClientId)     │
        │                                      │──────────────────────────>│
        │                                      │                           │
        │                                      │   7. App dynamically      │
        │                                      │      configures Amplify   │
        │                                      │      with organizer's     │
        │                                      │      Cognito pool         │
        │                                      │                           │
        │                                      │   8. Rider completes      │
        │                                      │      sign-up form         │
        │                                      │      (email, password,    │
        │                                      │      name)                │
        │                                      │                           │
        │                                      │   9. Account created in   │
        │                                      │      organizer's Cognito  │
        │                                      │      pool + email         │
        │                                      │      verification         │
        │                                      │                           │
        │                                      │  10. RiderProfile created │
        │                                      │      in organizer scope   │
        │                                      │<──────────────────────────│
        │                                      │                           │
        │                                      │  11. Invitation marked    │
        │                                      │      as used (or use      │
        │                                      │      count incremented)   │
```

> **Key difference from a shared-pool model**: Step 6 returns the organizer's specific Cognito User Pool ID and Client ID. Step 7 dynamically configures Amplify Auth to use that organizer's pool. The rider's Cognito account is created inside the organizer's own pool (step 9), not a shared pool. This ensures all AWS resources remain part of the organizer's subscription.

#### Invitation Types

| Type | Use Case | Distribution |
|------|----------|-------------|
| **Single-use link** | Personal invitation to a specific rider | Email, direct message |
| **Multi-use code** | Batch invitation for a group (e.g., a tour's riders) | WhatsApp group, tour website, printed on tour flyer |
| **Tour-specific code** | Invitation linked to a specific tour | Shared during tour registration process |

#### Invitation Properties

```
Invitation {
  invitationId: string           // Unique ID
  organizerId: string            // Which organizer created this
  organizerName: string          // For display in the app
  tourId?: string                // Optional — pre-link to a tour
  code: string                   // Short alphanumeric code (e.g., "TOUR2026-XYZ")
  type: "single" | "multi"       // Single-use or multi-use
  maxUses?: number               // For multi-use: max sign-ups allowed
  currentUses: number            // How many times used
  expiresAt: string              // ISO 8601 expiry timestamp
  status: "active" | "expired" | "exhausted" | "revoked"
  createdAt: string
  createdBy: string              // Staff user who created it
}
```

> **Note**: The invitation itself does not store Cognito pool details. When the invitation is validated, the tour-data-api looks up the organizer's subscription to resolve the Cognito User Pool ID and Client ID. This keeps invitation data decoupled from infrastructure details.

#### Advantages

- **Strong gating**: Only riders with a valid invitation can sign up.
- **Organizer context**: Invitation carries organizerId, establishing the rider-organizer relationship at sign-up.
- **Subscription enforcement**: Invitation generation can check subscription limits before creating codes.
- **Natural bot protection**: Bots cannot guess or brute-force invitation codes (short-lived, limited uses).
- **Multi-organizer ready**: Different organizers issue different invitations; rider can accumulate multiple organizer relationships.
- **Flexible distribution**: Organizers choose how to share (email, social media, print).
- **Auditable**: Every sign-up is traceable to an invitation and organizer.

#### Disadvantages

- Requires new backend endpoints (invitation CRUD in tour-data-api).
- Requires new UI in tour-mgmt-app (invitation management).
- Additional step for riders during sign-up (entering code).

---

### Option 2: Organizer-Scoped Registration Code

#### How It Works

Each tour organizer has a persistent, organizer-level registration code (not per-invitation). Riders enter this code during sign-up to associate with the organizer.

#### Flow

1. Organizer receives a registration code when their subscription is created (e.g., `ORG-CYCLETOUR-2026`).
2. Organizer shares the code with their riders via any channel.
3. Rider enters the code on the sign-up screen.
4. App validates the code via tour-data-api → returns organizer context.
5. Rider completes sign-up.

#### Advantages

- Simpler than invitation system — no per-invitation management.
- Organizer shares one code for all riders.

#### Disadvantages

- **Weaker security**: A leaked code allows unlimited sign-ups until manually rotated.
- **No usage tracking per invitation**: Cannot track who invited whom.
- **No expiry management**: Code is long-lived, harder to revoke.
- **Limited subscription enforcement**: Harder to cap usage without per-code tracking.
- **Bot risk**: Once a code is known, bots can use it repeatedly.

---

### Option 3: Admin-Only User Creation

#### How It Works

Disable Cognito self-registration. Only tour organizers (via Check-In App) or system administrators can create rider accounts.

#### Flow

1. Organizer creates rider account in Check-In App (enters rider's email, name).
2. tour-data-api creates Cognito account via Admin API → sends temporary password email to rider.
3. Rider receives email with temporary credentials.
4. Rider logs in → forced password change → account active.

#### Advantages

- **Maximum control**: No unauthorized accounts possible.
- **Zero bot risk**: No self-registration surface.
- **Full organizer control**: Organizer manages every rider account.

#### Disadvantages

- **Worst rider experience**: Riders cannot self-serve; dependent on organizer for account creation.
- **Organizer burden**: Organizer must manually create each account (100-200 riders per tour).
- **Slow onboarding**: Riders wait for organizer to create their account.
- **Temporary password management**: Riders may miss or lose the temporary password email.

---

## Recommendation

**Option 1 (Invitation-Based Sign-Up) is recommended** as the primary approach.

### Rationale

| Criteria | Option 1 (Invitation) | Option 2 (Org Code) | Option 3 (Admin-Only) |
|----------|:---------------------:|:--------------------:|:---------------------:|
| Bot protection | ✅ Strong | ⚠️ Moderate | ✅ Strong |
| Rider experience | ✅ Good (self-service with code) | ✅ Good | ❌ Poor |
| Organizer control | ✅ Full | ⚠️ Limited | ✅ Full |
| Subscription enforcement | ✅ Per-invitation | ⚠️ Aggregate only | ✅ Per-account |
| Multi-organizer ready | ✅ Natural fit | ⚠️ Possible | ⚠️ Possible (per-organizer pools resolve conflict) |
| Audit trail | ✅ Full | ⚠️ Partial | ✅ Full |
| Implementation effort | ⚠️ Moderate | ✅ Low | ⚠️ Moderate |

### Sign-Up Screen Changes (Design Only)

The sign-up screen would be modified to include an invitation code step:

```
Step 1: Enter Invitation Code
  ┌─────────────────────────────────┐
  │  Tour Rider App                 │
  │                                 │
  │  Enter Invitation Code          │
  │  ┌───────────────────────────┐  │
  │  │  TOUR2026-XYZ             │  │
  │  └───────────────────────────┘  │
  │                                 │
  │  [ Validate Code ]              │
  │                                 │
  │  Code provided by your tour     │
  │  organizer.                     │
  └─────────────────────────────────┘

Step 2: Registration Form (shown after valid code)
  ┌─────────────────────────────────┐
  │  Registering with:              │
  │  🚴 [Organizer Name]            │
  │                                 │
  │  First Name: ________________   │
  │  Last Name:  ________________   │
  │  Email:      ________________   │
  │  Phone:      ________________   │
  │  Password:   ________________   │
  │  Confirm:    ________________   │
  │                                 │
  │  [ Sign Up ]                    │
  └─────────────────────────────────┘

Step 3: Email Verification (unchanged from current)
```

### Backend API Endpoints Required (tour-data-api)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /v1/invitations` | POST | Organizer creates invitation (from Check-In App) |
| `GET /v1/invitations?organizerId={id}` | GET | List organizer's invitations (from Check-In App) |
| `POST /v1/invitations/validate` | POST | Validate invitation code (from Rider App, pre-sign-up) |
| `PUT /v1/invitations/{invitationId}` | PUT | Revoke or update invitation (from Check-In App) |
| `POST /v1/invitations/{invitationId}/redeem` | POST | Mark invitation as used after successful sign-up (from Rider App) |

### Cognito Configuration Changes

The current architecture uses a single shared Cognito User Pool (`tour-rider-{env}-users`). This must change to **per-organizer Cognito pools**.

| Setting | Current | Proposed |
|---------|---------|----------|
| **Pool ownership** | Single shared rider pool | Per-organizer pool (provisioned as part of organizer subscription) |
| **Pool naming** | `tour-rider-{env}-users` | `{organizerId}-rider-{env}-users` (or similar organizer-scoped name) |
| `AllowAdminCreateUserOnly` | `false` | `false` (keep self-registration but gate via invitation validation in app) |
| Pre Sign-Up Lambda trigger | None | **Add**: Validates that a valid invitation code was passed as client metadata |
| **Amplify configuration** | Static (env vars at build time) | **Dynamic** (configured at runtime after invitation validation returns organizer's Cognito pool details) |

> **Note**: The Pre Sign-Up Lambda trigger provides server-side enforcement. Even if someone bypasses the app and calls Cognito directly, the Lambda rejects sign-ups without a valid invitation code. Each organizer's Cognito pool has its own Pre Sign-Up Lambda trigger.

> **Important**: Since each organizer has their own Cognito User Pool, the app cannot use static environment variables (`EXPO_PUBLIC_AWS_USER_POOL_ID`, `EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID`) for Cognito configuration. Instead, Amplify Auth must be configured dynamically at runtime after the invitation code is validated and the organizer's pool details are retrieved. The app must store the active organizer's Cognito pool configuration locally so that returning users can log in without re-entering an invitation code. (See Open Question #9 regarding storage mechanism.)

### Login Flow Changes

With per-organizer Cognito pools, the login flow must also know which pool to authenticate against:

```
Rider opens app
        │
        ▼
  Saved organizer context?
  (from previous sign-up or login)
  ├── Yes → Configure Amplify with
  │         saved pool details →
  │         Proceed to login screen
  └── No
        │
        ▼
  Show "Enter Invitation Code"
  or "Select Your Organizer"
        │
        ▼
  Validate code / select organizer
  → Get Cognito pool details
  → Configure Amplify
  → Proceed to login or sign-up
```

For riders who have previously signed up, the app stores the organizer context (organizerId, organizerName, cognitoPoolId, cognitoClientId) locally. On subsequent app launches, the saved context is used to configure Amplify, and the rider goes directly to the login screen.

### Data Model Changes (tour-data-api)

New DynamoDB table: `Invitation`

```
Table: Invitation
  PK: invitationId (string)
  GSI1: organizerId-status-index (organizerId + status)
  GSI2: code-index (code) — for code lookup during validation

Attributes:
  invitationId, organizerId, organizerName, tourId, code,
  type, maxUses, currentUses, expiresAt, status,
  createdAt, createdBy, redeemedBy (list of cognitoSubs)
```

---

## Bot and Abuse Protection

Regardless of which sign-up approach is chosen, the following protections should be implemented:

### Layer 1: Invitation Code Gating (Primary)

- Valid invitation code required before sign-up form is shown.
- Codes are short-lived and limited-use.
- Invalid codes do not reveal whether the code exists or is expired (generic error message).

### Layer 2: Cognito Pre Sign-Up Lambda Trigger

- Server-side validation that the sign-up request includes a valid invitation code.
- Rejects sign-ups without a valid code even if Cognito API is called directly (bypassing the app).
- Checks: code validity, expiry, usage count, organizer subscription status.

### Layer 3: Rate Limiting

- **API Gateway**: Throttle invitation validation endpoint (e.g., 5 requests/minute per IP).
- **Cognito**: Cognito has built-in rate limits on sign-up attempts.
- **tour-data-api**: Rate limit at the API Gateway level for all endpoints.

### Layer 4: Cognito Advanced Security (Optional)

- Enable Cognito Advanced Security Features for risk-based adaptive authentication.
- Detects compromised credentials, suspicious sign-in attempts, automated bot activity.
- Supports adaptive challenges (e.g., CAPTCHA) for risky sign-ups.
- **Note**: This is a paid Cognito feature — evaluate cost vs. benefit.

### Layer 5: Monitoring and Alerts

- CloudWatch alarms on unusual sign-up volume.
- Alert organizers if invitation code usage spikes abnormally.
- Log all sign-up attempts (success and failure) for audit.

### Protection Summary

```
                    Request Flow
                        │
                        ▼
              ┌───────────────────┐
              │  Rate Limiting    │ ← API Gateway throttle
              │  (per IP)         │
              └────────┬──────────┘
                       │
                       ▼
              ┌───────────────────┐
              │  Invitation Code  │ ← App validates via tour-data-api
              │  Validation       │
              └────────┬──────────┘
                       │
                       ▼
              ┌───────────────────┐
              │  Cognito          │ ← Pre Sign-Up Lambda re-validates
              │  Pre Sign-Up      │   invitation code server-side
              │  Lambda           │
              └────────┬──────────┘
                       │
                       ▼
              ┌───────────────────┐
              │  Cognito          │ ← Optional: Advanced Security
              │  Advanced         │   risk assessment
              │  Security         │
              └────────┬──────────┘
                       │
                       ▼
              ┌───────────────────┐
              │  Account Created  │
              │  + Email          │
              │  Verification     │
              └───────────────────┘
```

---

## Multi-Organizer Support (Future)

> **Note**: This section describes a future capability. No implementation is required now. The design is provided so the sign-up approach does not preclude this capability.

### Concept

A single rider (identified by email) can register with multiple tour organizers. Since each organizer has their own Cognito User Pool, the rider has **separate Cognito accounts** in each organizer's pool. Each organizer's data is fully isolated — a rider's participation in Organizer A's tours is invisible to Organizer B, and all AWS resources (Cognito, DynamoDB, S3) remain within the organizer's subscription.

### Data Model

#### Current Model (Single Organizer)

```
Organizer's Cognito User Pool
  └── Rider (email, sub, custom:profileId)

RiderProfile (single record per rider, within organizer scope)
  └── profileId, email, name, phone, emergencyContact, ...

TourRider-{tourId} (enrollment per tour)
  └── riderId, profileId, status, ...
```

#### Proposed Model (Multi-Organizer)

```
Organizer A's Cognito User Pool          Organizer B's Cognito User Pool
  └── Rider (email, sub-A)                 └── Rider (email, sub-B)
        │                                        │
        ▼                                        ▼
Organizer A's RiderProfile                Organizer B's RiderProfile
  PK: profileId-A                           PK: profileId-B
  ┌────────────────────────────┐            ┌────────────────────────────┐
  │  name, phone, emergency    │            │  name, phone, emergency    │
  │  contact, photo, ...       │            │  contact, photo, ...       │
  └────────────────────────────┘            └────────────────────────────┘
        │                                        │
        ▼                                        ▼
Organizer A's Tour tables                 Organizer B's Tour tables
  TourRider-{tourId}                        TourRider-{tourId}
  CheckIn-{tourId}                          CheckIn-{tourId}


App Local Storage (on rider's device)
  ┌───────────────────────────────────────────────────────────┐
  │  Saved Organizer Contexts:                                │
  │  ┌─────────────────────────────────────────────────────┐  │
  │  │  organizerId: org-cycling                           │  │
  │  │  organizerName: Cycling Adventures                  │  │
  │  │  cognitoPoolId: us-east-1_XXXX                      │  │
  │  │  cognitoClientId: abc123                            │  │
  │  ├─────────────────────────────────────────────────────┤  │
  │  │  organizerId: org-marathon                          │  │
  │  │  organizerName: Marathon Events Co                  │  │
  │  │  cognitoPoolId: us-east-1_YYYY                      │  │
  │  │  cognitoClientId: def456                            │  │
  │  └─────────────────────────────────────────────────────┘  │
  └───────────────────────────────────────────────────────────┘
```

#### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate Cognito account per organizer** | Each organizer's Cognito pool is part of their subscription. Rider has an independent account in each pool. This ensures complete AWS resource isolation per organizer. |
| **Separate RiderProfile per organizer** | Rider may want different profile data per organizer (e.g., different emergency contact, different photo). All profile data stays within the organizer's AWS resources. |
| **No shared OrganizerRider mapping table** | With per-organizer pools, there is no central table linking a rider across organizers. The app manages multi-organizer context locally on the device. |
| **Local organizer context storage** | The app stores a list of organizer contexts (id, name, Cognito pool details) on the rider's device. This enables organizer switching without a shared backend table. |
| **Same email, different pools** | A rider uses the same email address across organizer pools. Each pool is independent — same email does not create conflicts. Rider may choose different passwords per pool. |
| **Tour data unchanged** | `TourRider-{tourId}` and `CheckIn-{tourId}` tables are already tour-scoped and within the organizer's infrastructure. No changes needed. |

### App Behavior

#### Organizer Context Switching

```
┌─────────────────────────────────────────┐
│  Tour Rider App                          │
│                                          │
│  Select Your Organization:               │
│  ┌─────────────────────────────────────┐ │
│  │  🚴 Cycling Adventures             │ │
│  │  2 active tours                     │ │
│  │  [Select →]                         │ │
│  ├─────────────────────────────────────┤ │
│  │  🏃 Marathon Events Co             │ │
│  │  1 active tour                      │ │
│  │  [Select →]                         │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  [+ Join another organizer]              │
│                                          │
└─────────────────────────────────────────┘
```

- On app launch, if rider has multiple saved organizer contexts, show organizer selection screen.
- If rider has only one saved organizer, skip selection and go directly to that organizer's login/session.
- Selecting an organizer reconfigures Amplify Auth with that organizer's Cognito pool.
- **Switching organizers requires re-authentication** (signing out of current organizer's pool, signing into the selected organizer's pool). This is because each organizer has a separate Cognito pool with independent sessions.
- All app data (tours, check-ins, notifications, profile) is scoped to the selected organizer.
- Rider can switch organizers from settings or the organizer selection screen (which requires logout + login to the other pool).

#### Adding a New Organizer

- Rider uses a new invitation code from a different organizer.
- Flow: Enter invitation code → validate → get new organizer's Cognito pool details → sign up in new organizer's pool → create RiderProfile in new organizer's scope.
- The new organizer context is saved locally alongside existing ones.
- This is a full sign-up in the new organizer's Cognito pool (separate account).

### Sign-Up Integration with Multi-Organizer

The invitation-based sign-up (Option 1) with per-organizer Cognito pools naturally supports multi-organizer:

| Scenario | Behavior |
|----------|----------|
| **New rider, first organizer** | Enter invitation code → get organizer's Cognito pool → sign up (create account in organizer's pool) → create RiderProfile in organizer scope |
| **Existing rider, new organizer** | Enter invitation code → get new organizer's Cognito pool → **full sign-up in new organizer's pool** (separate Cognito account) → create RiderProfile in new organizer scope → save new organizer context locally |
| **Existing rider, same organizer** | Already has an account in that organizer's pool → login directly, no invitation needed |

#### Account Flow for Multi-Organizer

```
Rider enters invitation code
        │
        ▼
  Code valid?
  ├── No → Show error
  └── Yes → Get organizer context
              (orgId, orgName,
               cognitoPoolId,
               cognitoClientId)
        │
        ▼
  Configure Amplify with
  organizer's Cognito pool
        │
        ▼
  "Already have an account
   with this organizer?"
  ├── Yes → Login to organizer's pool
  └── No → Sign Up in organizer's pool
              (create new Cognito account
               + RiderProfile)
        │
        ▼
  Save organizer context locally
  (added to list of saved organizers)
```

> **Note**: Unlike a shared-pool model where adding a new organizer is a "join" action, the per-organizer pool model requires a full sign-up in each new organizer's Cognito pool. The rider effectively creates a new account per organizer, but the app manages this seamlessly by maintaining a local list of organizer contexts.

---

## Impact on Existing Architecture

### Changes Required

| Component | Change | Scope |
|-----------|--------|-------|
| **Rider App — SignUpScreen** | Add invitation code step before registration form | UI change |
| **Rider App — AuthContext** | Support dynamic Amplify Auth configuration (per-organizer Cognito pool) | Significant logic change |
| **Rider App — Local Storage** | Store organizer context (orgId, name, cognitoPoolId, cognitoClientId) for returning users | New storage pattern |
| **Rider App — LoginScreen** | Load saved organizer context to configure Amplify before login | Logic change |
| **Rider App — Amplify Config** | Change from static env-var config to dynamic runtime configuration | Architecture change |
| **tour-data-api** | New Invitation table + CRUD endpoints | New backend feature |
| **tour-data-api** | Invitation validation endpoint returns organizer's Cognito pool details | New backend endpoint |
| **tour-mgmt-app** | New invitation management screen for organizers | New feature in Check-In App |
| **Cognito** | Per-organizer pool provisioning (part of organizer subscription setup) | Infrastructure change |
| **Cognito** | Add Pre Sign-Up Lambda trigger on each organizer's pool | Infrastructure per organizer |
| **CloudFormation** | Remove single shared rider pool; pools created per organizer subscription | Infrastructure redesign |

### No Changes Required

| Component | Reason |
|-----------|--------|
| **TourRider tables** | Already tour-scoped and within organizer infrastructure, unaffected |
| **CheckIn tables** | Already tour-scoped and within organizer infrastructure, unaffected |
| **API Client (apiClient.ts)** | No changes — invitation validation is a standard API call; JWT injection unchanged |
| **Password reset** | Unchanged (operates within the organizer's Cognito pool) |

---

## Open Questions

1. **Invitation code format**: Should codes be human-readable (e.g., `TOUR2026-ABC123`) or UUID-based? Human-readable is easier to share verbally but has lower entropy.

2. **Deep link support**: Should invitation links open the app directly (via deep links / universal links) or redirect to app store if not installed?

3. **Invitation expiry default**: What should the default expiry be? 7 days? 30 days? Configurable per organizer?

4. **Profile data sharing across organizers**: In multi-organizer mode, should the app offer to pre-fill profile data when signing up with a new organizer (copying from a previously saved organizer context), or must the rider enter it fresh each time?

5. **Subscription limit enforcement**: Should invitation generation be blocked when the organizer's subscription rider limit is reached, or should it just warn the organizer?

6. **Pre Sign-Up Lambda ownership**: Should the Pre Sign-Up Lambda be a template provisioned per organizer (as part of subscription setup), or a shared Lambda that validates across organizer pools?

7. **Cognito pool provisioning**: How is an organizer's Cognito User Pool created? As part of the subscription provisioning flow in tour-data-api? Via a separate admin tool? This must be automated and not manual.

8. **Password consistency across organizers**: Should the app encourage riders to use the same password across organizer pools (for convenience), or leave it entirely to the rider? Note: the app cannot enforce password consistency across independent Cognito pools.

9. **Saved organizer context security**: Organizer Cognito pool details (pool ID, client ID) stored locally on the device are not secrets, but should they be stored in secure storage (expo-secure-store) or regular async storage?

---

[← Back to Documentation Index](docs-index.md)
