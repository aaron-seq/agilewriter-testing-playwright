# Production Deployment Guide

## Status

This guide defines the SCC-464 production deployment flow. It is not a live
execution checklist until GCP, DNS, access, and secrets inputs are supplied.

## Target Model

Production runs on a GCP Compute Engine Linux VM. Docker Compose runs the app
container. NGINX receives public HTTP/HTTPS traffic and proxies to the app on an
internal port.

Current contract artifacts:

- `deploy.sh`
- `docker-compose.production.yml`
- `config/nginx/agilewriter.conf`

## Pre-Deployment Requirements

Before a production deployment can run, the deployment owner must confirm:

- Approved GCP project, region, and zone.
- Approved VM instance and OS image.
- Docker and Docker Compose installed.
- Production Compose file approved.
- NGINX installed and configured.
- Domain DNS points to the production VM or approved load target.
- SSL certificate strategy is approved.
- Required secrets are available through the approved secrets model.
- Uptime check target and alert recipients are configured.
- Previous known-good version is recorded.

## Manual Deployment Flow

1. SSH to the approved production VM using the approved access model.
2. Confirm the checked-out branch, commit, or release artifact matches the
   approved release.
3. Run `./deploy.sh validate`.
4. Run `./deploy.sh build`.
5. Run `./deploy.sh deploy`.
6. Run `./deploy.sh status`.
7. Validate the public HTTPS endpoint.
8. Confirm Google Cloud Monitoring uptime check state.
9. Record deployment evidence in the release ticket.

## Expected Evidence

Deployment evidence should include:

- Deployment date and operator.
- Git commit or image version.
- `validate` output summary.
- `build` output summary.
- `deploy` output summary.
- `status` output summary.
- Public endpoint check result.
- Uptime check state.
- Rollback state captured before deployment.

## Public Endpoint Validation

The approved production endpoint should satisfy:

- HTTP on port 80 follows the approved redirect or response behavior.
- HTTPS on port 443 serves the app.
- TLS certificate is valid for the approved domain.
- NGINX proxies to the app without exposing the internal app port publicly.

## Rollback Trigger Conditions

Rollback should be considered when:

- Deployment exits non-zero after changing runtime state.
- Public HTTPS validation fails.
- NGINX cannot proxy to the app.
- Uptime checks fail after the agreed stabilization window.
- A critical app workflow fails smoke validation.

## Out Of Scope

- CI/CD execution.
- Blue/green deployment.
- Multi-VM or managed instance group rollout.
- Advanced observability.
- VPN/private-only access.
