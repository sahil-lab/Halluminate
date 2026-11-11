# Halluminate: Replayable Agent Evaluation Sandbox

An original, independent local prototype inspired by the public product area of
Halluminate. This project is not affiliated with Halluminate and does not claim access
to its private systems.

## Current scope

This iteration executes **Phase 0 (contract and safety)** followed by **Phase 1 (working
skeleton)** only. The skeleton connects a React dashboard to a Java API and PostgreSQL
through a fixed, fictional persistence probe.

Task worlds, task/run APIs, agents, spreadsheets, action traces, snapshots, graders,
replay, and benchmarks are **not implemented** in this iteration. A successful bootstrap
probe is not evidence that an agent evaluation works.

Implementation and verification are initially pending. See
[the phase plan](docs/PLAN.md) for current gates and [the requirements](docs/PRD.md) for
measurable acceptance criteria.

## Local development

Prerequisites: Docker with a responsive Linux engine, Docker Compose v2 or newer, and
Windows PowerShell 5.1 or PowerShell 7. Java and Node are run in bounded containers; the
host Node 14 installation is not used.

From the project directory:

```powershell
# Install locked dependencies, format-check, compile, test, start, and smoke-test.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Action Verify

# Build and start the application without rerunning the full verification suite.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1 -Action Up
```

These commands will be supplied by Phase 1. The first run downloads public dependency
packages and container images. It creates a local database password under the ignored
`.local/secrets` directory, without displaying it.

- Dashboard: <http://localhost:18104>
- API readiness: <http://localhost:18204/actuator/health/readiness>
- API liveness: <http://localhost:18204/actuator/health/liveness>
- API contract: [OpenAPI](packages/contracts/openapi.yaml)
- Compose project: `halluminate`
- PostgreSQL: internal Docker network only; no host database port

All test data is fictional. The only accepted probe fixture is `phase-1-synthetic`, and
the database can contain at most one bootstrap probe. Repeated checks preserve its
identifier and creation time.

For local status and logs:

```powershell
docker compose -p halluminate -f .\infra\docker\compose.yaml ps
docker compose -p halluminate -f .\infra\docker\compose.yaml logs --tail 50 api web
```

Do not print resolved Compose configuration containing secrets, prune Docker, or remove
volumes. No Git repository, remote, commit, cloud resource, or external account is
created by the development workflow.

## Architecture and safety

The browser talks to Nginx, which serves the dashboard and proxies same-origin
API/health requests to Spring Boot. Flyway owns schema migrations. JDBC performs the
synthetic persistence check. PostgreSQL is on a project-private internal network.
Runtime services have read-only root filesystems and explicit resource limits.

- [Architecture and interfaces](docs/ARCHITECTURE.md)
- [Threat model and approval boundaries](docs/THREAT_MODEL.md)
- [Decisions and trade-offs](docs/DECISIONS.md)
- [Coding and verification conventions](docs/CONVENTIONS.md)
- [Phase plan](docs/PLAN.md)

Redis, Kafka, workers, OpenTelemetry export, cloud hosting, and real agent tools are
deliberately deferred until justified by an approved later phase.

## Limitations

This is a local development skeleton, not a production deployment or a hostile
code-execution sandbox. Loopback exposure is not authentication. Other users or
processes with access to the host/Docker daemon remain trusted. The local database owner
is used for both migrations and the single synthetic probe; separate migration/runtime
roles and authentication are later-phase work.

No evaluation success rate, replay accuracy, cost, latency target, grader agreement, or
benchmark result is claimed.
