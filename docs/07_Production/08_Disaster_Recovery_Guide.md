# Disaster Recovery Guide

## Purpose

This guide defines the SCC-464 recovery model for severe production failures.
It is intentionally lightweight until infrastructure details are approved.

## Disaster Scenarios

| Scenario | Recovery path |
| --- | --- |
| VM unavailable | Provision replacement VM from approved baseline and redeploy. |
| Docker runtime corrupted | Reinstall Docker/Compose or rebuild VM from baseline. |
| NGINX configuration broken | Restore last known-good NGINX config and reload. |
| Secret access broken | Restore service account permissions or secret versions. |
| DNS misconfigured | Restore approved DNS record. |
| Certificate expired | Renew or replace certificate using approved strategy. |
| Deployment artifact unavailable | Restore from approved repository or artifact source. |

## Recovery Priorities

1. Protect secrets.
2. Restore public HTTPS availability.
3. Restore deployment auditability.
4. Restore monitoring.
5. Preserve logs for review.

## Minimum Recovery Inputs

Disaster recovery requires:

- Approved GCP project and VM baseline.
- Deployment repository or artifact source.
- Production Compose topology.
- NGINX configuration.
- Secret retrieval strategy.
- DNS and certificate ownership.
- Uptime monitoring target.

## Replacement VM Recovery Flow

1. Provision replacement VM from approved baseline.
2. Install Docker, Compose, and NGINX.
3. Restore repository or deployment artifact.
4. Restore approved production configuration.
5. Restore access to secrets through approved service account.
6. Run `./deploy.sh validate`.
7. Run `./deploy.sh deploy`.
8. Validate public HTTPS endpoint.
9. Repoint DNS if required.
10. Confirm uptime monitoring recovers.

## Recovery Evidence

Record:

- Incident start time.
- Recovery operator.
- Root cause if known.
- Replacement VM ID if applicable.
- Deployed commit or image.
- Public endpoint validation result.
- Monitoring recovery time.

## Open Decisions

- Backup retention expectations.
- Whether generated reports or sessions must survive VM loss.
- Whether any production data must be stored outside the VM.
- Recovery time objective.
- Recovery point objective.
