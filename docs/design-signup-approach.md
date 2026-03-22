# Sign-Up Approach — Design Document

[← Back to Documentation Index](docs-index.md)

> **Status**: Design Proposal — No development to be taken up  
> **Related Issue**: Sign Up approach  
> **Last Updated**: 2026-03-22

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
| **Cognito User Pool** | Dedicated rider pool (`tour-rider-{env}-users`), separate from staff pool |
| **Self-Registration** | Enabled (`AllowAdminCreateUserOnly: false`) |
| **Sign-Up Flow** | Email + password → email verification code → account active |
| **Organizer Association** | None — riders exist independently of any organizer |
| **Bot Protection** | None beyond email verification |
| **Custom Attributes** | `custom:profileId` links to RiderProfile table |
| **Profile Storage** | `RiderProfile` table in tour-data-api (shared, not organizer-scoped) |

### Why Traditional Self-Registration Fails

- A rider creating an account has no organizer context → the app cannot determine which organizer's tours to show, which subscription limits apply, or what organizer-specific branding to display.
- Without gating, anyone can create accounts, flooding the Cognito user pool and the RiderProfile table.
- The Pre-Registration model (Model 1 in Requirements.md) assumes the organizer controls who can access the app, but the current sign-up flow does not enforce this.

---

## Constraints and Requirements

1. **Organizer-initiated access**: Only riders invited or authorized by a tour organizer should be able to sign up.
2. **Bot protection**: Automated or bulk sign-ups must be blocked.
3. **Subscription awareness**: Sign-up must respect the organizer's subscription limits (e.g., max riders).
4. **Single Cognito pool**: Maintain one rider Cognito pool (not per-organizer pools) for simplicity and cost.
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
        │                                      │      orgName, tourId)     │
        │                                      │──────────────────────────>│
        │                                      │                           │
        │                                      │   7. Rider completes      │
        │                                      │      sign-up form         │
        │                                      │      (email, password,    │
        │                                      │      name)                │
        │                                      │                           │
        │                                      │   8. Cognito account      │
        │                                      │      created + email      │
        │                                      │      verification         │
        │                                      │                           │
        │                                      │   9. RiderProfile created │
        │                                      │      with organizerId     │
        │                                      │<──────────────────────────│
        │                                      │                           │
        │                                      │  10. Invitation marked    │
        │                                      │      as used (or use      │
        │                                      │      count incremented)   │
```

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
- **Multi-organizer conflict**: If a rider joins a second organizer, the account already exists in Cognito — admin creation would fail or require special handling.

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
| Multi-organizer ready | ✅ Natural fit | ⚠️ Possible | ❌ Needs workaround |
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

| Setting | Current | Proposed |
|---------|---------|----------|
| `AllowAdminCreateUserOnly` | `false` | `false` (keep self-registration but gate via invitation validation in app) |
| Pre Sign-Up Lambda trigger | None | **Add**: Validates that a valid invitation code was passed as a custom attribute or client metadata |

> **Note**: The Pre Sign-Up Lambda trigger provides server-side enforcement. Even if someone bypasses the app and calls Cognito directly, the Lambda rejects sign-ups without a valid invitation code. This is critical for security — app-side validation alone is insufficient.

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

A single rider (one Cognito account, one email) can register with multiple tour organizers. Each organizer's data is fully isolated — a rider's participation in Organizer A's tours is invisible to Organizer B.

### Data Model

#### Current Model (Single Organizer)

```
Cognito User Pool
  └── Rider (email, sub, custom:profileId)

RiderProfile (single record per rider)
  └── profileId, email, name, phone, emergencyContact, ...

TourRider-{tourId} (enrollment per tour)
  └── riderId, profileId, status, ...
```

#### Proposed Model (Multi-Organizer)

```
Cognito User Pool
  └── Rider (email, sub)
        │
        │  One Cognito identity, multiple organizer relationships
        │
        ▼
OrganizerRider (new table — maps rider to organizer)
  PK: cognitoSub
  SK: organizerId
  ┌────────────────────────────────────────────────┐
  │  cognitoSub    │ organizerId   │ profileId     │
  │─────────────────────────────────────────────────│
  │  abc-123       │ org-cycling   │ profile-001   │
  │  abc-123       │ org-marathon  │ profile-002   │
  └────────────────────────────────────────────────┘
        │                              │
        │                              │
        ▼                              ▼
RiderProfile (per rider per organizer)
  PK: profileId
  ┌──────────────────────────────────────────────┐
  │  profile-001 (for org-cycling)               │
  │  name, phone, emergency contact, photo, ...  │
  │──────────────────────────────────────────────│
  │  profile-002 (for org-marathon)              │
  │  name, phone, emergency contact, photo, ...  │
  └──────────────────────────────────────────────┘
        │
        ▼
TourRider-{tourId} (unchanged — already scoped by tour)
  └── riderId, profileId, status, ...

CheckIn-{tourId} (unchanged — already scoped by tour)
  └── checkInId, riderId, ...
