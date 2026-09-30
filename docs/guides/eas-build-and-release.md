# EAS build and release guide

_Last updated: 2026-09-30_

This is the step-by-step reference for building, submitting and distributing the two rider apps with Expo Application Services (EAS). The design and its reasoning are in [App variants and environments](../design/app-variants-and-environments.md).

| Variant | Build profile | EAS environment | Identifier | Store track |
|---|---|---|---|---|
| Test | `test` (`adhoc` for emergencies) | `preview` | `com.tourrider.app.dev` | TestFlight external / Play internal |
| Production | `production` | `production` | `com.tourrider.app` | TestFlight → App Store / Play closed (alpha) → production |

OTA updates (EAS Update) are **not** used. Every change ships as a store build.

## 1. Prerequisites

- Node.js LTS and npm. Run `npm ci` in the repository.
- An Expo account that is a member of the `kvijay77.in` owner, plus an Apple Developer Program membership and a Google Play developer account.
- Do **not** install Expo CLI or EAS CLI globally. Use `npx`:

```bash
npx eas-cli@latest login
npx eas-cli@latest whoami
```

The examples below write `eas` for brevity; run them as `npx eas-cli@latest <command>`.

## 2. Link the EAS project (once)

```bash
eas init
```

`eas init` creates or links the `tour-rider-app` project under the `kvijay77.in` owner. Replace `<EAS_PROJECT_ID>` in `app.json` (`expo.extra.eas.projectId`) with the project ID it prints, and commit the change. Push notifications are skipped while the placeholder is still there.

`eas.json` uses `"appVersionSource": "remote"`, so EAS stores build numbers. Set the starting values once for each platform and profile. Both variants share the project, and each identifier has its own counter:

```bash
eas build:version:set -p ios --profile test
eas build:version:set -p android --profile test
eas build:version:set -p ios --profile production
eas build:version:set -p android --profile production
```

`autoIncrement` then increments the build number on each store build. The user-visible version is `expo.version` in `app.json`; raise it for each release.

### Check the variant locally

```bash
APP_VARIANT=test npx expo config --type public       # Tour Rider (Test), com.tourrider.app.dev, tour-rider-app-dev
APP_VARIANT=production npx expo config --type public # Tour Rider, com.tourrider.app, tour-rider-app
```

Check `name`, `scheme`, `ios.bundleIdentifier`, `android.package`, `icon` and `extra.appVariant`.

## 3. Store records (one per identifier)

### App Store Connect

For **each** of `com.tourrider.app.dev` and `com.tourrider.app`:

1. Certificates, Identifiers & Profiles → Identifiers → register the App ID with the **Push Notifications** capability.
2. App Store Connect → Apps → **+ New App**: platform iOS, name ("Tour Rider (Test)" / "Tour Rider"), bundle ID, SKU.
3. Copy the **Apple ID** (App Information → General) into `eas.json`: `submit.test.ios.ascAppId` replaces `<ASC_APP_ID_DEV>`, and `submit.production.ios.ascAppId` replaces `<ASC_APP_ID_PROD>`.
4. Under the version → App Store → Version Release, choose **Manually release this version**.
5. Complete App Privacy. Declare account deletion support.

### Google Play Console

For **each** of `com.tourrider.app.dev` and `com.tourrider.app`:

1. **Create app** with the same name as above; choose App and Free.
2. Complete **App content**: privacy policy, app access (give the demo login from §8), ads, content rating, target audience and **Data safety**. Under Data deletion, declare in-app account deletion and add the **web link** where users can request deletion.
3. Turn on **Managed publishing** (Publishing overview) so approved releases go live only when you choose.
4. Set up the testers lists for Internal testing (Test app) and Closed testing (Production app).

## 4. Credentials

Let EAS manage credentials. Review them with `eas credentials`.

**iOS**
- The distribution certificate and provisioning profiles are created on the first `eas build -p ios`, one profile per bundle ID. Inspect or regenerate them with `eas credentials -p ios`.
- **App Store Connect API key** (`.p8`, role **App Manager**): Users and Access → Integrations → Keys. Upload it with `eas credentials -p ios` → App Store Connect API Key, so that `eas submit` runs without prompts. Never commit `.p8` files (they are git-ignored).
- **APNs key:** one key is shared by the team's apps. Attach it to both bundle IDs in `eas credentials -p ios` → Push Notifications.

