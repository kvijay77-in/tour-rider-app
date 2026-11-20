# Deployment

_Last updated: 2026-11-20_

[`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) builds the mobile apps on EAS and submits them to the App Store and Google Play. It runs only when started manually. The branch you run it on decides the environment.

| Branch | Environment | EAS build profile | App | EAS environment |
| --- | --- | --- | --- | --- |
| `develop` | dev | `test` | `com.tourrider.app.dev`, "Tour Rider (Test)" | `preview` |
| `main` | prod | `production` | `com.tourrider.app`, "Tour Rider" | `production` |

A run on any other branch or on a tag fails before it calls AWS or EAS.

**Production is not set up yet.** Its settings are placeholders, so a run on `main` stops in the first job with "Not configured for prod" and lists what is missing. See [Production readiness](#production-readiness).

Backend resources (Cognito, API, data, file storage) belong to [tour-data-api](https://github.com/kvijay77-in/tour-data-api/blob/main/docs/guides/deployment.md); this repository owns no AWS resources. The reasons behind this setup are in the [mobile deployment CI playbook](../misc/mobile-deploy-ci-playbook.md), and the Test and Production apps are described in [App variants and environments](../design/app-variants-and-environments.md).

## Prerequisites

Do these once per environment, in order. Each step lists who does it and how to check that it is done. Steps 1 to 5 cover dev; production repeats them as described in [Production readiness](#production-readiness).

### 1. Tools and access

- Node.js and npm per `package.json`; run `npm ci`.
- An Expo account with access to the `tour-rider-app` project under `kvijay77.in`, and access to App Store Connect and Google Play Console.
- Admin access to this GitHub repository to set secrets and variables. The `gh` CLI is optional.
- Optional, for the [local sync dry run](#eas-environment-sync): AWS CLI v2 and an AWS SSO profile for the dev account with `ssm:GetParametersByPath` on `/tour-data-api/dev/rider`.

### 2. Backend handover

**Who:** the tour-data-api team.

The backend publishes its values in SSM Parameter Store under `/tour-data-api/dev/rider/`: `region`, `cognito-user-pool-id`, `cognito-app-client-id` and `api-endpoint`. `identity-pool-id` is optional (see [EAS environment sync](#eas-environment-sync)). The team also sends the ARN of the `tour-data-api-rider-config-read-dev` role. Its trust allows `develop` and `main` of this repository; `main` needs it because the Production app routes the store reviewer to the dev backend. The GitHub OIDC provider already exists in the account.

**Done when** you have the ARN (it becomes `AWS_CONFIG_READ_ROLE_ARN_DEV`) and the parameters are listed:

```sh
aws ssm get-parameters-by-path --path /tour-data-api/dev/rider \
  --query 'Parameters[].Name' --output text --profile <dev>
```

### 3. Expo robot user

**Who:** Expo account owner.

1. In the Expo dashboard for the `kvijay77.in` account, give the robot user the **Developer** role. It must be able to read and write project environment variables. If the sync step reports a permission error, raise it to **Admin**.
2. Create an access token for the robot user. It becomes the `EXPO_TOKEN` secret. The token can write every EAS environment; the workflow and sync script stop it from writing `production` outside `main`.

**Done when** you have the token.

### 4. Store records and credentials

**Who:** release owner.

CI cannot answer prompts, and the build uses `--freeze-credentials`, so a CI build cannot create or change credentials. Everything must already be stored on EAS. The [EAS build and release guide](eas-build-and-release.md) has the details:

- [ ] App Store Connect and Play Console records for `com.tourrider.app.dev` ([§3](eas-build-and-release.md#3-store-records-one-per-identifier)), and `submit.test.ios.ascAppId` set in [`eas.json`](../../eas.json).
- [ ] iOS: distribution certificate, provisioning profile, App Store Connect API key and APNs key ([§4](eas-build-and-release.md#4-credentials)).
- [ ] Android: upload keystore, Google Play service account key and FCM V1 key ([§4](eas-build-and-release.md#4-credentials)).
- [ ] `GOOGLE_SERVICES_JSON` as a file variable in the `preview` EAS environment ([§4](eas-build-and-release.md#4-credentials)).
- [ ] On a brand-new Play listing, the first Android upload is manual (see [First dev run](#first-dev-run)).

**Done when** `npx eas-cli@latest credentials` shows the credentials for the `test` profile on both platforms, and `npx eas-cli@latest env:list preview` lists `GOOGLE_SERVICES_JSON`.

### 5. GitHub settings

**Who:** repository admin.

Go to Settings > Secrets and variables > Actions. Use repository-level secrets and variables, not GitHub Environments: an `environment:` key on a job changes its OIDC subject, and the backend roles then reject it.

**Dev (needed now):**

| Name | Kind | Value | From |
| --- | --- | --- | --- |
| `EXPO_TOKEN` | Secret | Robot user access token | [Step 3](#3-expo-robot-user) |
| `AWS_CONFIG_READ_ROLE_ARN_DEV` | Variable | `tour-data-api-rider-config-read-dev` ARN | [Step 2](#2-backend-handover) |
| `CONFIG_AWS_REGION` | Variable, optional | Region of the backend SSM parameters; default `ap-south-1` | [Step 2](#2-backend-handover) |
| `REVIEW_USERNAME` | Variable | Store reviewer login. Needed for production runs only; set it whenever convenient | [Production readiness](#production-readiness) |

**Production (placeholders until production is ready):**

| Name | Kind | Value when production is ready |
| --- | --- | --- |
| `AWS_CONFIG_READ_ROLE_ARN_PROD` | Variable | `tour-data-api-rider-config-read-prod` ARN, from the backend team |
| `submit.production.ios.ascAppId` | [`eas.json`](../../eas.json) | Numeric App Store Connect ID of `com.tourrider.app`; currently the placeholder `<ASC_APP_ID_PROD>` |

Leave the production variables unset until then. A value starting with `<` also counts as unset.

**Old tooling removed.** `tools/push-eas-env.sh`, which copied backend values from a local `.env` into EAS, has been removed. The workflow now takes the values from SSM on every run.

## First dev run

1. Merge the workflow to `develop` and `main`. GitHub offers a manually started workflow only when the file is on the default branch (`main`).
2. Optionally [preview the sync locally](#eas-environment-sync).
3. Run on `develop` with `submit` off. Check the sync summary: the first run removes the `EXPO_PUBLIC_REVIEW_*` variables from `preview` and updates any backend value that differs from SSM. Compare `npx eas-cli@latest env:list preview` with the values you set by hand before.
4. Delete the stale `EXPO_PUBLIC_STORE_REVIEW_USERNAME` from `preview` once; the app does not read it and the sync does not manage it:

   ```sh
   npx eas-cli@latest env:delete --variable-name EXPO_PUBLIC_STORE_REVIEW_USERNAME --variable-environment preview
   ```

5. On a brand-new Play listing, upload the AAB from step 3 manually in Play Console. Later runs can submit.
6. Run on `develop` with `submit` on, and follow the submissions in the EAS dashboard.

## Running a deployment

Go to Actions > **Deploy** > **Run workflow**, then choose the branch and the inputs:

| Input | Values | Effect |
| --- | --- | --- |
| `platform` | `all` (default), `android`, `ios` | Platforms to build |
| `submit` | on (default) / off | Submit each build to its store when it finishes (`--auto-submit`) |

The same run from the command line:

```sh
gh workflow run deploy.yml --ref develop
gh workflow run deploy.yml --ref develop -f platform=android -f submit=false
```

Runs on the same branch queue behind each other and are never cancelled midway. Each run installs, lints and tests, so watch the monthly Actions minutes.

Before distributing a build, check it as described in [Verify a build](eas-build-and-release.md#8-verify-a-build): sign-in, forced password change, profile, Delete my account and tour navigation against the expected backend.

### What a run does

1. **Resolve.** Maps the branch to the environment and checks that every setting the run needs is present (not empty and not a `<placeholder>`).
2. **Verify.** Runs `npm run lint`, `npm run typecheck` and `npm test`.
3. **Read backend config.** Assumes the tour-data-api read-only role through GitHub OIDC and reads `/tour-data-api/<env>/rider/*` from SSM. A run on `develop` reads the dev values. A run on `main` reads the prod values in a separate job, plus the dev values for store-reviewer routing.
4. **Mobile.** Installs the latest `eas-cli`, [syncs the EAS environment](#eas-environment-sync), then starts `eas build --non-interactive --no-wait --freeze-credentials`, adding `--auto-submit` when `submit` is on. The run does not wait for EAS. The run summary lists each queued build ID; follow builds and store submissions in the EAS dashboard.

## Reference

### EAS environment sync

[`tools/backend-config.mjs`](../../tools/backend-config.mjs) makes the EAS environment match the backend values before every build. It writes only variables whose value changed, and the run summary lists each variable as `unchanged`, `create`, `update`, `split`, `unlink` or `delete`.

| EAS variable | Test app (`preview`) | Production app (`production`) |
| --- | --- | --- |
| `EXPO_PUBLIC_AWS_REGION` | `dev/rider/region` | `prod/rider/region` |
| `EXPO_PUBLIC_AWS_USER_POOL_ID` | `dev/rider/cognito-user-pool-id` | `prod/rider/cognito-user-pool-id` |
| `EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID` | `dev/rider/cognito-app-client-id` | `prod/rider/cognito-app-client-id` |
| `EXPO_PUBLIC_TOUR_DATA_API_BASE_URL` | `dev/rider/api-endpoint` | `prod/rider/api-endpoint` |
| `EXPO_PUBLIC_AWS_IDENTITY_POOL_ID` | `dev/rider/identity-pool-id` if present | `prod/rider/identity-pool-id` if present |
| `EXPO_PUBLIC_REVIEW_AWS_REGION`, `_USER_POOL_ID`, `_USER_POOL_WEB_CLIENT_ID`, `_TOUR_DATA_API_BASE_URL` | Removed | Matching `dev/rider/*` value |
| `EXPO_PUBLIC_REVIEW_AWS_IDENTITY_POOL_ID` | Removed | `dev/rider/identity-pool-id` if present |
| `EXPO_PUBLIC_REVIEW_USERNAME` | Removed | GitHub variable `REVIEW_USERNAME` |

Paths are shortened: `dev/rider/region` means `/tour-data-api/dev/rider/region`.

Rules:

- **Validation.** A missing or empty required value fails the run before anything is written.
- **Branch guard.** `preview` is written only from `develop` and `production` only from `main`.
- **Variable types.** Values are written as plaintext string variables, because they are public and ship inside the app.
- **Identity pool.** The backend has no identity pool, so `EXPO_PUBLIC_AWS_IDENTITY_POOL_ID` is removed until `identity-pool-id` appears in SSM. The app works without it. That path name is this repo's assumption; it is not part of the backend contract.
- **Reviewer routing.** In `preview`, every `EXPO_PUBLIC_REVIEW_*` variable is removed. The Test app has no reviewer routing.
- **Unmanaged variables.** `GOOGLE_SERVICES_JSON` and any other variable not in the table are never touched. Manage them in the EAS dashboard or with `eas env:set`, and select a single environment.
- **Shared variables.** When the script finds a variable it manages that is linked to the target environment and others, it first unlinks the target environment, leaving the value in the others as it was. It then recreates the variable for the target environment only (`split` or `unlink` in the summary). On 2026-11-20 no variable was shared and `production` was empty. Unlinking uses `eas env:update`, which is deprecated. If a later `eas-cli` drops it, the run fails before any value is written.
- **Verification.** After writing, the script lists the environment again and fails if anything differs from the expected state.

Preview the changes locally without writing anything. This reads the real EAS environment, so you must be logged in with `npx eas-cli@latest login`:

```sh
SSM_PATH_DEV=/tour-data-api/dev/rider REVIEWER_ROUTING=true \
DEV_PARAMS="$(aws ssm get-parameters-by-path --path /tour-data-api/dev/rider \
  --query 'Parameters[].[Name,Value]' --output json --profile <dev>)" \
  node tools/backend-config.mjs sync-eas --environment preview --dry-run
```

### Build configuration

- [`app.json`](../../app.json) holds the static Expo settings. [`app.config.ts`](../../app.config.ts) sets the name, scheme, icons, bundle ID and package from `APP_VARIANT`, which the [`eas.json`](../../eas.json) build profile sets.
- The build profiles also set `EXPO_PUBLIC_SUBSCRIPTION_MODE`, `EXPO_PUBLIC_LOG_LEVEL` and `EXPO_PUBLIC_API_DEBUG_GET`. The optional `EXPO_PUBLIC_ORGANIZER_ID` and `EXPO_PUBLIC_ORGANIZER_NAME` (labels and logging) belong in the profile's `env` too. Never put backend values in a profile's `env`: they override the EAS environment.
- Distribute single-organizer builds (`EXPO_PUBLIC_SUBSCRIPTION_MODE=single`). The multi-organizer mode is not connected to the shipped sign-up flow.
- For local development, copy [`.env.example`](../../.env.example) to a git-ignored `.env` with Dev values. Store builds never read it.
- `EXPO_PUBLIC_*` values are embedded in the app. They must never contain credentials or secrets.

### Store submission

| Profile | iOS | Android |
| --- | --- | --- |
| `test` | TestFlight, app `6823939084` | Play internal testing, `releaseStatus: completed` (rolled out to internal testers) |
| `production` | `ascAppId` is the placeholder `<ASC_APP_ID_PROD>` | Play closed testing (`alpha`), `releaseStatus: draft` (released manually in Play Console) |

Release approval in the stores stays manual; see the [EAS build and release guide](eas-build-and-release.md#10-store-review-submission). Run `npx eas-cli@latest credentials` locally to fix or renew credentials.

## Local and emergency builds

Use the workflow normally. Building from a terminal is for emergencies only. A terminal build does not sync the EAS environment and has no branch guard, so check the environment first with the [sync dry run](#eas-environment-sync) and build only from an up-to-date `develop` or `main`:

```sh
npm run lint && npm run typecheck && npm test
npx eas-cli@latest build -p all --profile test --auto-submit
npx eas-cli@latest build -p all --profile production --auto-submit
```

For an emergency iOS ad hoc build of the Test app, see the [EAS guide](eas-build-and-release.md#emergency-ios-ad-hoc-build-test-app).

## Rollback

- **Production app.** Store releases are manual, so do not release the faulty build. Run the workflow again from the fixed commit.
- **Test app.** Play internal releases roll out to testers immediately (`completed`). Run the workflow again from the fixed commit; meanwhile, expire the TestFlight build in App Store Connect and, if needed, halt the release in Play Console.

## Production readiness

_Blocked until the prod AWS account is ready and the app is ready to go live._

**Before you start:**

- The prod AWS account exists, and a release owner is named.
- The backend has deployed its prod stacks, publishes `/tour-data-api/prod/rider/*` and has sent the `tour-data-api-rider-config-read-prod` ARN. Its trust allows `main` of this repository.

**Steps:**

1. Create the production store records and credentials for `com.tourrider.app`, and add the production `GOOGLE_SERVICES_JSON` to the `production` EAS environment, as in [step 4](#4-store-records-and-credentials).
2. Fill in the [production placeholders](#5-github-settings) and `REVIEW_USERNAME`. The `ascAppId` change in `eas.json` must reach `main` through `develop`.
3. Pre-create the reviewer account in the dev Cognito pool ([EAS guide](eas-build-and-release.md#10-store-review-submission)).
4. On a brand-new Play listing, run on `main` with `platform=android` and `submit` off, then upload the AAB to closed testing in Play Console.
5. Run on `main` with `submit` off. Check the `production` EAS environment with `npx eas-cli@latest env:list production`, including the `EXPO_PUBLIC_REVIEW_*` values.
6. Install the build and run the [checks](eas-build-and-release.md#8-verify-a-build): a normal rider uses Prod, and the reviewer email signs in to Dev with no TEST strip.
7. Run on `main` with `submit` on.
8. Run the Play closed test (at least 12 testers for 14 days against Prod), apply for production access, then clean the test data out of Prod ([EAS guide §9](eas-build-and-release.md#9-tester-distribution)).
9. Record the verified prod results (date, checks passed, deviations) and the release owner's responsibilities in this guide.

**Done when** the production builds reach their store tracks through the workflow, the checks pass and this guide records the results.

Until branch protection is added, anyone who can push to `main` can deploy to production.

## Later: branch protection

_Out of scope for now. On a private repository, branch protection needs a paid GitHub plan._

1. Add branch protection or rulesets on `develop` and `main`: require pull requests and block force pushes. The OIDC trust of the config-read roles is pinned to these branches, so protecting them protects deployment.
2. Optionally add a `pull_request` or `push` trigger to `deploy.yml`. `inputs.*` are empty on those events, so give them defaults first (for example `${{ inputs.platform || 'all' }}`). Never deploy from `pull_request` events of forks.
3. Do not move deployment jobs into GitHub Environments without first changing the backend role trust.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| **Resolve** | |
| No **Run workflow** button | The workflow file is not on `main` |
| "Run this workflow on develop (dev) or main (prod)" | You started it on another branch or a tag |
| "Not configured for dev/prod: ..." | Set the listed secret, variable or `eas.json` value ([GitHub settings](#5-github-settings)) |
| **AWS** | |
| "Could not assume role" / "Not authorized to perform sts:AssumeRoleWithWebIdentity" | Wrong role ARN, or the role does not trust this branch. Its trust `sub` must be exactly `repo:kvijay77-in/tour-rider-app:ref:refs/heads/<branch>`. Make sure no `environment:` key was added to the job |
| "Missing or empty SSM parameters" | The backend has not published that value; contact the backend team. Locally, also check that the profile points at the right account and region |
| **EAS sync and build** | |
| "may only be written from refs/heads/..." | Branch guard; run on the matching branch |
| "eas env:update failed" or "still linked" | `eas-cli` changed its unlink behaviour. Split the variable in the EAS dashboard (one variable per environment), then rerun |
| "Unexpected eas env:list output" | `eas-cli` changed its list format; update the parser in `tools/backend-config.mjs`, or pin `eas-cli@<last-good>` in the workflow's install step |
| "is a file variable; expected a string" | A managed name exists as a file variable; delete it in the EAS dashboard |
| Permission error | Give the robot user a higher role |
| Build fails on credentials | Run `npx eas-cli@latest credentials` locally for that profile and platform |
| Submission fails | See the build's submission in the EAS dashboard and the [EAS guide troubleshooting](eas-build-and-release.md#12-troubleshooting) |
