#!/usr/bin/env node
// Makes an EAS environment match tour-data-api's SSM handover values (/tour-data-api/<env>/rider/*).
// Run by .github/workflows/deploy.yml before every EAS build; only changed variables are written.
//
//   node tools/backend-config.mjs sync-eas --environment preview|production [--dry-run]
//
//   preview    (develop) -> Test app com.tourrider.app.dev: dev values; EXPO_PUBLIC_REVIEW_* removed
//   production (main)    -> Production app com.tourrider.app: prod values, plus dev values as
//                           EXPO_PUBLIC_REVIEW_* for store-reviewer routing
//
// Inputs (environment variables):
//   SSM_PATH_DEV, SSM_PATH_PROD  SSM paths the values were read from, e.g. /tour-data-api/dev/rider
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

// ---- Backend contract (tour-data-api handover for the rider app) ----------------------------

/** [EAS name, SSM leaf]; all required. */
const PRIMARY = [
  ['EXPO_PUBLIC_AWS_REGION', 'region'],
  ['EXPO_PUBLIC_AWS_USER_POOL_ID', 'cognito-user-pool-id'],
  ['EXPO_PUBLIC_AWS_USER_POOL_WEB_CLIENT_ID', 'cognito-app-client-id'],
  ['EXPO_PUBLIC_TOUR_DATA_API_BASE_URL', 'api-endpoint'],
];

/**
 * [EAS name, SSM leaf]; set when present in SSM, removed from EAS when absent.
 * tour-data-api has no identity pool today, so the sync removes this variable (and its REVIEW_ copy).
 */
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