**Android**
- **Upload keystore:** EAS generates one per package on the first build. Download a backup with `eas credentials -p android` → Download credentials, and store it securely outside the repository.
- **Play App Signing:** accept Google-managed signing when you create the first release. The EAS keystore is then the upload key.
- **Google service account** for `eas submit`: create it in Google Cloud and grant it **Release** permissions (release to testing tracks and production) in Play Console → Users and permissions. Upload the JSON key with `eas credentials -p android` → Google Service Account.
- **FCM:** create a separate Firebase Android app for each package (`com.tourrider.app.dev` and `com.tourrider.app`). Upload the **FCM V1 service-account key** with `eas credentials -p android` → Push Notifications (FCM V1), once per package.
- **`google-services.json`:** store it as an EAS **file** variable with secret visibility, per environment:

```bash
eas env:create --environment preview --name GOOGLE_SERVICES_JSON --type file --visibility secret --value ./google-services.dev.json
eas env:create --environment production --name GOOGLE_SERVICES_JSON --type file --visibility secret --value ./google-services.prod.json
```

These files are git-ignored (`google-services*.json`). Delete the local copies after uploading.

## 5. Environment variables

| Variable | `preview` (Test) | `production` |
|---|---|---|
| `EXPO_PUBLIC_AWS_REGION`, `EXPO_PUBLIC_AWS_USER_POOL_ID`, `EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID`, `EXPO_PUBLIC_AWS_IDENTITY_POOL_ID` | Dev | Prod |
| `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL` | Dev | Prod |
| `EXPO_PUBLIC_ORGANIZER_ID`, `EXPO_PUBLIC_ORGANIZER_NAME` | same | same |
| `EXPO_PUBLIC_REVIEW_USERNAME` | **not set** | reviewer email |
| `EXPO_PUBLIC_REVIEW_AWS_REGION`, `EXPO_PUBLIC_REVIEW_AWS_USER_POOL_ID`, `EXPO_PUBLIC_REVIEW_AWS_USER_POOL_WEB_CLIENT_ID`, `EXPO_PUBLIC_REVIEW_AWS_IDENTITY_POOL_ID`, `EXPO_PUBLIC_REVIEW_TOUR_DATA_API_BASE_URL` | **not set** | Dev |
| `GOOGLE_SERVICES_JSON` (file, secret) | `.dev` Firebase file | prod Firebase file |

The `eas.json` profile sets `APP_VARIANT`, `EXPO_PUBLIC_SUBSCRIPTION_MODE`, `EXPO_PUBLIC_LOG_LEVEL` and `EXPO_PUBLIC_API_DEBUG_GET`, so do not create them in EAS environments. Get the values from the tour-data-api deployment outputs.

Create or update one variable:

```bash
eas env:create --environment production --name EXPO_PUBLIC_TOUR_DATA_API_BASE_URL \
  --value https://api.example.com --type string --visibility plaintext --force
eas env:list --environment preview
eas env:list --environment production
eas env:pull --environment preview   # writes .env.local for local inspection (git-ignored)
```

Push a whole file of values with the helper script. Keep one git-ignored file per environment:

```bash
tools/push-eas-env.sh --dry-run --file .env.preview preview
tools/push-eas-env.sh --file .env.preview preview
tools/push-eas-env.sh --file .env.production production
```

The script pushes only `EXPO_PUBLIC_*` keys, and skips empty values and profile-managed flags. That is why the `REVIEW_*` keys stay unset in `preview`. It never prints values.

## 6. `eas.json` reference

| Profile | Purpose | Key settings |
|---|---|---|
| `development` | Dev client for local debugging | `developmentClient`, internal, `environment: development`, `APP_VARIANT=test`, `LOG_LEVEL=DEBUG` |
| `test` | Test app store build | store, `environment: preview`, `autoIncrement`, `APP_VARIANT=test`, `LOG_LEVEL=WARN` |
| `adhoc` | Emergency iOS/Android internal build of the Test app | `extends: test`, `distribution: internal` |
| `production` | Production app store build | store, `environment: production`, `autoIncrement`, `APP_VARIANT=production`, `LOG_LEVEL=WARN` |

| Submit profile | iOS | Android |
|---|---|---|
| `test` | `ascAppId` of the Test app → TestFlight | `track: internal`, `releaseStatus: completed` |
| `production` | `ascAppId` of the Production app → TestFlight | `track: alpha` (closed testing), `releaseStatus: completed` |

The `channel` values are reserved for a future EAS Update rollout and have no effect today.

## 7. Build and submit

Run `npm run lint`, `npx tsc --noEmit` and `npm test -- --runInBand` first.

```bash
# Test app (Dev backend) → TestFlight + Play internal
eas build -p all --profile test --auto-submit

# Production app (Prod backend) → TestFlight + Play closed (alpha)
eas build -p all --profile production --auto-submit
```

You can also build first and submit later:

```bash
eas build -p ios --profile production
eas submit -p ios --profile production --latest
```

