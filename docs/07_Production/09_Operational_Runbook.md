# Operational Runbook

## Purpose

This runbook defines routine SCC-464 production operations after implementation.
It is a design artifact until production infrastructure is approved.

## Roles

| Role | Responsibility |
| --- | --- |
| Deployment owner | Runs approved production deployments. |
| VM administrator | Maintains VM access, OS, Docker, and NGINX. |
| Secrets owner | Maintains Secret Manager values and access policy. |
| DNS owner | Maintains domain and certificate records. |
| Production support owner | Responds to incidents and approves rollback. |

## Daily Checks

- Confirm uptime check state.
- Review recent deployment or runtime alerts.
- Confirm no certificate expiry warning is active.

## Deployment Day Checklist

Before deployment:

- Confirm release approval.
- Confirm target commit or image.
- Confirm rollback state.
- Confirm support owner availability.

During deployment:

- Run `./deploy.sh validate`.
- Run `./deploy.sh build`.
- Run `./deploy.sh deploy`.
- Run `./deploy.sh status`.
- Validate public HTTPS endpoint.

After deployment:

- Confirm uptime monitoring remains healthy.
- Record evidence in the release ticket.
- Keep rollback window open for the approved observation period.

## Incident Checklist

1. Confirm severity and user impact.
2. Capture public endpoint result.
3. Capture `./deploy.sh status` output.
4. Check NGINX and Compose status.
5. Decide whether rollback is required.
6. Escalate to the relevant owner.
7. Record incident timeline.

## Maintenance Tasks

- Review VM OS patching plan.
- Review Docker image refresh cadence.
- Review TLS certificate renewal state.
- Review Secret Manager access.
- Review deployment and rollback logs.

## Audit Evidence

Production operations should preserve:

- Deployment operator.
- Timestamp.
- Commit or image version.
- Command outputs.
- Exit codes.
- Health validation results.
- Rollback metadata.
