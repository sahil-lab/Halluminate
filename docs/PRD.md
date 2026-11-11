# Product requirements and Phase 0 contract

## Source and mission

The source is `04_Halluminate_Agent_Evals.pdf`, all three pages, including the four
embedded implementation/QA/demo prompts. It describes an independent "Replayable Agent
Evaluation Sandbox": disposable browser/spreadsheet task worlds, deterministic grading,
snapshots, and replayable traces for engineering teams evaluating long-running
knowledge-work agents.

Source SHA-256: `2713410CB2108CA0022706F83594E4AD5E3647EE22D4A3561F1A47E606BD9670`.

The current authorization is narrower than the whole guide: execute Phase 0 and Phase 1
in order. The later prompts establish future requirements, not permission to implement
later phases, commit changes, access real data, or deploy.

## Personas and user stories

1. As a local developer, I can start the stack without installing Java or changing my
   host Node installation.
2. As an evaluator, I can see explicit API/database readiness rather than a misleading
   static "healthy" label.
3. As a developer, I can trigger a fixed synthetic database round trip in the UI and
   inspect the persisted identifier.
4. As a reviewer, I can send an invalid request and receive a structured, non-sensitive
   client error with a correlation identifier.
5. As a maintainer, I can rerun deterministic checks and inspect actual test reports and
   failure artifacts.
6. As a host owner running other projects, I can rely on project-scoped containers,
   loopback ports, no published DB port, and explicit resource ceilings.

## In scope

### Phase 0

README, requirements, architecture diagram, threat model, non-goals, measurable
acceptance criteria, phase plan, decision log, coding conventions, ignore rules, and a
local-equivalent CI workflow. The workspace initially contains only the PDF. There is no
Git repository or branch; Git initialization requires separate approval and is not part
of this execution.

### Phase 1

- Java 21 / Spring Boot 3 API and React / TypeScript dashboard.
- PostgreSQL, local Compose, migrations, database-aware readiness, and liveness.
- One small infrastructure slice: validate a fixed synthetic fixture, insert or retrieve
  its singleton database record, and render the actual result.
- OpenAPI documentation, structured logs, server-generated request IDs.
- Formatting, type-checking, production build, backend/frontend tests, and real Chromium
  E2E smoke checks against the running stack.
- Explicit error states and verified isolation/resource configuration.

## Out of scope

- Phase 2 tables: `task_templates`, `worlds`, `runs`, `actions`, `snapshots`, `grades`;
  domain authorization and retry/state-transition contracts.
- Phase 2 routes: `POST /tasks`, `POST /runs`, `GET /runs/{id}/trace`,
  `POST /runs/{id}/replay`.
- Phase 3 task DSL, seeded browser/spreadsheet worlds, tool runner, traces, snapshots,
  grading, replay, and curriculum generator.
- Phase 4 AI integrations or any real account, real user data, money movement, arbitrary
  command execution, uploaded content, or external agent tools.
- Phase 5 production observability/reliability and Phase 6 benchmarks, public demo
  packaging, cloud deployment, and performance claims.

## Measurable acceptance criteria

| ID    | Requirement                                         | Required evidence                                                                                         |
| ----- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| P0-1  | Read every PDF page and preserve phase ordering     | Source hash, three-page reading record, Phase 0 documents before code                                     |
| P0-2  | State architecture, non-goals, safety and approvals | PRD, architecture, threat model, decisions and plan                                                       |
| P1-1  | No host Java/Node dependency                        | Build/runtime versions from containerized tools and documented one-command workflow                       |
| P1-2  | Local stack is healthy                              | All three runtime services healthy via `docker compose ps`; HTTP readiness/liveness 200                   |
| P1-3  | Flyway schema is real                               | Actual PostgreSQL integration tests and `flyway_schema_history` query show successful V1                  |
| P1-4  | Input is constrained to fictional fixture           | Valid fixture accepted; missing/blank/unknown/incorrect fields and malformed JSON rejected with 400       |
| P1-5  | Persistence round trip is real and bounded          | UI creates/reads probe; GET returns matching ID/fixture/time; repeated requests leave exactly one row     |
| P1-6  | Failure is visible and non-sensitive                | Tests for 404, validation, unavailable database and unavailable API; no false success in UI               |
| P1-7  | Build and automated tests pass                      | Actual Prettier/Spotless, TypeScript/Vite, JUnit, Vitest and Chromium reports                             |
| P1-8  | Isolation is enforced                               | Compose name `halluminate`; only 127.0.0.1:18104/18204 bindings; DB has none; inspected resource ceilings |
| P1-9  | Basic browser safety works                          | Unknown Origin mutation rejected; CSP present; no external browser requests during smoke                  |
| P1-10 | Evidence is honest and reproducible                 | Commands, exit status, counts, artifacts, changed-file inventory, blockers and next phase recorded        |

No Phase 2 or later acceptance criterion is used to claim Phase 1 completion. CI
configuration can be supplied and validated locally, but a hosted CI run is not claimed
unless it actually executes.
