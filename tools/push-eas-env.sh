#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# push-eas-env.sh — upsert EXPO_PUBLIC_* values from a local .env into EAS
# environment variables.
#
# Usage:
#   tools/push-eas-env.sh [--dry-run] [--file <path>] <environment> [<environment> ...]
#
# Examples:
#   tools/push-eas-env.sh --file .env.preview preview
#   tools/push-eas-env.sh --dry-run --file .env.production production
#
# Behaviour:
#   - Reads KEY=VALUE lines from a git-ignored env file (default: .env).
#   - Only EXPO_PUBLIC_* keys are pushed; comments and blank lines are ignored.
#   - Keys with empty values are skipped (e.g. REVIEW_* in preview).
#   - Flags managed by eas.json build profiles are skipped (APP_VARIANT,
#     EXPO_PUBLIC_SUBSCRIPTION_MODE, EXPO_PUBLIC_LOG_LEVEL, EXPO_PUBLIC_API_DEBUG_GET).
#   - Each key is created or overwritten (--force) as a plaintext string variable
#     in every given EAS environment (development | preview | production).
#   - --dry-run prints the actions without calling EAS. Values are never printed.
#
# EXPO_PUBLIC_* values are embedded in the app binary. Never put secrets in them.
# GOOGLE_SERVICES_JSON is a file variable; create it manually (see
# docs/guides/eas-build-and-release.md).
# ----------------------------------------------------------------------------
set -euo pipefail

ENV_FILE=".env"
DRY_RUN=false
ENVIRONMENTS=()
PROFILE_MANAGED=(
  "APP_VARIANT"
  "EXPO_PUBLIC_SUBSCRIPTION_MODE"
  "EXPO_PUBLIC_LOG_LEVEL"
  "EXPO_PUBLIC_API_DEBUG_GET"
)

usage() {
  sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --file)
      [[ $# -ge 2 ]] || { echo "Error: --file requires a path" >&2; exit 1; }
      ENV_FILE="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    development|preview|production) ENVIRONMENTS+=("$1"); shift ;;
    *) echo "Error: unknown argument '$1'" >&2; usage 1 ;;
  esac
done

if [[ ${#ENVIRONMENTS[@]} -eq 0 ]]; then
  echo "Error: specify at least one EAS environment (development | preview | production)" >&2
  usage 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file '$ENV_FILE' not found" >&2
  exit 1
fi

if [[ "$DRY_RUN" == false ]] && ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required (install Node.js)" >&2
  exit 1
fi

is_profile_managed() {
  local key="$1"
  for managed in "${PROFILE_MANAGED[@]}"; do
    [[ "$key" == "$managed" ]] && return 0
  done
  return 1
}

pushed=0
skipped=0

while IFS= read -r line || [[ -n "$line" ]]; do
  # Trim leading/trailing whitespace
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" == export\ * ]] && line="${line#export }"
  [[ "$line" == *=* ]] || continue

  key="${line%%=*}"
  value="${line#*=}"
  key="${key%"${key##*[![:space:]]}"}"

  # Strip matching surrounding quotes
  if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then
    value="${BASH_REMATCH[1]}"
  fi

  [[ "$key" == EXPO_PUBLIC_* ]] || continue

  if is_profile_managed "$key"; then
    echo "skip  $key (managed by eas.json build profile)"
    skipped=$((skipped + 1))
    continue
  fi

  if [[ -z "$value" ]]; then
    echo "skip  $key (empty value)"
    skipped=$((skipped + 1))
    continue
  fi

  for environment in "${ENVIRONMENTS[@]}"; do
    if [[ "$DRY_RUN" == true ]]; then
      echo "[dry-run] upsert $key -> $environment"
    else
      echo "upsert $key -> $environment"
      npx --yes eas-cli@latest env:create \
        --environment "$environment" \
        --name "$key" \
        --value "$value" \
        --type string \
        --visibility plaintext \
        --force \
        --non-interactive
    fi
  done
  pushed=$((pushed + 1))
done < "$ENV_FILE"

echo "Done. ${pushed} variable(s) processed, ${skipped} skipped, environments: ${ENVIRONMENTS[*]}."
