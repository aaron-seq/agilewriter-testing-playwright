# VM Provisioning Guide

## Purpose

This guide lists the provisioning decisions and checks needed before SCC-464
production implementation can start.

## Required GCP Inputs

| Input | Example format | Owner |
| --- | --- | --- |
| Project ID | `synterex-prod-example` | GCP owner |
| Region | `us-central1` | GCP owner |
| Zone | `us-central1-a` | GCP owner |
| Environment | `prod`, `uat`, `qa`, `dev` | ERB / GCP owner |
| VM name | `agilewriter-prod-vm` | GCP owner |
| DNS name | `agilewriter.example.com` | DNS owner |
| Service account | `agilewriter-prod-runtime@...` | GCP owner |

## VM Baseline

The VM should provide:

- Linux operating system approved by infrastructure owners.
- Docker Engine.
- Docker Compose plugin.
- NGINX.
- Git or approved artifact retrieval tool.
- Access to approved secrets retrieval mechanism.
- OS logging retained according to support expectations.

## Network Baseline

Public firewall rules:

- Allow TCP `80`.
- Allow TCP `443`.

Restricted firewall rules:

- SSH must be limited to approved administrators or approved access mechanism.
- The app's internal port, preferably `3000`, must not be exposed publicly.

## Host Directory Baseline

The production design must define durable host paths for:

- Deployment releases or checked-out repository.
- Runtime logs.
- Generated reports, if production requires persistence.
- Session output, if production requires persistence.
- Rollback metadata.
- NGINX configuration.

Exact paths must be approved during implementation.

## Service Account Baseline

The production VM service account should follow least privilege:

- Read approved secrets only.
- Write logs or monitoring data only if required.
- Avoid broad project editor permissions.

## Provisioning Acceptance Criteria

VM provisioning is complete when:

- Approved VM exists in the approved GCP project, region, and zone.
- Docker and Compose commands work.
- NGINX is installed and can load a minimal valid config.
- Firewall allows public `80` and `443`.
- SSH/access model is confirmed.
- Service account permissions are approved.
- Uptime monitoring can reach the public endpoint after deployment.
