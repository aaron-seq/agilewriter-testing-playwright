# SCC-464 Architecture Decision Package

## Decision Needed

Select the first production deployment architecture for the AgileWriter
automation platform on GCP Compute Engine.

## Option A: Single VM + Docker Compose

**Shape:**

- One Compute Engine Linux VM.
- Docker and Docker Compose installed on the VM.
- Application container exposed directly from Compose.

**Benefits:**

- Lowest operational complexity.
- Fastest path to first production deployment.
- Similar runtime model to local Docker.

**Tradeoffs:**

- Weak HTTPS and reverse proxy story.
- Less room for request hardening.
- Public exposure may be too close to the app container.

**ERB view:** Not recommended as the final production target.

## Option B: VM + NGINX Reverse Proxy

**Shape:**

- One Compute Engine Linux VM.
- Docker Compose runs the app on an internal port.
- NGINX receives public traffic and proxies to the app.

**Benefits:**

- Clean separation between public traffic and app runtime.
- NGINX can own headers, redirects, request limits, and TLS termination.
- App container can bind internally instead of being public.

**Tradeoffs:**

- Adds NGINX configuration and operational ownership.
- Monitoring is still not fully defined.

**ERB view:** Acceptable baseline, but monitoring should be part of production.

## Option C: VM + NGINX + Monitoring

**Shape:**

- Option B plus Google Cloud Monitoring public uptime checks.
- Basic alerting to approved recipients.

**Benefits:**

- Covers public availability monitoring.
- Fits the requirement for basic uptime monitoring.
- Keeps architecture simple while adding operational visibility.

**Tradeoffs:**

- Still needs a deployment contract designed for future automation.
- Does not by itself define rollback or CI/CD compatibility.

**ERB view:** Strong candidate.

## Option D: Production-Ready Architecture With Future CI/CD Compatibility

**Shape:**

- One Compute Engine Linux VM.
- Production-specific Docker Compose topology.
- NGINX reverse proxy and HTTPS termination.
- Public access through ports 80 and 443.
- App bound internally, preferably `127.0.0.1:3000`.
- Google Cloud Monitoring uptime checks and basic alerting.
- Manual `deploy.sh` contract with automation-friendly commands and exit codes.
- Systemd or documented boot recovery so the stack restarts after VM reboot.

**Benefits:**

- Meets current production requirements.
- Preserves manual deployment while preparing for CI/CD later.
- Creates a clear operations model.
- Separates production from local deployment.
- Gives ERB clear validation and rollback checkpoints.

**Tradeoffs:**

- Requires more design discipline before implementation.
- Requires infrastructure owner inputs before build-out.

**ERB view:** Recommended.

## Recommended Decision

Adopt Option D as the SCC-464 target architecture.

## Architecture Sketch

```text
User Browser
  |
  | HTTPS :443
  v
GCP Firewall Rule
  |
  v
Compute Engine VM
  |
  +-- NGINX :80/:443
  |     |
  |     v
  |   App upstream http://127.0.0.1:3000
  |
  +-- Docker Compose
        |
        +-- agilewriter app container
        +-- mounted production output directories
        +-- production environment/secrets materialized by approved strategy
```

## Decision Council Questions

- Which GCP project, region, and zone own the first environment?
- Which environments are required now: Dev, QA, UAT, Prod?
- Who owns deployment execution and production support?
- Which service account can read production secrets?
- Which domain and subdomain will point to the VM?
- Who owns TLS certificate issuance and renewal?
- Who receives uptime alerts?

## Decision Record

| Field | Value |
| --- | --- |
| Recommended option | Option D |
| Status | Pending Decision Council review |
| Implementation | Deferred until required inputs are supplied |
| Risk | Medium until infrastructure details are approved |
