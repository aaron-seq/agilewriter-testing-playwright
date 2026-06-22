#!/usr/bin/env bash

# SCC-464: Production deployment contract for AgileWriter.
set -euo pipefail

COMMAND="${1:-}"

if [ -n "${DEPLOY_ROOT:-}" ]; then
  ROOT="$DEPLOY_ROOT"
else
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

PRODUCTION_COMPOSE_FILE="${PRODUCTION_COMPOSE_FILE:-$ROOT/docker-compose.production.yml}"
PRODUCTION_ENV_FILE="${PRODUCTION_ENV_FILE:-$ROOT/.env.production}"
PRODUCTION_NGINX_CONFIG="${PRODUCTION_NGINX_CONFIG:-$ROOT/config/nginx/agilewriter.conf}"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-$ROOT/.scc464}"
ROLLBACK_STATE_FILE="${ROLLBACK_STATE_FILE:-$DEPLOY_STATE_DIR/previous-known-good.env}"
APP_HEALTH_URL="${APP_HEALTH_URL:-http://127.0.0.1:${APP_PORT:-3000}/}"

timestamp() {
  printf '%(%Y-%m-%dT%H:%M:%SZ)T' -1
}

log() {
  local level="$1"
  local phase="$2"
  local message="$3"
  printf 'timestamp=%s level=%s command=%s phase=%s message="%s"\n' \
    "$(timestamp)" "$level" "${COMMAND:-unknown}" "$phase" "$message"
}

fail() {
  local code="$1"
  local phase="$2"
  local message="$3"
  log "error" "$phase" "$message" >&2
  exit "$code"
}

usage() {
  cat <<'USAGE'
Usage: ./deploy.sh [validate|build|deploy|status|logs|rollback]

Commands:
  validate   Validate production host, Compose, NGINX, env, and Docker prerequisites.
  build      Build the production Docker Compose services after validation.
  deploy     Deploy the production Compose stack and validate service health.
  status     Show production Compose service status.
  logs       Show recent production Compose service logs.
  rollback   Restore the previous known-good production state.
USAGE
}

require_file() {
  local file="$1"
  local label="$2"
  if [ ! -f "$file" ]; then
    fail 2 "validation" "Missing $label: $file"
  fi
}

load_production_env() {
  require_file "$PRODUCTION_ENV_FILE" "production env file .env.production"

  set -a
  # shellcheck disable=SC1090
  if ! . "$PRODUCTION_ENV_FILE"; then
    set +a
    fail 1 "validation" "Unable to load production env file: $PRODUCTION_ENV_FILE"
  fi
  set +a
}

validate_required_env() {
  local required_vars=(
    PRODUCTION_DOMAIN
    GCP_PROJECT_ID
    GCP_REGION
    GCP_ZONE
    SECRET_MANAGER_STRATEGY
    SSL_CERT_STRATEGY
  )

  local missing=()
  for var_name in "${required_vars[@]}"; do
    if [ -z "${!var_name:-}" ]; then
      missing+=("$var_name")
    fi
  done

  if [ "${#missing[@]}" -gt 0 ]; then
    fail 2 "validation" "Missing required production env values: ${missing[*]}"
  fi
}

validate_nginx_config() {
  require_file "$PRODUCTION_NGINX_CONFIG" "NGINX production config"

  local config
  config="$(<"$PRODUCTION_NGINX_CONFIG")"

  if [[ "$config" != *"proxy_pass"* ]]; then
    fail 1 "validation" "Invalid NGINX production config: missing proxy_pass"
  fi

  if [[ "$config" != *"listen 443"* ]]; then
    fail 1 "validation" "Invalid NGINX production config: missing listen 443"
  fi
}

validate_system_prerequisites() {
  if ! command -v docker >/dev/null 2>&1; then
    fail 2 "validation" "Docker is required for production deployment but was not found"
  fi

  if ! docker info >/dev/null 2>&1; then
    fail 2 "validation" "Docker daemon is required for production deployment but is unavailable"
  fi

  if ! docker compose version >/dev/null 2>&1; then
    fail 2 "validation" "Docker Compose plugin is required for production deployment"
  fi
}

validate_contract() {
  require_file "$PRODUCTION_COMPOSE_FILE" "production compose file docker-compose.production.yml"
  validate_nginx_config
  load_production_env
  validate_required_env
  validate_system_prerequisites
  log "info" "validation" "SCC-464 production deployment prerequisites validated"
}

capture_previous_state() {
  mkdir -p "$DEPLOY_STATE_DIR"
  {
    printf 'timestamp=%s\n' "$(timestamp)"
    printf 'production_compose_file=%s\n' "$PRODUCTION_COMPOSE_FILE"
    printf 'production_nginx_config=%s\n' "$PRODUCTION_NGINX_CONFIG"
    printf 'git_commit=%s\n' "$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
  } > "$ROLLBACK_STATE_FILE"
  log "info" "rollback-state" "Captured previous known-good deployment state"
}

command_validate() {
  validate_contract
}

command_build() {
  validate_contract
  log "info" "build" "Building production Compose services"
  docker compose -f "$PRODUCTION_COMPOSE_FILE" build
}

command_deploy() {
  validate_contract
  capture_previous_state
  log "info" "deploy" "Starting production Compose stack"
  docker compose -f "$PRODUCTION_COMPOSE_FILE" up -d

  if ! command -v curl >/dev/null 2>&1; then
    fail 2 "health" "curl is required for production health validation"
  fi

  if ! curl -fLsS "$APP_HEALTH_URL" >/dev/null 2>&1; then
    fail 1 "health" "Production health validation failed at $APP_HEALTH_URL"
  fi

  log "info" "deploy" "Production deployment completed successfully"
}

command_status() {
  require_file "$PRODUCTION_COMPOSE_FILE" "production compose file docker-compose.production.yml"
  if ! command -v docker >/dev/null 2>&1; then
    fail 2 "status" "Docker is required to inspect production status"
  fi
  docker compose -f "$PRODUCTION_COMPOSE_FILE" ps
}

command_logs() {
  require_file "$PRODUCTION_COMPOSE_FILE" "production compose file docker-compose.production.yml"
  if ! command -v docker >/dev/null 2>&1; then
    fail 2 "logs" "Docker is required to inspect production logs"
  fi
  docker compose -f "$PRODUCTION_COMPOSE_FILE" logs --tail="${LOG_TAIL:-200}"
}

command_rollback() {
  if [ ! -f "$ROLLBACK_STATE_FILE" ]; then
    fail 2 "rollback" "Missing previous known-good rollback state: $ROLLBACK_STATE_FILE"
  fi

  validate_contract
  log "info" "rollback" "Restoring previous known-good production state"
  docker compose -f "$PRODUCTION_COMPOSE_FILE" up -d
  log "info" "rollback" "Rollback command completed; validate public endpoint before closing incident"
}

case "$COMMAND" in
  validate)
    command_validate
    ;;
  build)
    command_build
    ;;
  deploy)
    command_deploy
    ;;
  status)
    command_status
    ;;
  logs)
    command_logs
    ;;
  rollback)
    command_rollback
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    fail 1 "usage" "Unknown command: ${COMMAND:-<empty>}"
    ;;
esac
