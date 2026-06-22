# SCC-464 deploy.sh Contract

## Purpose

`deploy.sh` is the manual production deployment entrypoint for SCC-464. It
must be usable by engineers now and automation-friendly later.

This document defines the implemented command contract and the production
safety boundaries around it.

## Command Summary

| Command | Purpose |
| --- | --- |
| `./deploy.sh validate` | Validate host, Docker, Compose, configuration, secrets, and production prerequisites. |
| `./deploy.sh build` | Build or pull the production image according to the approved release model. |
| `./deploy.sh deploy` | Deploy the production Compose stack and run health validation. |
| `./deploy.sh status` | Show service, container, proxy, and health status. |
| `./deploy.sh logs` | Stream or print recent deployment logs. |
| `./deploy.sh rollback` | Restore the previous known-good production state. |

## Exit Code Contract

| Exit code | Meaning |
| --- | --- |
| `0` | Command completed successfully. |
| `1` | Validation or runtime failure. |
| `2` | Missing infrastructure, secrets, or configuration prerequisite. |

## Required Behavior

`validate` must fail closed when:

- Docker is missing.
- Docker daemon is unavailable.
- Docker Compose is unavailable.
- Production Compose file is missing.
- Required production environment values are missing.
- Required secrets cannot be read or materialized.
- NGINX configuration is missing or invalid.
- Approved domain or certificate inputs are missing.
- The command is not running on an approved production host.

Current implementation validates the file/configuration prerequisites above and
fails closed for missing Docker, Docker daemon, Docker Compose, production
Compose, production env, required env values, invalid NGINX proxy config, and
missing rollback state.

`build` must:

- Use the approved image source strategy.
- Produce a traceable version identifier.
- Avoid silently overwriting the previous known-good version.
- Log enough detail for audit review.

Current implementation runs `docker compose -f docker-compose.production.yml
build` after validation.

`deploy` must:

- Run `validate` first.
- Capture current known-good state before changing the stack.
- Start or update the production Compose stack.
- Validate app health after startup.
- Validate NGINX reachability.
- Exit non-zero on partial deployment failure.

Current implementation runs validation, records rollback metadata, starts the
production Compose stack, and checks the internal app health URL.

`status` must report:

- Current Git commit or image version, if available.
- Docker Compose service status.
- App container health.
- NGINX status.
- Public endpoint health, if configured.

`logs` must support:

- Recent deployment logs.
- App container logs.
- NGINX error and access log locations.

`rollback` must:

- Identify the previous known-good version.
- Restore the previous Compose/image state.
- Restart affected services.
- Re-run health validation.
- Report whether rollback succeeded.

Current implementation fails closed until a previous known-good rollback state
file exists, then restarts the production Compose stack after validation.

## Logging Contract

Every command should emit structured, audit-friendly log lines:

```text
timestamp=<ISO-8601> level=<info|warn|error> command=<command> phase=<phase> message="<message>"
```

Sensitive values must never be printed.

## Production Safety Rules

- Do not use `docker-compose.local.yml`.
- Do not read local developer `.env` files unless explicitly approved for the
  production materialization model.
- Do not continue when required secrets are missing.
- Do not deploy without recording the previous known-good state.
- Do not force-push, rebase, or rewrite Git history as part of deployment.
- Do not implement CI/CD in SCC-464.

## Future CI/CD Compatibility

The command contract should remain stable so a later pipeline can run:

```bash
./deploy.sh validate
./deploy.sh build
./deploy.sh deploy
./deploy.sh status
```

The future CI/CD system should not need to infer success from free-form text; it
should rely on exit codes and stable log phases.
