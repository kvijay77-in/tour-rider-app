# Mobile deployment CI playbook (Expo, EAS, GitHub Actions)

_Last updated: 2026-11-18. Derived from the tour-mgmt-app deployment workflow, with the web parts removed._

This playbook sets up one manually started GitHub Actions workflow that builds an Expo app on EAS and submits it to the App Store and Google Play. The branch decides the environment, and the backend values the app needs (`EXPO_PUBLIC_*`) are read from the backend's AWS SSM handover on every run. They are synced into EAS before the build, and only the values that changed are written.

It contains two files to copy into the target repository, the settings to fill in, and the reasons behind the design, which are mostly EAS and GitHub behaviours that are easy to get wrong.

## Contents

- [How it works](#how-it-works)
- [Why it is built this way](#why-it-is-built-this-way)
- [Prerequisites](#prerequisites)
- [Adapting it to a repository](#adapting-it-to-a-repository)
- [File: .github/workflows/deploy.yml](#file-githubworkflowsdeployyml)
- [File: tools/backend-config.mjs](#file-toolsbackend-configmjs)
- [AWS: config-read roles](#aws-config-read-roles)
- [GitHub settings](#github-settings)
- [Expo and store setup](#expo-and-store-setup)
- [First run](#first-run)
- [Troubleshooting](#troubleshooting)
- [Maintenance and known limits](#maintenance-and-known-limits)

## How it works

| Branch | Environment | EAS build profile | EAS environment | Backend values from |
| --- | --- | --- | --- | --- |
| `develop` | dev | `test` | `preview` | `SSM_PATH_DEV` in the dev AWS account |
| `main` | prod | `production` | `production` | `SSM_PATH_PROD` in the prod AWS account |

A run on any other branch or on a tag fails in the first job, before AWS or EAS is called.

The `test` profile builds against the EAS environment `preview` because the EAS free plan has only the fixed `development`, `preview` and `production` environments. Custom environment names need the Production or Enterprise plan.

### Inputs

| Input | Values | Effect |
| --- | --- | --- |
| `platform` | `all` (default), `android`, `ios` | Platforms to build |
| `submit` | on (default) / off | Adds `--auto-submit`, so EAS submits each build to its store when it finishes |

```sh
gh workflow run deploy.yml --ref develop
gh workflow run deploy.yml --ref develop -f platform=android -f submit=false
```

### Jobs

```
resolve ──┬── verify ─────────────────────┐
          ├── read-dev  (if needed) ──────┼── mobile: sync EAS env, then eas build --no-wait
          └── read-prod (if prod) ────────┘
```

1. **resolve** maps the branch to the environment. It then checks that every setting the run needs is present. An empty value, or one that starts with `<`, counts as missing. This is how placeholders block a run until production exists.
2. **verify** runs lint, typecheck and tests.
3. **read-dev** and **read-prod** each assume a read-only AWS role through GitHub OIDC and read the SSM parameters under their path. They are separate jobs, so the dev and prod credentials never share a runner. A `main` run reads dev values too only when reviewer routing is on ([below](#reviewer-routing-optional)).
4. **mobile** installs the latest `eas-cli`, runs `tools/backend-config.mjs sync-eas` and starts `eas build --non-interactive --no-wait --freeze-credentials`. The run summary lists the queued build IDs. Builds and store submissions continue on EAS after the run ends.

### EAS environment sync

`tools/backend-config.mjs` maps SSM leaf names to EAS variable names. With the default mapping:

| EAS variable | SSM leaf | Required |
| --- | --- | --- |
| `EXPO_PUBLIC_AWS_REGION` | `region` | yes |
| `EXPO_PUBLIC_AWS_USER_POOL_ID` | `cognito-user-pool-id` | yes |
| `EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID` | `cognito-app-client-id` | yes |
| `EXPO_PUBLIC_API_BASE_URL` | `api-endpoint` | yes |
| `EXPO_PUBLIC_AWS_IDENTITY_POOL_ID` | `identity-pool-id` | no; removed from EAS when absent in SSM |

For each variable, the script compares SSM with EAS and plans one action:

| Action | Meaning |
| --- | --- |
| `unchanged` | Same value, linked only to this environment; nothing is written |
| `create` | Not in this EAS environment yet |
| `update` | Different value or visibility |
| `split` | Linked to this and other environments: unlink this one, then create a copy for it alone |
| `unlink` / `delete` | Must be absent: remove this environment from a shared variable, or delete a variable linked only here |

After writing, the script lists the environment again and fails if anything differs. Variables it does not manage, such as `GOOGLE_SERVICES_JSON`, are never touched.

### Reviewer routing (optional)

Some apps let store reviewers sign in to the dev backend from the production app. With `REVIEWER_ROUTING: 'true'`:

- the `production` environment also gets every dev value under `EXPO_PUBLIC_REVIEW_*` (for example `EXPO_PUBLIC_REVIEW_API_BASE_URL`), plus `EXPO_PUBLIC_REVIEW_USERNAME` from the GitHub variable `REVIEW_USERNAME`;
- every `EXPO_PUBLIC_REVIEW_*` variable is removed from `preview`;
- a `main` run reads both the dev and the prod SSM values, so the dev config-read role must also trust `main`.

Leave it `'false'` if the app has no such routing. The script then never touches `EXPO_PUBLIC_REVIEW_*`.

## Why it is built this way

These are the behaviours that shaped the design. Keep them in mind when changing either file.

1. **EAS variables can be shared between environments.** One variable can be linked to `preview` and `production` at once. `eas env:set` finds an existing variable linked to the target environment, updates its value and adds the environment to its list. Writing a shared variable therefore changes production too. `eas env:delete` deletes the whole variable, not one environment's link. That is why the script splits shared variables: it unlinks first, checks that the unlink worked, and only then creates the copy.
2. **The unlink uses a deprecated command.** `eas env:update --variable-name N --variable-environment E --environment <others>` is the only non-interactive way to change a variable's environment list. If a future `eas-cli` removes it, the sync fails before any value is written.
3. **`eas env:list` has no JSON output.** The script parses `--format long` and fails on anything unexpected rather than guessing.
4. **An Expo token can write every environment.** The robot user's token is not scoped to `preview`. The workflow's branch mapping and the script's own branch guard (`preview` only from `develop`, `production` only from `main`) are what keep a dev run away from production.
5. **OIDC jobs must not use GitHub Environments.** Adding `environment:` to a job changes the OIDC subject from `repo:<org>/<repo>:ref:refs/heads/<branch>` to `repo:<org>/<repo>:environment:<name>`, and a role that trusts branch subjects then rejects it.
6. **Use `github.ref`, not `github.ref_name`.** A tag named `main` has `ref_name` `main`. Matching the full `refs/heads/main` rejects it.
7. **`workflow_dispatch` needs the file on the default branch.** GitHub shows "Run workflow" only when the workflow file exists on the default branch, even if you run it on `develop`.
8. **CI cannot answer prompts.** `--non-interactive` with `--freeze-credentials` means every signing credential must already be on EAS. A CI build never creates or changes credentials.
9. **`--no-wait` saves runner minutes.** A build takes far longer than the run that starts it. The trade-off is that build and submission failures show only in the EAS dashboard and EAS notifications, not in GitHub.
10. **`eas-cli` is not pinned.** Every run installs `eas-cli@latest`, as requested for the original repo. The parser and the deprecated `env:update` are what break first when the CLI changes; both fail loudly.
11. **Backend values travel as job outputs.** They are public values that ship inside the app, so plaintext job outputs are fine. Never route a real secret this way.
12. **Runs queue rather than cancel.** `concurrency` with `cancel-in-progress: false` stops two runs from syncing the same EAS environment at once, without killing a run halfway through a sync.
13. **Google Play draft apps.** While an app is still a draft in Play Console, Play rejects any release whose status is not `draft`. On a brand-new listing, the first AAB must be uploaded by hand in Play Console before `eas submit` works.

## Prerequisites

In the target repository:

- An Expo app built with EAS, with `package-lock.json` committed (the workflow uses `npm ci` and the npm cache).
- npm scripts for lint, typecheck and tests, or edits to the verify job.
- `eas.json` with `test` and `production` build profiles that each set `environment`, and matching submit profiles ([example](#easjson-example)).
- An `app.json` or `app.config.*` linked to an EAS project (`extra.eas.projectId`).

Outside it:

- The backend publishes its handover values as SSM `String` parameters under one path per environment.
- One read-only AWS role per backend account that trusts this repository's branches ([AWS: config-read roles](#aws-config-read-roles)).
- An Expo robot user with access to the project.
- Store credentials stored on EAS ([Expo and store setup](#expo-and-store-setup)).

## Adapting it to a repository

| What | Where | Default |
| --- | --- | --- |
| SSM paths | `env.SSM_PATH_DEV` / `SSM_PATH_PROD` in `deploy.yml` | `/<backend>/<env>/<app>` placeholders; a run fails until they are set |
| Reviewer routing | `env.REVIEWER_ROUTING` in `deploy.yml` | `'false'` |
| SSM leaf to EAS name mapping | `PRIMARY` and `OPTIONAL` in `backend-config.mjs` | The table [above](#eas-environment-sync) |
| Branch names | `case "$REF"` in the resolve job and `EAS_TARGETS` in the script | `develop`, `main` |
| Profile and EAS environment names | `case "$REF"` in the resolve job and `EAS_TARGETS` in the script | `test`/`preview`, `production`/`production` |
| SSM region | Repository variable `CONFIG_AWS_REGION` | `ap-south-1` |
| Checks | Verify job | `npm run lint`, `npm run typecheck`, `npm test` |
| Node version | `setup-node` steps | 24 |

When renaming branches or environments, change the workflow and the script together. The script enforces its own branch guard independently of the workflow.

The actions are pinned to commit SHAs (`checkout` v7.0.1, `setup-node` v7.1.0, `configure-aws-credentials` v6.3.0). Keep them pinned and update them deliberately.

## File: .github/workflows/deploy.yml

```yaml
name: Deploy
run-name: Deploy mobile (${{ inputs.platform }}) from ${{ github.ref_name }}

# Manual EAS Build + store submit. The branch chosen in "Run workflow" decides the environment:
#   develop -> dev:  EAS build profile `test`,       EAS environment `preview`
#   main    -> prod: EAS build profile `production`, EAS environment `production`
# Any other branch or tag fails before AWS or EAS is called.
#
# Backend values (EXPO_PUBLIC_*) are read from the backend's SSM handover on every run and synced
# to EAS. Jobs that assume AWS roles must not use `environment:`; it changes the OIDC subject and
# AWS rejects the role.

on:
  workflow_dispatch:
    inputs:
      platform:
        description: Mobile platform(s)
        type: choice
        options: [all, android, ios]
        default: all
      submit:
        description: Submit builds to the stores when they finish (--auto-submit)
        type: boolean
        default: true

permissions:
  contents: read

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

env:
  CONFIG_AWS_REGION: ${{ vars.CONFIG_AWS_REGION || 'ap-south-1' }}
  # EDIT: the backend's SSM handover paths (no trailing slash).
  SSM_PATH_DEV: /<backend>/dev/<app>
  SSM_PATH_PROD: /<backend>/prod/<app>
  # EDIT: 'true' if the production app routes store reviewers to the dev backend.
  REVIEWER_ROUTING: 'false'

jobs:
  resolve:
    name: Resolve environment
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      env: ${{ steps.map.outputs.env }}
      eas_env: ${{ steps.map.outputs.eas_env }}
      eas_profile: ${{ steps.map.outputs.eas_profile }}
      read_dev: ${{ steps.map.outputs.read_dev }}
      read_prod: ${{ steps.map.outputs.read_prod }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - id: map
        env:
          REF: ${{ github.ref }}
          PLATFORM: ${{ inputs.platform }}
          SUBMIT: ${{ inputs.submit }}
          HAS_EXPO_TOKEN: ${{ secrets.EXPO_TOKEN != '' }}
          CONFIG_ROLE_DEV: ${{ vars.AWS_CONFIG_READ_ROLE_ARN_DEV }}
          CONFIG_ROLE_PROD: ${{ vars.AWS_CONFIG_READ_ROLE_ARN_PROD }}
          REVIEW_USERNAME: ${{ vars.REVIEW_USERNAME }}
        run: |
          case "$REF" in
            refs/heads/develop) env=dev;  eas_env=preview;    eas_profile=test ;;
            refs/heads/main)    env=prod; eas_env=production; eas_profile=production ;;
            *) echo "::error::Run this workflow on develop (dev) or main (prod), not $REF"; exit 1 ;;
          esac
          routing=false; [[ "$REVIEWER_ROUTING" == true ]] && routing=true
          read_dev=false; read_prod=false
          [[ "$env" == dev ]] && read_dev=true
          [[ "$env" == prod ]] && read_prod=true
          [[ "$env" == prod ]] && $routing && read_dev=true

          # Fail fast when a setting is unset or still a <placeholder>.
          missing=()
          need() { [[ -n "$2" && "$2" != \<* ]] || missing+=("$1"); }
          [[ "$HAS_EXPO_TOKEN" == true ]] || missing+=("secret EXPO_TOKEN")
          if $read_dev; then
            [[ "$SSM_PATH_DEV" == /* && "$SSM_PATH_DEV" != *\<* ]] || missing+=("workflow env SSM_PATH_DEV")
            need "variable AWS_CONFIG_READ_ROLE_ARN_DEV" "$CONFIG_ROLE_DEV"
          fi
          if [[ "$env" == prod ]]; then
            [[ "$SSM_PATH_PROD" == /* && "$SSM_PATH_PROD" != *\<* ]] || missing+=("workflow env SSM_PATH_PROD")
            need "variable AWS_CONFIG_READ_ROLE_ARN_PROD" "$CONFIG_ROLE_PROD"
            $routing && need "variable REVIEW_USERNAME" "$REVIEW_USERNAME"
          fi
          if [[ "$SUBMIT" == true && "$PLATFORM" != android ]]; then
            need "eas.json submit.$eas_profile.ios.ascAppId" \
              "$(jq -r --arg p "$eas_profile" '.submit[$p].ios.ascAppId // empty' eas.json)"
          fi
          if (( ${#missing[@]} )); then
            echo "::error::Not configured for $env: ${missing[*]}"
            exit 1
          fi

          {
            echo "env=$env"; echo "eas_env=$eas_env"; echo "eas_profile=$eas_profile"
            echo "read_dev=$read_dev"; echo "read_prod=$read_prod"
          } >> "$GITHUB_OUTPUT"
          {
            echo "### Deploy plan"
            echo "| Branch | Environment | EAS profile | EAS environment | Platform | Submit |"
            echo "|---|---|---|---|---|---|"
            echo "| \`${REF#refs/heads/}\` | $env | \`$eas_profile\` | \`$eas_env\` | \`$PLATFORM\` | \`$SUBMIT\` |"
          } >> "$GITHUB_STEP_SUMMARY"

  verify:
    name: Lint, typecheck, test
    needs: resolve
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      # EDIT: match the repo's package.json scripts.
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test

  read-dev:
    name: Read dev backend config
    needs: resolve
    if: needs.resolve.outputs.read_dev == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      id-token: write
      contents: read
    outputs:
      params: ${{ steps.read.outputs.params }}
    steps:
      - uses: aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd # v6.3.0
        with:
          role-to-assume: ${{ vars.AWS_CONFIG_READ_ROLE_ARN_DEV }}
          aws-region: ${{ env.CONFIG_AWS_REGION }}
          retry-max-attempts: 3
      - id: read
        run: |
          params=$(aws ssm get-parameters-by-path --path "$SSM_PATH_DEV" \
            --query 'Parameters[].[Name,Value]' --output json | jq -c .)
          echo "Read $(jq length <<<"$params") parameter(s) from $SSM_PATH_DEV"
          echo "params=$params" >> "$GITHUB_OUTPUT"

  read-prod:
    name: Read prod backend config
    needs: resolve
    if: needs.resolve.outputs.read_prod == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      id-token: write
      contents: read
    outputs:
      params: ${{ steps.read.outputs.params }}
    steps:
      - uses: aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd # v6.3.0
        with:
          role-to-assume: ${{ vars.AWS_CONFIG_READ_ROLE_ARN_PROD }}
          aws-region: ${{ env.CONFIG_AWS_REGION }}
          retry-max-attempts: 3
      - id: read
        run: |
          params=$(aws ssm get-parameters-by-path --path "$SSM_PATH_PROD" \
            --query 'Parameters[].[Name,Value]' --output json | jq -c .)
          echo "Read $(jq length <<<"$params") parameter(s) from $SSM_PATH_PROD"
          echo "params=$params" >> "$GITHUB_OUTPUT"

  mobile:
    name: EAS sync + build
    needs: [resolve, verify, read-dev, read-prod]
    if: >-
      !cancelled()
      && needs.resolve.result == 'success'
      && needs.verify.result == 'success'
      && (needs.read-dev.result == 'success' || needs.resolve.outputs.read_dev != 'true')
      && (needs.read-prod.result == 'success' || needs.resolve.outputs.read_prod != 'true')
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
      EAS_CLI: eas
      EAS_ENV: ${{ needs.resolve.outputs.eas_env }}
      EAS_PROFILE: ${{ needs.resolve.outputs.eas_profile }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Install latest eas-cli
        run: npm install --global eas-cli@latest && eas --version && eas whoami

      - name: Sync EAS environment from backend config
        env:
          DEV_PARAMS: ${{ needs.read-dev.outputs.params }}
          PROD_PARAMS: ${{ needs.read-prod.outputs.params }}
          REVIEW_USERNAME: ${{ vars.REVIEW_USERNAME }}
        run: node tools/backend-config.mjs sync-eas --environment "$EAS_ENV"

      - name: Start EAS build
        env:
          PLATFORM: ${{ inputs.platform }}
          SUBMIT: ${{ inputs.submit }}
          MESSAGE: "GitHub run ${{ github.run_number }} (${{ github.ref_name }} ${{ github.sha }})"
        run: |
          args=(build --profile "$EAS_PROFILE" --platform "$PLATFORM" --non-interactive --no-wait
                --freeze-credentials --json --message "${MESSAGE:0:120}")
          [[ "$SUBMIT" == true ]] && args+=(--auto-submit)
          eas "${args[@]}" > builds.json
          {
            echo "### EAS builds queued (profile \`$EAS_PROFILE\`, submit \`$SUBMIT\`)"
            echo "| Platform | Build ID |"
            echo "|---|---|"
            jq -r '.[] | "| \(.platform) | \(.id) |"' builds.json
            echo
            echo "The run does not wait for the builds. Follow builds and store submissions in the EAS dashboard."
          } | tee -a "$GITHUB_STEP_SUMMARY"
```

## File: tools/backend-config.mjs

Node 18 or later, no dependencies.

```js
#!/usr/bin/env node
// Makes an EAS environment match the backend's SSM handover values.
//
//   node tools/backend-config.mjs sync-eas --environment preview|production [--dry-run]
//
// Inputs (environment variables):
//   SSM_PATH_DEV, SSM_PATH_PROD  SSM paths the values were read from, e.g. /my-backend/dev/my-app
//   DEV_PARAMS, PROD_PARAMS      JSON [[name, value], ...] from
//                                `aws ssm get-parameters-by-path --query 'Parameters[].[Name,Value]'`
//   REVIEWER_ROUTING             "true" to give the production app the dev values under
//                                EXPO_PUBLIC_REVIEW_* (store-reviewer routing); anything else turns it off
//   REVIEW_USERNAME              Store reviewer login; required for production when routing is on
//   EAS_CLI                      Optional eas command, e.g. "eas" after `npm i -g eas-cli@latest`.
//                                Default: npx --yes eas-cli@latest
//
// Safety rules:
//   - preview may be written only from develop, production only from main (dry runs excepted).
//   - A variable linked to several EAS environments is first unlinked from the target
//     environment (its value in the other environments is kept), then recreated for the
//     target only. Writing a shared variable would change every environment it is linked to.
//   - Variables not listed in PRIMARY/OPTIONAL (and not EXPO_PUBLIC_REVIEW_* when routing is on)
//     are never touched.

import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

// ---- Backend contract: EDIT THIS SECTION FOR EACH APP ----------------------------------------

/** [EAS name, SSM leaf]; all required. */
const PRIMARY = [
  ['EXPO_PUBLIC_AWS_REGION', 'region'],
  ['EXPO_PUBLIC_AWS_USER_POOL_ID', 'cognito-user-pool-id'],
  ['EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID', 'cognito-app-client-id'],
  ['EXPO_PUBLIC_API_BASE_URL', 'api-endpoint'],
];

/** [EAS name, SSM leaf]; set when present in SSM, removed from EAS when absent. */
const OPTIONAL = [['EXPO_PUBLIC_AWS_IDENTITY_POOL_ID', 'identity-pool-id']];

/** EAS environment -> the only branch allowed to write it. */
const EAS_TARGETS = { preview: { branch: 'develop' }, production: { branch: 'main' } };

// ---- Derived settings -----------------------------------------------------------------------

const REVIEW_PREFIX = 'EXPO_PUBLIC_REVIEW_';
const toReviewName = (name) => REVIEW_PREFIX + name.slice('EXPO_PUBLIC_'.length);
const reviewerRouting = process.env.REVIEWER_ROUTING === 'true';

// ---- Helpers --------------------------------------------------------------------------------

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command, dryRun: false };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--environment') opts.target = rest[(i += 1)];
    else fail(`Unknown argument: ${arg}`);
  }
  return opts;
}

function cleanValue(name, raw) {
  const value = String(raw ?? '').trim();
  if (/[\r\n]/.test(value)) fail(`${name} contains a line break`);
  return value;
}

function ssmPrefix(backendEnv) {
  const name = backendEnv === 'dev' ? 'SSM_PATH_DEV' : 'SSM_PATH_PROD';
  const path = (process.env[name] ?? '').trim().replace(/\/+$/, '');
  if (!path.startsWith('/')) fail(`${name} must be an SSM path such as /my-backend/${backendEnv}/my-app`);
  return `${path}/`;
}

/** Read one account's SSM values into { leaf: value }. */
function readParams(backendEnv) {
  const envVar = backendEnv === 'dev' ? 'DEV_PARAMS' : 'PROD_PARAMS';
  const raw = process.env[envVar];
  if (!raw) fail(`${envVar} is empty; the ${backendEnv} SSM read did not provide values`);
  let rows;
  try {
    rows = JSON.parse(raw);
  } catch {
    fail(`${envVar} is not valid JSON`);
  }
  if (!Array.isArray(rows)) fail(`${envVar} must be a JSON array of [name, value]`);
  const prefix = ssmPrefix(backendEnv);
  const values = {};
  for (const row of rows) {
    if (!Array.isArray(row) || typeof row[0] !== 'string') fail(`${envVar} has a malformed row`);
    if (!row[0].startsWith(prefix)) continue;
    values[row[0].slice(prefix.length)] = cleanValue(row[0], row[1]);
  }
  return { prefix, values };
}

/** Map one backend environment's values to EXPO_PUBLIC_* names; null means "must be absent". */
function backendValues(backendEnv) {
  const { prefix, values } = readParams(backendEnv);
  const missing = PRIMARY.filter(([, leaf]) => !values[leaf]).map(([, leaf]) => prefix + leaf);
  if (missing.length) fail(`Missing or empty SSM parameters: ${missing.join(', ')}`);
  const out = new Map();
  for (const [name, leaf] of PRIMARY) out.set(name, values[leaf]);
  for (const [name, leaf] of OPTIONAL) out.set(name, values[leaf] || null);
  return out;
}

/** Desired state of every variable this script manages in the given EAS environment. */
function desiredFor(target) {
  if (target === 'preview') return backendValues('dev');
  const desired = backendValues('prod');
  if (reviewerRouting) {
    // Production app: dev values under EXPO_PUBLIC_REVIEW_* so store reviewers can use the dev backend.
    for (const [name, value] of backendValues('dev')) desired.set(toReviewName(name), value);
    const reviewer = cleanValue('REVIEW_USERNAME', process.env.REVIEW_USERNAME);
    if (!reviewer) fail('REVIEW_USERNAME is required for the production EAS environment');
    desired.set(`${REVIEW_PREFIX}USERNAME`, reviewer);
  }
  return desired;
}

// ---- eas-cli --------------------------------------------------------------------------------

const easCommand = (process.env.EAS_CLI || 'npx --yes eas-cli@latest').split(/\s+/).filter(Boolean);

function eas(args) {
  const [bin, ...pre] = easCommand;
  const res = spawnSync(bin, [...pre, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  if (res.error) fail(`Could not run eas-cli: ${res.error.message}`);
  if (res.status !== 0) {
    const detail = `${res.stderr ?? ''}\n${res.stdout ?? ''}`.trim().split('\n').slice(-15).join('\n');
    fail(`eas ${args[0]} failed:\n${detail}`);
  }
  return res.stdout;
}

const LABEL_LINE = /^(ID|Name|Value|Scope|Visibility|Environments|type)\s{2,}(.*)$/;

/** Parse `eas env:list <env> --format long`. Fails loudly if the output format changes. */
function listVariables(target) {
  const out = eas(['env:list', target, '--format', 'long', '--include-sensitive', '--scope', 'project'])
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\r/g, '');
  if (!out.includes(`Environment: ${target}`)) fail('Unexpected eas env:list output (no environment header)');
  if (out.includes('No variables found for this environment.')) return [];
  if (!out.includes('Variables for this project:')) fail('Unexpected eas env:list output (no variables header)');

  const vars = [];
  for (const block of out.split(/\n\s*———\s*\n/)) {
    const fields = {};
    for (const line of block.split('\n')) {
      const m = LABEL_LINE.exec(line);
      if (m && !(m[1] in fields)) fields[m[1]] = m[2].trim();
    }
    if (!fields.Name) continue;
    for (const key of ['ID', 'Scope', 'Visibility', 'Environments', 'type']) {
      if (!fields[key]) fail(`Unexpected eas env:list output: ${fields.Name} has no ${key}`);
    }
    vars.push({
      name: fields.Name,
      value: fields.Value ?? '',
      scope: fields.Scope,
      visibility: fields.Visibility,
      type: fields.type,
      environments: fields.Environments.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    });
  }
  if (!vars.length) fail('Unexpected eas env:list output (no variables parsed)');
  const project = vars.filter((v) => v.scope === 'PROJECT');
  const seen = new Set();
  for (const v of project) {
    if (seen.has(v.name)) fail(`Duplicate variable ${v.name} in ${target}; resolve it in the EAS dashboard`);
    seen.add(v.name);
  }
  return project;
}

// ---- sync-eas -------------------------------------------------------------------------------

function currentBranchRef() {
  if (process.env.GITHUB_ACTIONS === 'true') return process.env.GITHUB_REF ?? '';
  const res = spawnSync('git', ['symbolic-ref', '-q', 'HEAD'], { encoding: 'utf8' });
  return res.status === 0 ? res.stdout.trim() : '';
}

function syncEas(target, dryRun) {
  if (!EAS_TARGETS[target]) fail(`--environment must be one of: ${Object.keys(EAS_TARGETS).join(', ')}`);
  const required = `refs/heads/${EAS_TARGETS[target].branch}`;
  const ref = currentBranchRef();
  if (ref !== required) {
    if (!dryRun) fail(`EAS environment ${target} may only be written from ${required} (current: ${ref || 'detached'})`);
    console.log(`Dry run on ${ref || 'detached HEAD'}; writes to ${target} are only allowed from ${required}`);
  }

  const desired = desiredFor(target);
  const existing = new Map(listVariables(target).map((v) => [v.name, v]));

  // With reviewer routing, the dev app must never carry EXPO_PUBLIC_REVIEW_* variables.
  if (reviewerRouting && target === 'preview') {
    for (const name of existing.keys()) if (name.startsWith(REVIEW_PREFIX)) desired.set(name, null);
  }

  const plan = [];
  for (const [name, value] of desired) {
    const cur = existing.get(name);
    const shared = cur ? cur.environments.filter((e) => e !== target) : [];
    if (cur && cur.type !== 'string') fail(`${name} in ${target} is a ${cur.type} variable; expected a string`);
    if (value === null) {
      if (!cur) continue;
      plan.push({ name, action: shared.length ? 'unlink' : 'delete', shared });
    } else if (!cur) {
      plan.push({ name, action: 'create', value });
    } else if (shared.length) {
      plan.push({ name, action: 'split', value, shared });
    } else if (cur.value !== value || cur.visibility !== 'PUBLIC') {
      plan.push({ name, action: 'update', value });
    } else {
      plan.push({ name, action: 'unchanged' });
    }
  }

  const changes = plan.filter((p) => p.action !== 'unchanged');
  for (const p of plan) {
    const note = p.shared?.length ? ` (keeps its value in ${p.shared.join(', ')})` : '';
    console.log(`${dryRun ? '[dry-run] ' : ''}${p.action.padEnd(9)} ${p.name}${note}`);
  }

  if (!dryRun) {
    for (const p of changes) {
      if (p.action === 'unlink' || p.action === 'split') unlink(p.name, target, p.shared);
      if (p.action === 'delete') {
        eas(['env:delete', '--variable-name', p.name, '--variable-environment', target, '--scope', 'project', '--non-interactive']);
      }
      if (p.action === 'create' || p.action === 'update' || p.action === 'split') {
        eas([
          'env:set', '--environment', target, '--name', p.name, `--value=${p.value}`,
          '--type', 'string', '--visibility', 'plaintext', '--scope', 'project', '--non-interactive',
        ]);
      }
    }
    verify(target, desired);
  }

  const summary = `${changes.length} change(s), ${plan.length - changes.length} unchanged`;
  console.log(`${dryRun ? 'Dry run: ' : ''}EAS ${target}: ${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = plan.map((p) => `| \`${p.name}\` | ${p.action} |`).join('\n');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### EAS environment \`${target}\`\n\n${summary}\n\n| Variable | Action |\n|---|---|\n${rows}\n\n`);
  }
}

/** Remove `target` from a shared variable's environments; its value elsewhere is untouched. */
function unlink(name, target, others) {
  // env:update is deprecated but is the only non-interactive way to change a variable's environments.
  eas([
    'env:update', '--variable-name', name, '--variable-environment', target,
    ...others.flatMap((e) => ['--environment', e]), '--scope', 'project', '--non-interactive',
  ]);
  if (listVariables(target).some((v) => v.name === name)) {
    fail(`${name} is still linked to ${target} after unlinking; stopping before any value is written`);
  }
}

function verify(target, desired) {
  const after = new Map(listVariables(target).map((v) => [v.name, v]));
  const problems = [];
  for (const [name, value] of desired) {
    const cur = after.get(name);
    if (value === null) {
      if (cur) problems.push(`${name} should be absent`);
    } else if (!cur || cur.value !== value) {
      problems.push(`${name} does not have the expected value`);
    } else if (cur.environments.length !== 1) {
      problems.push(`${name} is linked to ${cur.environments.join(', ')}`);
    }
  }
  if (problems.length) fail(`EAS ${target} verification failed: ${problems.join('; ')}`);
}

// ---- main -----------------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
if (opts.command === 'sync-eas') syncEas(opts.target, opts.dryRun);
else fail('Usage: backend-config.mjs sync-eas --environment preview|production [--dry-run]');
```

### eas.json example

Only the parts the workflow relies on. `environment` in each build profile is what makes EAS load that environment's variables. Values set in `env` override EAS environment variables of the same name, so do not put backend values there.

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "test": {
      "distribution": "store",
      "environment": "preview",
      "autoIncrement": true,
      "env": { "APP_VARIANT": "test" }
    },
    "production": {
      "distribution": "store",
      "environment": "production",
      "autoIncrement": true,
      "env": { "APP_VARIANT": "production" }
    }
  },
  "submit": {
    "test": {
      "ios": { "ascAppId": "<ASC_APP_ID_TEST>" },
      "android": { "track": "internal", "releaseStatus": "completed" }
    },
    "production": {
      "ios": { "ascAppId": "<ASC_APP_ID_PROD>" },
      "android": { "track": "alpha", "releaseStatus": "draft" }
    }
  }
}
```

When `submit` is on and the platform includes iOS, the resolve job refuses to run until `ascAppId` for that profile is a real value.

## AWS: config-read roles

One role per backend account, usually owned by the backend team.

| Role | Account | Trusted branches | Permission |
| --- | --- | --- | --- |
| Dev config-read | dev | `develop`; also `main` when reviewer routing is on | `ssm:GetParametersByPath` on `SSM_PATH_DEV` |
| Prod config-read | prod | `main` | `ssm:GetParametersByPath` on `SSM_PATH_PROD` |

The account needs the GitHub OIDC provider `token.actions.githubusercontent.com` once. Trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": [
          "repo:<org>/<repo>:ref:refs/heads/develop",
          "repo:<org>/<repo>:ref:refs/heads/main"
        ]
      }
    }
  }]
}
```

List only `main` for the prod role. Permission policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "ssm:GetParametersByPath",
    "Resource": [
      "arn:aws:ssm:<region>:<account-id>:parameter/<backend>/<env>/<app>",
      "arn:aws:ssm:<region>:<account-id>:parameter/<backend>/<env>/<app>/*"
    ]
  }]
}
```

If the backend ever uses `SecureString` parameters, add `--with-decryption` to the read jobs and `kms:Decrypt` on the key to the role. Do this only for values that are public anyway, because they end up in the app bundle.

## GitHub settings

Settings > Secrets and variables > Actions, at repository level. Do not use GitHub Environments ([why](#why-it-is-built-this-way)).

| Name | Kind | Needed for | Value |
| --- | --- | --- | --- |
| `EXPO_TOKEN` | Secret | every run | Access token of the Expo robot user |
| `AWS_CONFIG_READ_ROLE_ARN_DEV` | Variable | dev; prod when reviewer routing is on | Dev config-read role ARN |
| `AWS_CONFIG_READ_ROLE_ARN_PROD` | Variable | prod | Prod config-read role ARN |
| `REVIEW_USERNAME` | Variable | prod when reviewer routing is on | Store reviewer login |
| `CONFIG_AWS_REGION` | Variable, optional | every run | Region of the SSM parameters, default `ap-south-1` |

Until production exists, leave the prod settings unset and keep `<placeholder>` values in `eas.json`. A run on `main` then stops in the resolve job and lists what is missing.

## Expo and store setup

1. **Robot user.** In the Expo account that owns the project, give the robot user the **Developer** role. It must read and write project environment variables. If the sync step reports a permission error, raise it to **Admin**. Create an access token and store it as `EXPO_TOKEN`.
2. **Credentials on EAS.** Run `npx eas-cli@latest credentials` locally for each profile and platform, and confirm EAS stores:
   - the iOS distribution certificate and provisioning profiles;
   - an App Store Connect API key, used for submission;
   - the Google Play service account key, used for submission;
   - `GOOGLE_SERVICES_JSON` (or similar file variables) in each EAS environment, if the app uses Firebase.
3. **iOS.** Create the app records in App Store Connect and put their numeric IDs in `submit.<profile>.ios.ascAppId`.
4. **Android.** Complete the Play Console listing setup before using `releaseStatus: completed`. On a new listing, upload the first AAB manually ([why](#why-it-is-built-this-way)): run with `platform=android` and `submit` off, download the AAB from EAS and upload it in Play Console.
5. **Release approval** stays manual in both stores.

## First run

1. Copy both files, edit the [adaptable settings](#adapting-it-to-a-repository) and set the [GitHub settings](#github-settings) for dev.
2. Preview the sync locally against the real EAS environment. This writes nothing, but it needs `npx eas-cli@latest login` and dev AWS access:

   ```sh
   export SSM_PATH_DEV=/<backend>/dev/<app> REVIEWER_ROUTING=false
   DEV_PARAMS="$(aws ssm get-parameters-by-path --path "$SSM_PATH_DEV" \
     --query 'Parameters[].[Name,Value]' --output json --profile <dev>)" \
     node tools/backend-config.mjs sync-eas --environment preview --dry-run
   ```

   Look for `split` lines. They mean the variable is currently shared with `production`, and the first real run will separate them. Production keeps its current value.
3. Merge the workflow to `develop` and to the default branch.
4. Run on `develop` with `submit` off. Check the sync table in the run summary, then compare `npx eas-cli@latest env:list preview` and `env:list production` with what you expect.
5. Run on `develop` with `submit` on and follow the submission in the EAS dashboard.

For production, set the prod role ARN, the real `ascAppId` and, if routing is on, `REVIEW_USERNAME`. Then run on `main` with `submit` off and check `env:list production` before submitting.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No "Run workflow" button | The workflow file is not on the default branch |
| "Run this workflow on develop (dev) or main (prod)" | Started on another branch or a tag |
| "Not configured for dev/prod: ..." | Set the listed secret, variable, workflow env value or `eas.json` value |
| Read job: "Not authorized to perform sts:AssumeRoleWithWebIdentity" | Wrong ARN, or the role does not trust this branch's subject. Check that no `environment:` key was added |
| "Missing or empty SSM parameters" | The backend has not published that value, or `SSM_PATH_*` is wrong |
| Sync: "may only be written from refs/heads/..." | Branch guard; run on the matching branch |
| Sync: "eas env:update failed" or "still linked" | `eas-cli` changed its unlink behaviour. Split the variable in the EAS dashboard (one variable per environment) and rerun |
| Sync: "Unexpected eas env:list output" | `eas-cli` changed its list format; update `listVariables` in the script |
| Sync: "is a file variable" | A managed name exists as a file variable; delete it in the EAS dashboard |
| Sync: permission error | Raise the robot user's role |
| Build fails on credentials | Run `npx eas-cli@latest credentials` locally for that profile and platform |
| Android submission rejected for release status | The Play listing is still a draft, or this is its first upload |

## Maintenance and known limits

- **No branch protection.** Without it, anyone who can push to `main` can deploy to production. Add rulesets on `develop` and `main` when the plan allows. The role trust is pinned to those branches, so protecting the branches protects deployment.
- **Adding automatic triggers later.** `inputs.*` are empty on `push` events, so default them before adding a `push` trigger for `develop` and `main`: use `${{ inputs.platform || 'all' }}` and decide whether pushes should submit (an empty `submit` means no `--auto-submit`). Never deploy from `pull_request` events of forks.
- **Unpinned `eas-cli`.** If a release breaks the sync, the quickest fix is a temporary pin such as `eas-cli@<last-good>` in the install step.
- **Action SHAs.** Update the pinned actions on a schedule, for example with Dependabot for `github-actions`.
