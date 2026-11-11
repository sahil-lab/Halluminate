# Execution plan and progress

## Authorization and source

Only Phase 0 then Phase 1 are authorized. All three pages of
`04_Halluminate_Agent_Evals.pdf` and its embedded prompts were read before
implementation. The initial workspace contained only that guide. Git was absent; no Git
initialization is attempted.

Docker verification before implementation: Linux engine 29.4.1, Compose v5.1.3, 22
logical CPUs, 16,467,517,440 bytes of daemon memory; no existing Halluminate Compose
containers. Shared daemon capacity is not an allocation to this project. The existing
containerized Node 22 image reported v22.23.4.

## Phase 0 - contract and safety

- [x] Read the full engineering PDF and record its hash.
- [x] Define scope, user stories, non-goals, interfaces and measurable acceptance.
- [x] Write architecture diagram, threat model and decision log.
- [x] Specify local isolation, resource budgets and approval boundaries.
- [x] Establish ignore rules, coding conventions and CI entry point.
- [x] Explicitly defer Git creation because approval is not granted here.

Phase 0 documents were authored before Phase 1 application code.

## Phase 1 - working skeleton

- [ ] Bootstrap Java 21 / Spring Boot 3 API and React / TypeScript dashboard.
- [ ] Add PostgreSQL, Flyway V1, liveness/readiness and secret-file configuration.
- [ ] Implement strict synthetic probe validation and durable readback.
- [ ] Wire UI success, loading, unavailable and retry states.
- [ ] Supply OpenAPI, structured logging and basic browser boundary controls.
- [ ] Supply bounded Compose tooling/runtime and a reproducible entry script.
- [ ] Run formatting, compilation, unit/integration tests and Chromium smoke.
- [ ] Verify actual DB persistence, runtime isolation and failure behavior.
- [ ] Record exact commands, outcomes, file inventory, limitations and blockers.

Only executed, successful checks may change these checkboxes. A failing check must be
corrected and rerun before the slice is marked complete.

## Verification sequence

1. Verify Docker/Compose and generate ignored local secret if missing.
2. Restore npm dependencies from the checked-in lockfile in Node tooling.
3. Prettier check, TypeScript/Vite production build, Vitest (one worker).
4. Start only the Halluminate DB; run Maven Spotless and JUnit against it.
5. Package the API, start the three runtime services and wait for health.
6. Run real Chromium happy/failure smoke and live API contract checks.
7. Inspect migration history, singleton row count, actual port/resource settings.
8. Recreate only the Halluminate API to verify persistence; simulate an isolated bad DB
   connection without stopping the real DB.
9. Record results. Do not delete the database or claim hosted CI has run.

## Later phases - not started

| Phase | Scope                                                                      | Status                       |
| ----- | -------------------------------------------------------------------------- | ---------------------------- |
| 2     | Domain tables/APIs, permissions, idempotency and state transitions         | Not authorized / not started |
| 3     | DSL, worlds, tool contracts, traces, snapshots, grading/replay/curriculum  | Not started                  |
| 4     | Optional agents behind explicit limits and trace interfaces                | Not started                  |
| 5     | Reliability, retries, observability, tracing, chaos and operational safety | Not started                  |
| 6     | Reproducible benchmarks, limitations, demo and deployment packaging        | Not started                  |

The next phase, after approval, is Phase 2. Start by reading this plan, requirements,
contracts, and existing tests; do not treat the synthetic probe as a domain model.
