# Production Troubleshooting Guide

## Purpose

This guide provides first-pass triage for SCC-464 production deployment and
runtime issues.

## Triage Order

1. Confirm public endpoint behavior.
2. Confirm NGINX status.
3. Confirm Docker Compose service status.
4. Confirm app container health.
5. Confirm production configuration and secrets.
6. Confirm VM firewall and GCP firewall rules.
7. Confirm DNS and certificate state.
8. Confirm uptime monitoring state.

## Common Symptoms

### Public site does not load

Check:

- DNS resolves to the approved target.
- GCP firewall allows `80` and `443`.
- NGINX is running.
- TLS certificate is valid.
- App container is running.

### HTTPS certificate warning

Check:

- Certificate covers the approved domain.
- Certificate is not expired.
- NGINX is loading the expected certificate files.
- Renewal process has not failed.

### NGINX returns 502

Check:

- App container is running.
- App is listening on the expected internal port.
- NGINX upstream points to the expected internal address.
- Docker Compose network and port bindings match the production design.

### `deploy.sh validate` fails with exit code 2

Likely cause:

- Missing infrastructure, secrets, or configuration prerequisite.

Action:

- Do not bypass validation.
- Identify the missing prerequisite.
- Route to the correct owner: GCP, DNS, secrets, access, or deployment.

### Uptime check fails but manual browser check works

Check:

- Uptime check target URL.
- Expected response code.
- Firewall restrictions.
- TLS validation.
- Regional or transient GCP Monitoring failures.

## Evidence To Capture

Capture:

- Timestamp.
- Operator.
- Command executed.
- Exit code.
- NGINX status.
- Compose status.
- App health result.
- Public endpoint result.
- Relevant logs with secrets removed.

## Escalation

Escalate to production support owner when:

- Public HTTPS endpoint is unavailable.
- Rollback fails.
- Secrets are missing or inaccessible.
- VM access is unavailable.
- DNS or certificate changes are required.
