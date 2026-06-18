# SCC-464 Production Deployment Hub

**Owner ticket:** SCC-464
**Status:** ERB Research, Architecture, and Deployment Design Phase
**Implementation status:** Deployment contract support implemented; production
execution blocked pending GCP, DNS, access, and secrets inputs

This folder owns production deployment architecture for the AgileWriter automation
platform. It is intentionally separate from SCC-460 and SCC-461 local deployment
work.

## Scope

SCC-464 covers:

- GCP Compute Engine production deployment design.
- Docker Compose production topology.
- NGINX reverse proxy and HTTPS architecture.
- Public access through ports 80 and 443.
- Manual engineer-triggered deployment contract for `deploy.sh`.
- Production contract artifacts:
  - `deploy.sh`
  - `docker-compose.production.yml`
  - `config/nginx/agilewriter.conf`
- Basic uptime monitoring and operational response.
- Production runbooks and rollback guidance.

SCC-464 does not cover:

- Local Docker workflow changes.
- `develop.sh` behavior.
- CI/CD implementation.
- Advanced observability.
- VPN or private network design.
- Production deployment execution before required inputs are supplied.

## Documents

| Document | Purpose |
| --- | --- |
| [01_Production_Requirements.md](01_Production_Requirements.md) | Requirements, success criteria, risks, and blockers. |
| [02_Architecture_Decision_Package.md](02_Architecture_Decision_Package.md) | Decision Council options and recommendation. |
| [03_Deploy_Sh_Contract.md](03_Deploy_Sh_Contract.md) | Manual-first `deploy.sh` command contract. |
| [04_Production_Deployment_Guide.md](04_Production_Deployment_Guide.md) | Deployment flow once infrastructure details are available. |
| [05_VM_Provisioning_Guide.md](05_VM_Provisioning_Guide.md) | VM provisioning checklist and ownership inputs. |
| [06_Rollback_Guide.md](06_Rollback_Guide.md) | Rollback strategy and decision points. |
| [07_Troubleshooting_Guide.md](07_Troubleshooting_Guide.md) | Production failure triage. |
| [08_Disaster_Recovery_Guide.md](08_Disaster_Recovery_Guide.md) | Recovery model for VM, data, secrets, and DNS failures. |
| [09_Operational_Runbook.md](09_Operational_Runbook.md) | Routine operations and incident response. |
| [10_Test_Strategy.md](10_Test_Strategy.md) | RED, GREEN, and integration validation design. |
| [11_Research_Notes.md](11_Research_Notes.md) | Research anchors and design constraints. |

## Current Recommendation

Use Option D:

GCP Compute Engine VM + Docker Compose + NGINX reverse proxy + HTTPS + basic
uptime monitoring + manual `deploy.sh` contract designed for future CI/CD.

This gives production a controlled starting point while preserving a clean path
to later automation.

## Current Implementation Boundary

SCC-464 now includes minimal production deployment contract support. The
implementation validates required production files, environment values, Docker,
Docker Compose, NGINX proxy configuration, and rollback state before taking
runtime actions.

The contract is not a live production deployment until infrastructure owners
provide the approved GCP project, VM, DNS, HTTPS, access, and secrets details.
