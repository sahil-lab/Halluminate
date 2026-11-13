# Execution plan and progress

## Authorization and source

Only Phase 0 then Phase 1 are authorized. All three pages of
`04_Halluminate_Agent_Evals.pdf` and its embedded prompts were read before
implementation. The initial workspace contained only that guide. Git was absent; no Git
initialization is attempted.

During final inventory validation, Git metadata appeared that had not existed at the
initial inspection. The user confirmed: leave it untouched and finish the
evidence/inventory. No Git operation was performed in response; Git metadata is excluded
from the authored-file inventory.

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

- [x] Bootstrap Java 21 / Spring Boot 3 API and React / TypeScript dashboard.
- [x] Add PostgreSQL, Flyway V1, liveness/readiness and secret-file configuration.
- [x] Implement strict synthetic probe validation and durable readback.
- [x] Wire UI success, loading, unavailable and retry states.
- [x] Supply OpenAPI, structured logging and basic browser boundary controls.
- [x] Supply bounded Compose tooling/runtime and a reproducible entry script.
- [x] Run formatting, compilation, unit/integration tests and Chromium smoke.
- [x] Verify actual DB persistence, runtime isolation and failure behavior.
- [x] Record exact commands, outcomes, file inventory, limitations and blockers.

Only executed, successful checks may change these checkboxes. A failing check must be
corrected and rerun before the slice is marked complete.

Final `scripts/dev.ps1 -Action Verify` exited **0**. The final host persistence gate
recorded `2026-11-11T19:59:24.6025062Z`. Results: 14 JUnit HTTP tests, three real
PostgreSQL integration tests, five Vitest tests, and five Chromium E2E tests passed;
zero failures/errors/skips. Formatting, TypeScript/Vite, Maven packaging, effective
loopback publishing, resource limits, Flyway V1 and API-restart persistence passed. The
temporary unavailable-DB helper is stopped. See [exact evidence](VERIFICATION.md).

Cold connection initialization, Docker internal-network port publication, exhausted
shared address pools, and Windows bind-mounted JAR startup were diagnosed and fixed
without changing other projects. Earlier failures are retained separately from the
successful final run. A host-pause timeout was rerun, not suppressed.

## Verification sequence

### Cinematic rebuild - requested after the visual refinement

The visual refinement below was not the experience the user asked for. The front end was
rebuilt; the previous sources are kept in the ignored `.local/ui-v2-backup` folder.

- [x] Draw one WebGL2 particle field with five formations, tone mapping and a soft glow.
- [x] Drive the formations, a pinned three-chapter story, the word-by-word premise and
      the marquee from scroll, using native scrolling.
- [x] Rebuild the page: opening counter, hero, story, premise, glass sandbox console,
      footer wave field, cursor label and magnetic controls.
- [x] Show the real write, read and compare stages, and attribute a failure to its
      stage.
- [x] Keep the artwork and planned capabilities labelled; keep the API behaviour as is.
- [x] Pause control, reduced-motion start, static fallback without WebGL2.
- [x] Step quality down when frames stay slow; hold the field still on emulated
      renderers.
- [x] Pass formatting, the production build, 12 unit tests and 10 real Chromium tests.
- [x] Measure frame pacing and inspect the result on this machine's GPU in headless
      Edge.
- [x] Inspect desktop, 390-pixel and 320-pixel layouts, the opening sequence and live
      states.
- [x] Leave the API, database, Compose topology, Git metadata and other projects
      untouched.

Backend sources are unchanged and backend unit tests were not rerun for this front-end
change. See [the cinematic rebuild record](VERIFICATION.md#cinematic-rebuild) and
decisions D013 and D014.

### Visual refinement - requested after the Phase 1 baseline (superseded)

- [x] Replace the starter cards with an original cinematic/editorial visual direction.
- [x] Bundle the display font locally and implement a pointer-responsive canvas
      sculpture.
- [x] Preserve the real probe, readiness, failures and honest feature boundaries.
- [x] Provide reduced-motion stillness, a play/pause control and keyboard navigation.
- [x] Compile production assets and pass repository formatting.
- [x] Pass six frontend tests and seven real Chromium E2E tests, with no skipped tests.
- [x] Inspect 320/390-pixel mobile, 768-pixel tablet and 1280/1440-pixel desktop
      behavior.
- [x] Leave the original API/database processes and all other projects untouched.

The latest frontend/browser reports replace their shared report filenames. The original
27-test baseline and full verification transcript remain a historical record, not a
claim that backend unit tests were rerun for this visual-only change. This refinement's
canvas artwork and layout were replaced by the cinematic rebuild above; its record is
kept as history in
[the visual-refinement evidence](VERIFICATION.md#visual-refinement-follow-up).

### Full stack verification

1. Verify Docker/Compose and generate ignored local secret if missing.
2. Restore npm dependencies from the project lockfile in Node tooling.
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