> **The first Android upload for each package must be manual.** Google Play does not accept API uploads until the app has one release. Download the `.aab` from the EAS build page. In Play Console → Testing → Internal testing (Test app) or Closed testing (Production app), create a release and upload it. After that, `eas submit` and `--auto-submit` work.

### Emergency iOS ad hoc build (Test app)

Use this only when TestFlight is unavailable, for example while Beta App Review is pending for an urgent fix.

```bash
eas device:create                       # register tester devices (share the link)
eas build -p ios --profile adhoc        # internal distribution, Test app identity
```

Share the install link from the build page. Devices must be registered before the build.

## 8. Verify a build

- The home screen name and icon match the variant. The Test app shows **Tour Rider (Test)**, the TEST icon, and the **TEST** strip on every screen.
- The startup log (INFO) prints `Variant: test|production, API host: …`. Check the host is the Dev or Prod API as expected.
- Sign in with a tester account (Test app → Dev pool) or a real rider account (Production → Prod).
- Production only: sign in with the reviewer email. Expect Dev data and **no** TEST strip. Sign out and sign in as a normal rider; expect Prod data.
- Push notifications arrive on each variant.
- Profile → **Delete my account** shows the warning, asks for the password, and shows the offline message when the device is offline. Try this with a throwaway account only.

## 9. Tester distribution

**iOS (TestFlight)**
1. App Store Connect → Test app → TestFlight → create an **External** group (e.g. "Riders").
2. Fill in **Test Information**: what to test, feedback email, and the **Dev demo login** for Beta App Review.
3. Add the build to the group. The first build of each version goes through Beta App Review. Invite testers by email or a public link.
4. TestFlight builds expire after **90 days**; rebuild before then.

**Android (Play internal testing)**
1. Play Console → Test app → Testing → Internal testing → Testers: create an email list (up to 100).
2. Share the **opt-in link**. Testers accept it, then install from Play.

**Android closed test before going live (Production app, D13)**
1. Play Console → Production app → Testing → Closed testing (alpha): add at least **12 testers** and share the opt-in link.
2. Keep at least 12 testers opted in for **14 continuous days**, testing against **Prod**.
3. Apply for production access (Dashboard → Apply for production).
4. After approval, **clean up Prod**: remove test tours, enrolments and accounts created during the closed test.

## 10. Store review submission

- **Apple:** App Store Connect → Production app → version → select the build → App Review Information. Enter the reviewer email and password (a Dev-pool user) and a note: "This account signs in to our review environment. Profile → Delete my account demonstrates account deletion." Submit, then **release manually** after approval.
- **Google:** Production app → Production → create a release from the closed-track build (promote), then send changes for review. Managed publishing lets you choose when it goes live.

## 11. Release checklist

- [ ] `expo.version` raised in `app.json`; changes merged to `main`.
- [ ] Lint, typecheck and tests pass.
- [ ] `eas env:list` checked for `preview` and `production`. `REVIEW_*` are set only in `production`.
- [ ] Test build on TestFlight and Play internal, verified by testers against Dev.
- [ ] Production build from the **same commit**; install check (§8) done.
- [ ] Reviewer account exists in the Dev pool and its password works. **Re-create it if it was deleted**, for example through Delete my account.
- [ ] Review notes and demo login updated in App Store Connect and Play App access.
- [ ] Data safety deletion web link still reachable.
- [ ] No TestFlight build that testers rely on is close to its 90-day expiry.
- [ ] Manual release / managed publishing: publish once both stores have approved.

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| `eas build` asks for a project or fails with a projectId error | Run `eas init` and replace `<EAS_PROJECT_ID>` in `app.json`. |
| Build uses the wrong backend | Check the profile's `environment` in `eas.json` and `eas env:list --environment <env>`. The startup log shows the API host. |
| Test app shows no TEST strip | `APP_VARIANT` is not `test`. Check the `test` profile env and `npx expo config --type public`. |
| `eas submit` Android fails with "package not found" | The first upload must be manual (§7). |
| `eas submit` iOS asks for the app | Set `ascAppId` in `eas.json` for that submit profile. |
| Duplicate build number rejected | `eas build:version:set` for that platform/profile, then rebuild. |
| No push on Android | `GOOGLE_SERVICES_JSON` is missing for that environment, or the FCM V1 key is not uploaded for that package. |
| No push on iOS | The APNs key is not attached to that bundle ID, or the Push capability is missing on the App ID. |
| Reviewer sees Prod data or cannot sign in | `EXPO_PUBLIC_REVIEW_*` is incomplete in `production` (routing is then off), or the reviewer user is missing from the Dev pool. |
| TestFlight build no longer installs | 90-day expiry. Build and submit again. |
