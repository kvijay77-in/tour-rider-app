# Generic App Distribution — Feasibility Analysis

[← Back to README](../README.md)

This document analyses the feasibility of distributing a **single generic app package** through the Google Play Store / Apple App Store that works with any tour organizer's dedicated AWS subscription, without baking organizer-specific configuration into the app and without requiring a separate build per organizer.

This is a **feasibility analysis**. Implementation details for the chosen approach are documented in [Solution Design → App Distribution — Runtime Configuration](SolutionDesign.md#app-distribution--runtime-configuration-single-app-multiple-organizers).

> **Updated constraint (March 2026):** Self-service sign-up will be removed from the app. Users access the app by invitation only — the tour organizer's team sends each user an email invite. This change is reflected throughout the analysis below, particularly in how the org code is delivered to users and in the authentication flow design.
>
> **Revised recommendation (March 2026):** Based on further review, **Option 3 (Setup Deep Link / QR Code in invite email) is now the recommended approach** — it requires no publisher-maintained central service and integrates naturally with invite-only onboarding. The previous Option 2 (Bootstrap Service) is retained as a viable alternative for organizers who need to be able to update their AWS config centrally without re-issuing invite links.

---

## Table of Contents

- [Context and Problem Statement](#context-and-problem-statement)
- [Current Architecture Constraints](#current-architecture-constraints)
- [Options Analysis](#options-analysis)
  - [Option 1: Shared AWS Infrastructure (Single Tenant)](#option-1-shared-aws-infrastructure-single-tenant)
  - [Option 2: Runtime Configuration via Bootstrap Service](#option-2-runtime-configuration-via-bootstrap-service)
  - [Option 3: Configuration via Setup QR Code / Deep Link](#option-3-configuration-via-setup-qr-code--deep-link)
  - [Option 4: Dedicated App Build per Organizer (Status Quo)](#option-4-dedicated-app-build-per-organizer-status-quo)
- [Comparison Matrix](#comparison-matrix)
- [Recommendation](#recommendation)
- [Technical Design: Recommended Approach](#technical-design-recommended-approach)
  - [Invite Email Setup Link](#invite-email-setup-link)
  - [QR Code — Obfuscation Analysis](#qr-code--obfuscation-analysis)
  - [App First-Launch Flow](#app-first-launch-flow)
  - [Reinstall and New-Device Scenario](#reinstall-and-new-device-scenario)
  - [Dynamic Amplify Configuration](#dynamic-amplify-configuration)
  - [Security Considerations](#security-considerations)
- [Implementation Effort Estimate](#implementation-effort-estimate)
- [Decision Required](#decision-required)

---

## Context and Problem Statement

The Check-In App currently uses **Expo-managed environment variables** (prefixed `EXPO_PUBLIC_`) to carry AWS configuration at build time:

```
EXPO_PUBLIC_AWS_REGION
EXPO_PUBLIC_AWS_USER_POOL_ID
EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID
EXPO_PUBLIC_AWS_IDENTITY_POOL_ID
EXPO_PUBLIC_TOUR_DATA_API_BASE_URL
```

These variables are **embedded into the JavaScript bundle by Metro** at build time. The bundle is then packaged into the `.apk` / `.aab` / `.ipa` file that is distributed via the Play Store / App Store.

**Consequence:** Every different AWS subscription requires a new app build with that subscription's values baked in. A tour organizer running their own AWS account cannot use another organizer's app package without configuration mismatch.

**Goal:** Publish **one app** to the Play Store that any tour organizer can install and point at their own AWS backend, without the publisher needing to build and release a new binary per organizer.

---

## Current Architecture Constraints

| Constraint | Detail |
|------------|--------|
| `EXPO_PUBLIC_` variables are build-time constants | Metro bundles them into the JS bundle; they cannot be changed post-build |
| `Amplify.configure()` requires values at startup | Configuration must be present before the first auth call |
| No runtime config injection from Expo | Expo managed workflow does not support per-device environment overrides |
| EAS Build / CI required per config set | Each organizer would need their own EAS environment profile and build job |

### Authentication Model: Invite-Only

The app uses an **invite-only** authentication model — there is no self-service sign-up screen. Users receive an email invitation from the tour organizing team, which includes a temporary password. On first login, the user is required to change their password via the Cognito new-password challenge flow.

At the Cognito User Pool level, this is enforced by setting `allowAdminCreateUserOnly: true`. The app itself never presents a sign-up form.

**Implications for generic app distribution (invite-only model):**
- The invite email is a natural and already-trusted channel for delivering the org code or setup link to the user
- There is no risk of uninvited users self-registering and attempting to access the wrong organizer's system
- The app's auth screens are simplified: login, change-temporary-password, and (optionally) forgot-password only

---

## Options Analysis

### Option 1: Shared AWS Infrastructure (Single Tenant)

All organizers share **one AWS account** managed by the app publisher. Isolation is achieved at the data layer — each tour gets its own `tourId` namespace in DynamoDB.

**How it works:**
- One Cognito User Pool with organizer-specific user groups
- One API Gateway / Lambda deployment serving all organizers
- `tourId` carries the organizer context in every API request
- One app build with one set of `EXPO_PUBLIC_` values

**Pros:**
- Truly single binary — no per-organizer build or config needed
- No changes to app startup or onboarding flow
- Simplest to operate

**Cons:**
- **No AWS isolation** — all organizer data lives in one AWS account; a breach or misconfiguration affects all organizers
- **Shared cost** — publisher bears all AWS costs and must bill organizers separately
- **Ownership ambiguity** — organizer cannot independently manage their AWS resources
- **Compliance risk** — organizers with data-residency or privacy requirements cannot comply independently
- Does not meet the stated goal of "each organizer uses their own dedicated AWS subscription"

**Verdict:** ❌ Does not meet the requirement of per-organizer AWS isolation.

---

### Option 2: Runtime Configuration via Bootstrap Service

The app ships with **only a single, stable bootstrap URL** baked in. All organizer-specific AWS config is fetched at runtime during first launch.

**How it works:**

1. The published app contains only a `BOOTSTRAP_SERVICE_URL` constant (e.g., `https://config.checkin-app.example.com`).
2. The tour organizer's invite email to each user includes the **Organization Code** (e.g., `TOURFRANCE-2026`) alongside the temporary Cognito password.
3. On first launch, the app presents an **Organization Setup screen** pre-prompted for the org code.
4. The user types or pastes the org code from their invite email and taps **Continue**.
5. The app calls `GET /config/{orgCode}` on the bootstrap service.
6. The bootstrap service returns the organizer's AWS configuration (Cognito pool IDs, API URL, region).
7. The app stores this config securely via `expo-secure-store`.
8. `Amplify.configure()` is called with the fetched values before any auth or API operation.
9. All subsequent app launches skip the setup screen and use the stored config.

> **Enhanced variant (recommended):** The invite email includes a **deep link** that, when tapped on the device, opens the app and auto-populates the org code — eliminating manual entry entirely. Falls back to manual entry if the user opens the email on a desktop.
>
> For production, use **HTTPS-based Universal Links (iOS) / App Links (Android)** (e.g., `https://setup.checkin-app.example.com/setup?orgCode=TOURFRANCE-2026`) rather than custom URL schemes (e.g., `checkinapp://setup?orgCode=…`). HTTPS-based links require domain ownership verification and are resistant to link-hijacking by other apps; custom schemes have no such verification.

**Pros:**
- **Single app binary** in Play Store / App Store — one build serves all organizers
- **Each organizer has full AWS isolation** — their own Cognito, their own API, their own DynamoDB
- **Invite-only model integrates naturally** — the org code is delivered in the same invite email as the temporary password; users receive everything they need in one communication
- **Deep link variant eliminates manual entry** — tapping the setup link from the invite email auto-configures the app
- Organizer onboarding is self-service: they register their config in the bootstrap service
- The bootstrap service itself can be very simple and inexpensive (a Lambda + DynamoDB or even a static JSON file on S3)
- `Amplify.configure()` already supports dynamic (runtime) configuration — no Amplify API changes needed

**Cons:**
- Requires a **central bootstrap service** to be built and maintained by the app publisher
- Bootstrap service is a dependency: if it is unavailable, new installs cannot complete setup (existing configured installs are unaffected — config is cached in `expo-secure-store`)
- Config values returned by the bootstrap service must not include actual secrets (User Pool IDs and API URLs are not secrets — see Security Considerations below)
- Deep link variant requires Universal Link (iOS) / App Link (Android) configuration in `app.json` and the organizer's domain

**Verdict:** ✅ **Feasible — viable alternative to Option 3.** Preferred when the organizer expects to change their AWS configuration after initial rollout (e.g., Cognito pool migration) without needing to re-issue invite links. Adds publisher infrastructure overhead that Option 3 avoids.

---

### Option 3: Configuration via Setup QR Code / Deep Link

The organizer distributes a **setup deep link** (embedded in the invite email) or a **QR code** that encodes all AWS config values directly. The user taps/scans it once; the app extracts, validates and stores the config locally.

**How it works:**

1. App publisher provides a one-time tool (a simple script or web form) to generate a setup deep link / QR code from the organizer's AWS config values.
2. Organizer includes the setup deep link (and/or QR code) in the **email invite** sent to each user, alongside the temporary Cognito password.
3. On first launch, the app checks for an incoming deep link **or** presents a **Scan Setup Code** screen.
4. User taps the deep link from their email on the device (or scans the QR code); the app decodes the config payload, validates it and stores it via `expo-secure-store`.
5. `Amplify.configure()` is called with the stored values.
6. All subsequent app launches skip setup and use the stored config.

> **With invite-only onboarding, the setup link is not a separate distribution problem** — it is already in the same email the user must read to get their temporary password. Users receive exactly one email that contains everything needed to get started.

**Pros:**
- **No central publisher-maintained service** — once the app is published, the publisher has no ongoing infrastructure to operate or pay for
- **Each organizer is fully independent** — the organizer generates their own setup link/QR and distributes it; the publisher does not need to be involved at all after app publication
- **Works on first install without any network call** — config is read from the deep link payload before any login attempt
- Config stored in `expo-secure-store` (Android Keystore / iOS Keychain) — OS-level encryption at rest
- Invite-only model means the setup link is delivered through a trusted, controlled channel

**Cons:**
- Config values are visible in the deep link URL / QR code (see Obfuscation Analysis below)
- If AWS config changes (e.g., Cognito pool migration), the organizer must regenerate the setup link and re-send invites to all affected users — existing installed users are unaffected (they already have config stored)
- Deep link variant requires Universal Link (iOS) / App Link (Android) configuration in `app.json` and the hosting domain

**Verdict:** ✅ **Feasible and recommended** for this use case. With invite-only onboarding, the distribution and friction concerns that applied to Option 3 when sign-up was open are fully resolved. The absence of any publisher-maintained service makes this the most operationally lightweight option.

#### QR Code / Deep Link — Obfuscation Analysis

> *"Are there any kind of obfuscation possible for the exposed values in QR code?"*

**What values are exposed:** The setup payload contains `userPoolId`, `userPoolClientId`, `identityPoolId`, `apiBaseUrl`, and `awsRegion`.

**Are these values secret?** No — they are **resource identifiers, not credentials**:
- Cognito User Pool IDs identify a pool but do not grant access to it
- Authentication still requires a valid username and password (which are never stored in the QR code or app bundle)
- With `allowAdminCreateUserOnly: true` on the Cognito User Pool, an attacker who reads the QR code cannot create an account — they can only attempt to log in with credentials they do not have

**Obfuscation options and their actual value:**

| Technique | How it works | Actual security gain |
|-----------|-------------|---------------------|
| Base64 encoding | Encode the JSON payload as Base64 in the URL/QR | None — Base64 is reversible in one step; provides no security |
| Symmetric encryption with app-embedded key | Encrypt payload; decrypt key is baked into the app bundle | Very low — the decryption key is in the Expo JS bundle and can be extracted with basic tooling |
| HMAC signature (integrity, not secrecy) | Sign the payload so the app can verify it was issued by the publisher | Protects against tampered QR codes (e.g., a malicious substitute); does not hide values |

**Conclusion on obfuscation:** Obfuscation of the config values in the QR code / deep link provides no meaningful security improvement, because the values themselves are not secrets. The correct security control is at the **Cognito layer** (`allowAdminCreateUserOnly: true`), not at the config-visibility layer. That said, adding an **HMAC signature** to the payload is worthwhile for a different reason — it ensures the app only accepts setup links genuinely issued by the publisher, preventing a malicious QR code from pointing the app at a fraudulent AWS environment.

**Recommended payload format (with signature):**

```
https://setup.checkin-app.example.com/setup
  ?payload=BASE64(JSON_CONFIG)
  &sig=HMAC_SHA256(BASE64(JSON_CONFIG), PUBLISHER_SECRET)
```

- `payload`: Base64-encoded JSON config (for URL safety, not security)
- `sig`: HMAC-SHA256 signature computed with a publisher-held secret — the app verifies this before accepting the config
- The HMAC verification key is baked into the app bundle (acceptable since HMAC only needs the key to verify, not to create new valid signatures at scale)

---

### Option 4: Dedicated App Build per Organizer (Status Quo)

Each tour organizer receives a custom build of the app with their AWS config baked into the `EXPO_PUBLIC_` variables. The builds may share the same package name or each have a unique one.

**How it works:**
- Organizer provides their AWS config values
- Publisher runs a new EAS Build with that organizer's `.env` overrides
- Resulting binary is either published to Play Store under a separate listing, or distributed via direct APK / MDM

**Pros:**
- Maximum isolation — each organizer's app is completely independent
- Simplest code architecture — no runtime config machinery needed
- Familiar Expo/EAS workflow

**Cons:**
- **Does not scale** — a new build, review cycle, and Play Store submission is required per organizer
- Play Store listing management becomes complex with multiple apps or tracks
- Any app-code update requires rebuilding every organizer's binary
- High maintenance overhead for the publisher

**Verdict:** ❌ Does not meet the goal of a single Play Store app usable by multiple organizers without per-build effort.

---

## Comparison Matrix

| Criterion | Option 1 (Shared AWS) | Option 2 (Bootstrap Service) | Option 3 (Setup QR / Deep Link) | Option 4 (Dedicated Build) |
|-----------|----------------------|------------------------------|---------------------------------|---------------------------|
| Single app binary | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| Per-organizer AWS isolation | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| No build per organizer | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| Publisher infrastructure after release | ❌ None | ⚠️ Bootstrap service required | ✅ None | ❌ None |
| Onboarding friction (invite-only) | Low | Very Low (deep link in invite email) | Very Low (deep link/QR in invite email) | Low |
| Security posture | Low isolation | ✅ High | ✅ High (values not secret; invite-only blocks unauthorized access) | ✅ High |
| Organizer self-service | ❌ No | ✅ Yes | ✅ Yes (no publisher action needed) | ❌ No |
| Config change handling | N/A | ✅ Update bootstrap record; no user action | ⚠️ Organizer regenerates setup link; existing installs unaffected | N/A |
| Works without network on first setup | N/A | ❌ Network call to bootstrap required | ✅ Config in deep link payload | N/A |
| Implementation effort | Low | Medium | Low–Medium | None (current) |

---

## Recommendation

> **Recommended approach: Option 3 — Setup Deep Link / QR Code in invite email**
>
> **Alternative: Option 2 — Runtime Bootstrap Service** (if future config-change flexibility without re-issuing invites is required)

### Why Option 3 is now recommended

With invite-only onboarding, the two concerns that originally made Option 3 lower-ranked are resolved:

| Concern (original) | Status with invite-only model |
|--------------------|-------------------------------|
| "User must have the QR code available at install time" | ✅ Resolved — the setup link is in the invite email the user must open to get their password |
| "Higher friction than typing an org code" | ✅ Resolved — tapping a deep link in email is equal to or lower friction than typing a code |

What remains is the **config-change redistribution** concern: if an organizer migrates their Cognito pool, they must regenerate the setup link and re-send it to users who need to reinstall. However:
- AWS configuration changes of this kind are rare and planned
- Only users who are *newly installing or reinstalling* the app need the updated link; existing installed users are unaffected (their config is stored in `expo-secure-store`)
- The organizer already has the invite email infrastructure in place; re-sending to a subset of users is a low-effort operation

Option 3 requires **no publisher infrastructure to build, host or maintain** after the app is published. This is the decisive advantage for this use case.

**Option 2 remains a valid alternative** if the publisher anticipates needing to update organizer configs silently, without any user action. It can also be adopted later if Option 3's config-change limitation proves problematic in practice.

The technical changes to the app are well-contained:
- Replace build-time `EXPO_PUBLIC_` Amplify config with deep link / QR payload decode + secure store
- Handle incoming deep link on app launch (Universal Link / App Link)
- Add a fallback **Scan Setup Code** screen for users without the email link to hand
- Remove the sign-up screen entirely — the app's auth flow is login, new-password challenge (on first login), and forgot-password only
- `Amplify.configure()` already supports being called with runtime values — no Amplify API changes needed

### Invite-Only Authentication Impact

Removing self-service sign-up has the following implications for the app:

| Area | Change |
|------|--------|
| Auth screens | Remove sign-up screen; keep login, new-password challenge, forgot-password |
| Cognito User Pool | Set `allowAdminCreateUserOnly: true`; organizer creates users via AWS Console or API |
| Invite email | Organizer team sends email with temporary password **and** org code (or setup deep link) |
| App onboarding | User installs app → taps setup link from email (or scans QR code) → config stored automatically → logs in with temporary password → changes password |
| RBAC | Role assignment is done by the Administrator after the user is created in Cognito. If a user logs in before a role is assigned, the app must handle this gracefully — either block access with an explanatory message ("Your account is awaiting role assignment. Please contact your administrator.") or treat the absence of a role as a read-only Guest role. This behaviour must be defined during Phase 4 implementation. |

### Dedicated App vs. Single App — Security Trade-off

The question raised in the issue — *"Is it better to have a dedicated App for security and clear isolation?"* — is worth addressing directly.

A dedicated build (Option 4) adds **code-level isolation** (each binary carries only one organizer's credentials), but this provides minimal real security benefit because:
- Cognito User Pool IDs and API base URLs are **not secrets** — they identify a resource but do not grant access to it
- Authentication still requires valid Cognito credentials (username + password), which are not embedded in the app
- A malicious actor can extract User Pool IDs from any Expo bundle with basic tooling regardless of which option is chosen
- **With invite-only authentication**, there is no way for an uninvited person to create an account even if they know the User Pool ID — further neutralising the only remaining argument for code-level isolation

The meaningful security isolation comes from the **AWS account boundary** (separate Cognito pools, separate DynamoDB, separate IAM policies), which is preserved in both Option 2 and Option 3.

**Conclusion:** For this use case, a single app binary with runtime configuration provides equivalent security to a dedicated build, with substantially less operational overhead. The invite-only model removes the last viable argument for per-organizer builds on security grounds.

---

## Technical Design: Recommended Approach

This section outlines the high-level technical design for Option 3 (Setup Deep Link / QR Code), to be used as the basis for implementation when approved.

### Invite Email Setup Link

The organizer uses a publisher-provided tool (a simple web form or CLI script — run once per organizer, not hosted permanently) to generate a **setup deep link** and/or **QR code** from their AWS config values.

**Setup link format:**

```
https://setup.checkin-app.example.com/setup
  ?payload=<BASE64_JSON_CONFIG>
  &sig=<HMAC_SHA256_SIGNATURE>
```

Where `BASE64_JSON_CONFIG` is the Base64-encoded form of:

```json
{
  "orgCode": "TOURFRANCE-2026",
  "orgName": "Tour de France 2026 (Non-Competitive)",
  "awsRegion": "eu-west-1",
  "userPoolId": "eu-west-1_XXXXXXXXX",
  "userPoolClientId": "XXXXXXXXXXXXXXXXXXXXXXXXXX",
  "identityPoolId": "eu-west-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "apiBaseUrl": "https://<api-id>.execute-api.eu-west-1.amazonaws.com/v1"
}
```

**Concrete example of a generated setup link:**

```
https://setup.checkin-app.example.com/setup
  ?payload=eyJvcmdDb2RlIjoiVE9VUkZSQU5DRS0yMDI2Iiwib3JnTmFtZSI6Ii4uLiJ9
  &sig=a3f4b2c1d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1
```

- `payload` is the standard URL-safe Base64 of the JSON config string
- `sig` is the hex-encoded HMAC-SHA256 of the `payload` string, computed with a publisher-held signing key

The app verifies the HMAC signature when first processing a setup link. Config that has already been verified and stored in `expo-secure-store` does not need re-verification on subsequent launches — the OS-level encryption of the Keystore/Keychain protects it from tampering at rest.

The same URL, encoded as a QR code, serves users who receive the email on a desktop and scan with their phone.

The `setup.checkin-app.example.com` domain serves an **Apple App Site Association** / **Digital Asset Links** file to enable Universal Links (iOS) / App Links (Android). The domain does not need to serve a backend API — a static file on S3 + CloudFront is sufficient.

### QR Code — Obfuscation Analysis

See the full analysis in [Option 3 above](#option-3-configuration-via-setup-qr-code--deep-link). Summary:

- Config values (User Pool IDs, API URLs) are **resource identifiers, not credentials** — they do not grant access on their own
- Base64 encoding provides URL safety, not security
- Encrypting with an app-embedded key provides only marginal security (key is extractable from the bundle)
- The effective security control is `allowAdminCreateUserOnly: true` on each Cognito User Pool
- **HMAC signature on the payload** is recommended — not to hide values, but to prevent forged setup links that could redirect the app to a malicious AWS environment

### App First-Launch Flow

```
App Start
    │
    ▼
[Check expo-secure-store for stored org config]
    │
    ├─ Config found ──► [Call Amplify.configure(storedConfig)] ──► Login screen
    │
    └─ No config ────► [Check for incoming deep link (setup link from invite email)]
                            │
                  ┌─────────┴──────────┐
                  │ Deep link present  │  No deep link
                  │ (payload + sig)    │
                  └─────────┬──────────┘
                            │                    │
                     [Verify HMAC sig]   [Show OrgSetupScreen]
                            │            [User scans QR code]
                            │                    │
                            └────────────────────┘
                                         │
                                  [Decode config payload]
                                         │
                                  [Validate & store in expo-secure-store]
                                         │
                                         ▼
                                  [Call Amplify.configure(config)]
                                         │
                                         ▼
                                  [Login screen]
                                         │
                                  [User enters credentials from invite email]
                                         │
                                  [New-password challenge (first login only)]
                                         │
                                         ▼
                                  [Normal app flow]
```

### Reinstall and New-Device Scenario

> *"Need to address the open point where a user uninstalls the App and installs again, or starts using a new mobile phone after registering on the old phone."*

**How `expo-secure-store` behaves:**

`expo-secure-store` uses Android Keystore / iOS Keychain. On both platforms:
- Data stored in `expo-secure-store` is **deleted when the app is uninstalled** (Android and iOS both clear the Keystore/Keychain entry scoped to the app on uninstall)
- Data does **not transfer to a new device** — it is device-bound by the OS security model

This means after reinstall or on a new device, the user is presented with the setup screen again, as if it were a fresh install.

**Impact and resolution per option:**

| Scenario | Option 3 (Recommended) | Option 2 (Alternative) |
|----------|------------------------|------------------------|
| User reinstalls the app on the same phone | Setup screen shown; user taps the setup link from their original invite email — still valid | Setup screen shown; user enters org code again |
| User switches to a new phone | Setup screen shown; user taps the setup link from invite email on new device | Setup screen shown; user enters org code on new device |
| User deleted the invite email | User contacts their tour organizer to resend the invite / setup link | User contacts tour organizer to provide the org code |
| Organizer AWS config has changed since original invite | **App cannot detect this automatically** — the stored config is used as-is. If config changes cause authentication failures (e.g., old User Pool ID no longer valid), the app will fail at login. The organizer must notify affected users and re-send the setup link. Newly installing users will receive the updated link. This is a known limitation of Option 3 vs. Option 2. | Org code still works; bootstrap service returns latest config automatically |

**For Option 3, the key user expectation to set:** The invite email is the persistent record of the setup link. Users should be advised to keep the invite email accessible (or note the setup link separately) in case they need to reinstall. This is a standard pattern used by many apps that encode setup tokens in invite emails (e.g., authenticator apps with QR code backup sheets).

**Organizer guidance to include in invite email:**

> *"Save this email — you will need the setup link again if you reinstall the app or switch to a new device."*

### Dynamic Amplify Configuration

AWS Amplify Gen 2 supports `Amplify.configure()` being called at runtime with values that are not known at build time. The `src/config/amplify.ts` module will need to change from:

```typescript
// Current (build-time): values from EXPO_PUBLIC_ env vars
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_AWS_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID!,
      identityPoolId: process.env.EXPO_PUBLIC_AWS_IDENTITY_POOL_ID,
    },
  },
});
```

to a function that accepts runtime values:

```typescript
// Proposed (runtime): values fetched and stored at first launch
export function configureAmplify(config: OrgConfig): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        identityPoolId: config.identityPoolId,
      },
    },
  });
}
```

This is called once per app session after the config is loaded from `expo-secure-store` or fetched from the bootstrap service.

### Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Config values visible in QR code / deep link | Values are identifiers, not credentials; not secrets — see Obfuscation Analysis above |
| Forged setup link redirecting app to malicious backend | HMAC-SHA256 signature on the payload; app rejects any link without a valid signature |
| Config values in secure store | `expo-secure-store` uses Android Keystore / iOS Keychain — OS-level encryption |
| User Pool ID exposure | User Pool IDs identify the pool but authentication still requires valid Cognito credentials |
| Organizer data isolation | Preserved — each organizer has their own Cognito pool and DynamoDB; the app merely discovers which pool to use at runtime |
| Unauthorized account creation | **Eliminated by invite-only model** — Cognito User Pool is configured with `allowAdminCreateUserOnly: true`; knowing the User Pool ID is not sufficient to gain access |
| Deep link hijacking by another app | Use HTTPS-based Universal Links (iOS) / App Links (Android) — requires domain ownership verification; custom URL schemes (`app://`) do not provide this protection |

---

## Implementation Effort Estimate

> This is a rough estimate for planning purposes.

| Work Item | Effort |
|-----------|--------|
| Publisher tool to generate setup deep link / QR code (one-time script) | 0.5 days |
| Universal Link / App Link configuration (`apple-app-site-association`, `assetlinks.json`, `app.json`) | 0.5 days |
| Deep link handler in app (decode payload, verify HMAC, store config) | 1 day |
| Fallback `OrgSetupScreen` with QR code scanner | 1–1.5 days |
| Refactor `src/config/amplify.ts` for runtime config | 0.5 days |
| App startup flow (load config from store before auth) | 0.5 days |
| `expo-secure-store` integration for config persistence | 0.5 days |
| Remove sign-up screen; implement new-password challenge | 0.5 days |
| Testing across organizer configs | 1 day |
| **Total** | **~6–7 days** |

---

## Decision Required

Before implementation can begin, the following decisions need to be made:

1. **Confirm approach**: Proceed with Option 3 (Setup Deep Link / QR Code in invite email)?
2. **Hosting domain for Universal/App Link files**: Which domain will host the `apple-app-site-association` and `assetlinks.json` files? (e.g., `setup.checkin-app.example.com` on S3 + CloudFront — minimal cost, no backend needed)
3. **HMAC signing key**: How is the publisher's HMAC signing key managed and rotated? (Can be a static secret in the publisher's key management store for the initial release)
4. **Invite email delivery**: Will the invite email include (a) a deep link only, (b) a QR code only, or (c) both? Who sends the invite — tour organizer manually, or via an automated Cognito post-confirmation trigger?
5. **Reinstall guidance**: Should the invite email include an explicit instruction to keep the email for future reinstalls? Or should the organizer provide a "re-send setup link" self-service mechanism?

---

## Related Documentation

- [Solution Design → App Distribution](SolutionDesign.md#app-distribution--runtime-configuration-single-app-multiple-organizers) — Implementation design for the chosen approach (Option 3)
- [Requirements](Requirements.md) — Functional requirements
- [Development Guide → Environment Configuration](development-guide.md#environment-configuration) — Current env variable setup
- [Issue #11](https://github.com/kvijay77-in/poc-app/issues/11) — Auth integration context

---

[← Back to README](../README.md)