```

#### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate RiderProfile per organizer** | Rider may want different profile data per organizer (e.g., different emergency contact, different photo). Ensures data isolation. |
| **OrganizerRider mapping table** | Links a Cognito identity to multiple organizers. Enables organizer context switching in the app. |
| **Single Cognito account** | Rider uses one email/password for all organizers. No need to create multiple Cognito accounts. |
| **custom:profileId removal** | Cannot store multiple profileIds in a single Cognito attribute. Replace with OrganizerRider table lookup. |
| **Tour data unchanged** | `TourRider-{tourId}` and `CheckIn-{tourId}` tables are already tour-scoped. No changes needed. |

### App Behavior

#### Organizer Context Switching

```
┌─────────────────────────────────────────┐
│  Tour Rider App                          │
│                                          │
│  Welcome, John                           │
│                                          │
│  Your Organizations:                     │
│  ┌─────────────────────────────────────┐ │
│  │  🚴 Cycling Adventures             │ │
│  │  2 active tours                     │ │
│  │  [Switch →]                         │ │
│  ├─────────────────────────────────────┤ │
│  │  🏃 Marathon Events Co             │ │
│  │  1 active tour                      │ │
│  │  [Switch →]                         │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  [+ Join another organizer]              │
│                                          │
└─────────────────────────────────────────┘
```

- After login, if rider has multiple organizer relationships, show organizer selection.
- If rider has only one organizer, skip selection and go directly to that organizer's context.
- All app data (tours, check-ins, notifications, profile) is scoped to the selected organizer.
- Rider can switch organizers from settings or a persistent context indicator.

#### Adding a New Organizer

- Rider uses a new invitation code from a different organizer.
- Since the rider already has a Cognito account, no new sign-up is needed.
- Flow: Enter invitation code → validate → create new OrganizerRider record + new RiderProfile for that organizer.
- This is a "join organizer" action, not a "sign up" action.

### Sign-Up Integration with Multi-Organizer

The invitation-based sign-up (Option 1) naturally supports multi-organizer:

| Scenario | Behavior |
|----------|----------|
| **New rider, first organizer** | Enter invitation code → sign up (create Cognito account) → create OrganizerRider + RiderProfile |
| **Existing rider, new organizer** | Enter invitation code → app detects existing account → "Join Organizer" flow (no Cognito sign-up, just OrganizerRider + RiderProfile creation) |
| **Existing rider, same organizer** | Enter invitation code → app detects existing relationship → show appropriate message |

#### Account Detection Flow

```
Rider enters invitation code
        │
        ▼
  Code valid?
  ├── No → Show error
  └── Yes
        │
        ▼
  Rider logged in?
  ├── Yes → "Join Organizer" flow
  │         (create OrganizerRider + RiderProfile)
  └── No
        │
        ▼
  "Already have an account?"
  ├── Yes → Login → then "Join Organizer" flow
  └── No → Sign Up flow
              (create Cognito account +
               OrganizerRider + RiderProfile)
```

---

## Impact on Existing Architecture

### Changes Required

| Component | Change | Scope |
|-----------|--------|-------|
| **Rider App — SignUpScreen** | Add invitation code step before registration form | UI change |
| **Rider App — AuthContext** | Pass invitation code through sign-up flow | Minor logic change |
| **tour-data-api** | New Invitation table + CRUD endpoints | New backend feature |
| **tour-data-api** | New invitation validation endpoint | New backend endpoint |
| **tour-mgmt-app** | New invitation management screen for organizers | New feature in Check-In App |
| **Cognito** | Add Pre Sign-Up Lambda trigger for server-side validation | Infrastructure change |
| **CloudFormation** | Add Lambda trigger to Cognito stack | Infrastructure update |

### No Changes Required

| Component | Reason |
|-----------|--------|
| **TourRider tables** | Already tour-scoped, unaffected |
| **CheckIn tables** | Already tour-scoped, unaffected |
| **API Client (apiClient.ts)** | No changes — invitation validation is a standard API call |
| **Token management** | Unchanged — JWT flow remains the same |
| **Login flow** | Unchanged — login does not require invitation code |
| **Password reset** | Unchanged |

---

## Open Questions

1. **Invitation code format**: Should codes be human-readable (e.g., `TOUR2026-ABC123`) or UUID-based? Human-readable is easier to share verbally but has lower entropy.

2. **Deep link support**: Should invitation links open the app directly (via deep links / universal links) or redirect to app store if not installed?

3. **Invitation expiry default**: What should the default expiry be? 7 days? 30 days? Configurable per organizer?

4. **Existing rider detection**: When a rider with an existing Cognito account enters an invitation code for a new organizer, should the app auto-detect (via email lookup) or require the rider to indicate they have an existing account?

5. **Profile data sharing**: In multi-organizer mode, should riders be able to copy profile data from one organizer context to another, or must they enter it fresh each time?

6. **Subscription limit enforcement**: Should invitation generation be blocked when the organizer's subscription rider limit is reached, or should it just warn the organizer?

7. **Pre Sign-Up Lambda**: Should the Lambda be a standalone function in this repo, or managed as part of the tour-data-api infrastructure?

---

[← Back to Documentation Index](docs-index.md)
