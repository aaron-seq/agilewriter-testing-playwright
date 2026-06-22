# SCC-464 Production Requirements

## Status

SCC-464 is in ERB Research, Architecture, and Deployment Design Phase.
Minimal deployment contract support exists in `deploy.sh`,
`docker-compose.production.yml`, and `config/nginx/agilewriter.conf`.
Production execution must wait for the required infrastructure inputs.

## Confirmed Requirements

| Area | Requirement |
| --- | --- |
| Cloud platform | Google Cloud Platform |
| Compute model | Compute Engine Linux VM |
| Runtime model | Containerized workload |
| Deployment model | Docker Compose |
| Access model | Public application access |
| Public ports | 80 and 443 |
| Deployment trigger | Manual engineer-triggered deployment |
| Deployment script | `deploy.sh` exists with validation, build, deploy, status, logs, and rollback commands |
| CI/CD | Deferred to future work |
| Monitoring | Basic uptime monitoring |
| Advanced observability | Deferred |

## Production Success Criteria

Production execution is ready when:

- A GCP project, region, zone, and environment structure are approved.
- A VM provisioning model is approved.
- The production Compose topology is approved against
  `docker-compose.production.yml`.
- NGINX reverse proxy and HTTPS strategy are approved against
  `config/nginx/agilewriter.conf`.
- Secret storage and retrieval strategy are approved.
- Domain and SSL certificate strategy are approved.
- Deployment ownership and support ownership are approved.
- `deploy.sh` command, exit code, logging, and rollback contracts are approved.
- RED/GREEN validation evidence is reviewed.

Production implementation is successful when:

- `deploy.sh validate` catches missing Docker, Compose, secrets, domain, and
  production configuration prerequisites.
- `deploy.sh deploy` starts the production stack on the VM.
- The app is reachable over HTTPS on the approved domain.
- HTTP traffic either redirects to HTTPS or follows the approved security model.
- NGINX proxies traffic to the internal application port.
- Basic uptime monitoring detects service availability.
- Rollback restores the previous known-good production state.

## Required Inputs Before Implementation

| Input | Required decision |
| --- | --- |
| GCP project | Project ID for each environment. |
| Location | Region and zone. |
| Environments | Dev, QA, UAT, Prod structure and naming. |
| Owners | Deployment owner, VM admin, and production support owner. |
| Access | SSH access model and approval process. |
| Secrets | Secret Manager usage, service account, and local materialization model. |
| DNS | Domain and subdomain allocation. |
| HTTPS | Certificate provider and renewal strategy. |
| Monitoring | Uptime check target and alert recipients. |

## Risk Register

| Risk | Status | Mitigation |
| --- | --- | --- |
| GCP details are not available | Open | Contract support exists; production execution remains blocked. |
| Secrets strategy is undecided | Open | `deploy.sh validate` fails closed until approved. |
| Public access requirements may change | Open | Keep firewall and NGINX design explicit and reviewable. |
| Manual deployment can drift | Medium | Make commands idempotent and logging audit-friendly. |
| Rollback inputs are undefined | Medium | Require previous known-good image/state before deployment. |
| Monitoring is basic only | Accepted | Use uptime checks now; defer advanced observability. |

## Boundary With Local Deployment

SCC-460 and SCC-461 are complete and cover local deployment. SCC-464 must not
modify local deployment behavior unless a separate ticket explicitly scopes that
work.

Production artifacts must not reuse `docker-compose.local.yml` as the production
runtime file. Local-only auth, volume, and developer workflow assumptions must be
reviewed before any production equivalent is created.
