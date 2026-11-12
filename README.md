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

The original Phase 0/1 baseline passed both builds, formatting, 27 automated tests,
actual loopback access, and persistence across API recreation. See
[verification evidence and exact changed files](docs/VERIFICATION.md),
[the phase plan](docs/PLAN.md), and [the requirements](docs/PRD.md).

## The visual experience

The redesigned interface pairs oversized editorial typography with an original,
pointer-responsive luminous field, a contrasting concept section, and a live persistence
console. Space Grotesk is bundled locally under the OFL-1.1 license; no font CDN, remote
artwork, video, tracking, or graphics framework is used.

The decorative artwork is explicitly not evaluation data. Motion is capped at 30 frames
per second, pauses offscreen or when the tab is hidden, and defaults to a still image
with reduced-motion preferences. A visible play/pause control, keyboard skip link,
native section navigation, and responsive layouts preserve access to the actual working
sandbox.

This frontend-only refinement passed six frontend tests and seven real Chromium E2E
tests, including persistence, failure/retry, 320-pixel keyboard access, and
pixel-identical reduced-motion frames. Desktop, tablet, and mobile screenshots were
inspected. The backend and Phase 2 boundary are unchanged.

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

The first run downloads public dependency packages and container images. It creates a
local database password under the ignored `.local/secrets` directory, without displaying
it. Builds and tests run sequentially inside resource-limited containers. After a build,
API/web are recreated to load the new artifacts; database data is kept.

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
- [Verified results, failure fixes, and exact file inventory](docs/VERIFICATION.md)

Redis, Kafka, workers, OpenTelemetry export, cloud hosting, and real agent tools are
deliberately deferred until justified by an approved later phase.

## Limitations

This is a local development skeleton, not a production deployment or a hostile
code-execution sandbox. Loopback exposure is not authentication. Other users or
processes with access to the host/Docker daemon remain trusted. The local database owner
is used for both migrations and the single synthetic probe; separate migration/runtime
roles and authentication are later-phase work.

API/web use a project-scoped bridge for working loopback port publication and can make
outbound connections; no egress-firewall guarantee is claimed. The DB is internal-only.
This session did not initialize Git, deploy to a cloud, or execute Phase 2+. Hosted CI
was not run or verified by this session. Git metadata appeared concurrently during final
checks and was left untouched as instructed.

## Local walkthrough and troubleshooting

1. Run `Verify`, then open <http://localhost:18104>.
2. Confirm "API and database ready".
3. Click "Run synthetic check" and inspect the persisted ID.
4. Repeat the check: the ID and creation time remain unchanged. This demonstrates
   infrastructure persistence, not agent evaluation or replay.

- If Docker is unavailable, start its Linux engine and retry.
- If the password file is missing while the DB volume exists, restore that file; the
  script deliberately refuses to silently reset the database.
- If startup or a test fails, inspect `.local/evidence`, API logs, and the JUnit
  reports. Do not disable the failing check or delete volumes.
- The shared Docker address pool was exhausted during development. The final topology
  reuses only two Halluminate networks; do not prune other projects.
- Host sleep or a paused Docker engine can expire startup deadlines. Resume the engine
  and rerun; successful component checks are not a successful full command.

Additional local commands:

```powershell
.\scripts\dev.ps1 -Action Format
.\scripts\dev.ps1 -Action Test
.\scripts\dev.ps1 -Action Smoke
.\scripts\dev.ps1 -Action Status
```

`Test` expects installed dependencies; `Smoke` expects the runtime already started.
`Verify` performs all prerequisites. Its temporary failure helper is always stopped.

No evaluation success rate, replay accuracy, cost, latency target, grader agreement, or
benchmark result is claimed.
