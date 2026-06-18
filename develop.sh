#!/usr/bin/env bash

# SCC-461: Local Deployment Automation for Agile Writer
set -e

# Configuration
COMPOSE_FILE="docker-compose.local.yml"
CONTAINER_NAME="agilewriter-test-runner"
TIMEOUT_SECONDS=60

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

check_prerequisites() {
  log "Validating prerequisites..."
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    error "Docker is required but not found in PATH."
    exit 1
  fi

  if ! docker info &> /dev/null; then
    error "Docker daemon is not running."
    exit 1
  fi

  # Check Docker Compose
  if ! docker compose version &> /dev/null; then
    error "docker compose is required but not available."
    exit 1
  fi

  # Check required directories and files
  local REQUIRED_PATHS=(
    "sessions/"
    "reports/"
    "reference_files/"
    "raw_qa_files/"
    "playwright/.auth/user.json"
  )

  for path in "${REQUIRED_PATHS[@]}"; do
    if [ ! -e "$path" ]; then
      error "Missing required path: $path"
      exit 1
    fi
  done
  
  log "All prerequisites met."
}

poll_container_health() {
  log "Waiting for container '$CONTAINER_NAME' to become healthy (timeout: ${TIMEOUT_SECONDS}s)..."
  local end_time=$((SECONDS + TIMEOUT_SECONDS))
  
  while [ $SECONDS -lt $end_time ]; do
    local status
    status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$CONTAINER_NAME" 2>/dev/null || echo "missing")
    
    if [ "$status" = "healthy" ]; then
      log "Layer 1 Healthcheck passed: Container is healthy."
      return 0
    elif [ "$status" = "missing" ]; then
      error "Container '$CONTAINER_NAME' not found."
      return 1
    fi
    sleep 2
  done
  
  error "Timeout waiting for container health."
  return 1
}

poll_http_health() {
  log "Validating Layer 2 (HTTP 200) and Layer 3 (/api/env-status)..."
  local end_time=$((SECONDS + TIMEOUT_SECONDS))
  
  while [ $SECONDS -lt $end_time ]; do
    # Layer 2: Root endpoint
    if curl -fLsS http://localhost:3000/ >/dev/null 2>&1; then
      # Layer 3: Env Status
      local env_status
      env_status=$(curl -s http://localhost:3000/api/env-status)
      if echo "$env_status" | grep -q '"ok":true'; then
        log "Layer 2 & 3 Healthchecks passed: Service is fully up and configured."
        return 0
      fi
    fi
    sleep 2
  done
  
  error "Timeout waiting for HTTP health endpoints."
  return 1
}

command_up() {
  check_prerequisites
  
  log "Starting local deployment stack..."
  if ! docker compose -f "$COMPOSE_FILE" up --build -d; then
    error "Failed to start docker compose stack."
    exit 1
  fi
  
  if ! poll_container_health; then
    docker compose -f "$COMPOSE_FILE" logs
    exit 1
  fi
  
  if ! poll_http_health; then
    docker compose -f "$COMPOSE_FILE" logs
    exit 1
  fi
  
  log "Successfully started the Agile Writer local environment."
  echo -e "UI is available at: ${GREEN}http://localhost:3000/ui/${NC}"
}

command_down() {
  log "Stopping and removing local deployment stack..."
  docker compose -f "$COMPOSE_FILE" down
  log "Successfully tore down the stack."
}

command_status() {
  log "Status of local deployment stack:"
  docker compose -f "$COMPOSE_FILE" ps
}

# Entry point
ACTION=${1:-up}

case "$ACTION" in
  up|start)
    command_up
    ;;
  down|stop)
    command_down
    ;;
  status)
    command_status
    ;;
  *)
    error "Unknown command: $ACTION"
    echo "Usage: ./develop.sh [up|down|status]"
    exit 1
    ;;
esac
