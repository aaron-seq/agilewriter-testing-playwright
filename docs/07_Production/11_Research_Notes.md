# SCC-464 Research Notes

## Purpose

This document records research anchors for the SCC-464 architecture phase. It
does not replace ERB review or infrastructure owner approval.

## Official References

- GCP Compute Engine containers:
  https://docs.cloud.google.com/compute/docs/containers
- GCP public uptime checks:
  https://docs.cloud.google.com/monitoring/uptime-checks
- Docker Compose production guidance:
  https://docs.docker.com/compose/how-tos/production/
- Docker Compose environment variable guidance:
  https://docs.docker.com/compose/how-tos/environment-variables/best-practices/
- NGINX proxy module:
  https://nginx.org/en/docs/http/ngx_http_proxy_module.html
- NGINX HTTPS configuration:
  https://nginx.org/en/docs/http/configuring_https_servers.html
- GCP Secret Manager best practices:
  https://docs.cloud.google.com/secret-manager/docs/best-practices

## Research Findings

### Compute Engine

Compute Engine is a suitable first production target when the desired operating
model is a directly managed Linux VM with Docker installed.

SCC-464 still needs GCP project, region, zone, VM sizing, service account, and
access model decisions before implementation.

### Docker Compose

Docker Compose supports single-host production deployments. SCC-464 should use a
production-specific Compose topology rather than reusing the local compose file.

The production design should define:

- Compose file name.
- Service names.
- Restart policy.
- Internal app port.
- Volumes.
- Secret materialization.
- Health checks.

### NGINX

NGINX should own public traffic on ports 80 and 443 and proxy to the app on an
internal address. This keeps the public HTTP surface separate from the app
container.

The production design should define:

- Server name.
- TLS certificate paths.
- HTTP-to-HTTPS behavior.
- Proxy headers.
- Request size limits if needed.
- Access and error log locations.

### Monitoring

Google Cloud Monitoring public uptime checks satisfy the basic uptime monitoring
requirement for a public endpoint. Alert recipients and check cadence still need
owner approval.

### Secrets

Secret Manager is the expected GCP-native direction, but the exact production
materialization model is not approved yet. `deploy.sh validate` should fail
closed until secrets are readable through the approved mechanism.

## Open Research Questions

- Should the VM use Container-Optimized OS or a general Linux image?
- Should images be built on the VM or pulled from an approved registry?
- Which production values are configuration and which are secrets?
- Does production need persistent report/session storage after VM replacement?
- Should NGINX run on the host or inside Compose?
- What is the certificate issuance and renewal owner?
