# Rollback Guide

## Purpose

Rollback restores the previous known-good production state when deployment or
post-deployment validation fails.

## Rollback Principles

- Rollback must be possible before a deployment changes runtime state.
- The previous known-good image, commit, or release identifier must be recorded.
- Rollback must run health validation before it is considered complete.
- Rollback must produce audit evidence.

## Required Rollback Metadata

Before `deploy.sh deploy` changes production, it must record:

- Current Git commit or image tag.
- Current Compose project status.
- Current production Compose file version.
- Current NGINX config checksum or version.
- Timestamp and operator.

## Rollback Flow

1. Confirm rollback trigger.
2. Run `./deploy.sh rollback`.
3. Restore previous known-good image or release.
4. Recreate affected Compose services.
5. Validate app health.
6. Validate NGINX proxy health.
7. Validate public HTTPS endpoint.
8. Confirm uptime monitoring recovers.
9. Record rollback evidence in the incident or release ticket.

## Rollback Success Criteria

Rollback is successful when:

- Previous known-good runtime version is active.
- App container is healthy.
- NGINX proxies traffic successfully.
- Public HTTPS endpoint returns the expected response.
- Monitoring returns to healthy state.
- Rollback evidence is captured.

## Rollback Failure Escalation

If rollback fails:

- Stop further deployment attempts.
- Preserve logs and current host state.
- Notify production support owner.
- Move to disaster recovery process if the VM or runtime is unrecoverable.

## Out Of Scope

- Database rollback, unless future architecture introduces a database.
- Multi-region failover.
- CI/CD automated rollback.
