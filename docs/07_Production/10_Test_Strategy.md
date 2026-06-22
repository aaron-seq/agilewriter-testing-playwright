# SCC-464 Test Strategy

## Purpose

This document defines the SCC-464 validation strategy before production
implementation begins.

## RED Test Design

RED tests failed before production deployment contract support existed.

Required RED scenarios:

- `deploy.sh` is missing or not executable.
- Docker is missing.
- Docker daemon is unavailable.
- Docker Compose is unavailable.
- Production Compose file is missing.
- Required production environment values are missing.
- Required secrets are unavailable.
- NGINX configuration is missing or invalid.
- Invalid production configuration fails validation.

## GREEN Test Design

GREEN tests pass after minimal contract implementation:

- `./deploy.sh validate` succeeds on a correctly provisioned host.
- `./deploy.sh build` produces or retrieves the approved production image.
- `./deploy.sh deploy` starts the production Compose stack.
- App health validation succeeds.
- NGINX proxy validation succeeds.
- `./deploy.sh status` reports runtime state.
- `./deploy.sh logs` returns useful recent logs.
- `./deploy.sh rollback` restores previous known-good state.

Current GREEN evidence command:

```bash
npx playwright test tests/infrastructure/deploy.spec.ts --no-deps --reporter=list
```

Current result:

```text
8 passed
```

## Integration Validation

Integration checks should cover:

- Docker Compose config validation.
- Production service startup.
- Internal app health endpoint.
- NGINX upstream connectivity.
- Public HTTP behavior.
- Public HTTPS behavior.
- Uptime monitoring target response.

## Test Boundaries

SCC-464 tests must not:

- Depend on `docker-compose.local.yml`.
- Modify `develop.sh`.
- Require CI/CD.
- Require real production secrets in source control.
- Run destructive production actions by default.

## Evidence Requirements

Each validation run should capture:

- Command.
- Timestamp.
- Environment.
- Exit code.
- Summary output.
- Failure reason, if any.

## Open Decisions

- Final production Compose file name.
- Approved test host or sandbox environment.
- Whether pre-production environments mirror production.
- How secret access is mocked or validated in tests.
