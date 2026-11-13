# Phase 0 and Phase 1 verification

The baseline below records the original 27-test Phase 0/1 run. Two later front-end
changes have their own records at the end of this document: a
[visual refinement](#visual-refinement-follow-up), now superseded, and the current
[cinematic rebuild](#cinematic-rebuild). The shared frontend and E2E report files hold
the latest results, 12 unit tests and 10 browser tests, not the baseline's five and
five.

**Correction to earlier wording.** The saved `*-transcript.txt` and `ui-*.txt` files
list the commands that ran and, for `scripts/dev.ps1`, its closing success lines. They
do not contain the tools' output: Windows PowerShell transcripts did not record the
output of native programs here. Exit codes are in `commands.log`, and results are in the
JUnit XML reports, the Maven log and the JSON state files. Rows below that cite the
"final command transcript" rest on those exit codes and on console output seen during
the run.

## Outcome and authorization

**Phase 0 and Phase 1 complete locally. Phase 2 has not started.**

The entire three-page engineering PDF, including every embedded prompt, was read before
implementation. Phase 0 documents preceded Phase 1 application code. The workspace
initially contained only the PDF; no existing source was replaced. No Git
initialization, commit, remote, push, cloud action, real dataset, account integration,
global Docker pruning, or other-session activation was performed by this session.

**Concurrent change:** the final inventory detected Git metadata that was absent at the
initial inspection. The user explicitly chose to leave it untouched and finish the
evidence/inventory. No Git state was changed in response; its creation is not attributed
to this session or counted as an authored change.

Final full entry-point execution:

```powershell
Set-Location 'C:\Users\upadhsah\Desktop\project\Halluminate'
.\scripts\dev.ps1 -Action Format
.\scripts\dev.ps1 -Action Verify
```

Both commands exited **0**. The final verification ended with:

```text
Verified: effective loopback publishing, internal DB network, resource limits,
Flyway V1, singleton data, API recreation and proxy readiness.
Halluminate action 'Verify' completed successfully.
```

The final persistence gate recorded `2026-11-11T19:59:24.6025062Z`. The command sequence
and closing lines are in
[verify-transcript.txt](../.local/evidence/verify-transcript.txt); the complete
command/exit ledger is [commands.log](../.local/evidence/commands.log). Wall-clock
timings varied substantially during host/engine pauses; no performance benchmark is
inferred from them.

## Verified checks

| Check                            | Actual result                                                                      | Exact evidence                                                |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Docker engine and Compose        | Linux Docker 29.4.1, Compose v5.1.3 responsive                                     | Final command transcript                                      |
| Locked dependency restoration    | `npm ci --no-audit --no-fund` exited 0                                             | Final command transcript and `package-lock.json`              |
| Frontend/config/docs formatting  | Prettier passed                                                                    | Final transcript; final documentation formatting rerun        |
| Java formatting                  | Spotless passed for 11 Java files                                                  | Maven log                                                     |
| Strict type checking             | Web and E2E TypeScript checks passed                                               | Final command transcript                                      |
| Production builds                | Vite build and Maven executable JAR packaging passed                               | Final transcript and Maven log                                |
| Backend HTTP tests               | **14 passed**, 0 failures/errors/skips                                             | Surefire XML                                                  |
| Real PostgreSQL integration      | **3 passed**, 0 failures/errors/skips                                              | Failsafe XML                                                  |
| Frontend tests                   | **5 passed**, 0 failures/errors/skips                                              | Frontend JUnit XML                                            |
| Real Chromium E2E                | **5 passed**, 0 failures/errors/skips                                              | E2E JUnit XML and HTML report                                 |
| Live migration/data              | Exactly one successful migration, V1; exactly one probe row                        | `database-state.json`                                         |
| Host access                      | Web and API loopback requests returned HTTP 200                                    | Runtime gate and host curl checks                             |
| Persistence after API recreation | Same UUID, fixture and creation timestamp; proxy ready                             | `persistence-restart.json`                                    |
| Concurrent isolation             | Correct labels, effective loopback bindings, no DB port, internal DB network       | `runtime-inspection.json`                                     |
| Resource ceilings                | DB 256 MiB/0.50 CPU; API 512 MiB/0.75 CPU; web 96 MiB/0.25 CPU; PID limits checked | `runtime-inspection.json`                                     |
| Cleanup                          | No one-shot tool containers left running; failure helper stopped                   | Final Compose status; helper exited on SIGTERM (143), not OOM |

**Total: 27 passing automated tests; zero failed, errored or skipped tests in the final
run.** These are skeleton tests, not task-success or grader benchmarks.

### What the tests actually exercise

- HTTP validation rejects missing, null, blank, unapproved, numeric, malformed,
  trailing, and unknown JSON input before persistence.
- UUID parsing, unknown IDs, wrong media type, unexpected/null browser Origin, generated
  request IDs, and non-sensitive Problem Details are verified.
- The real PostgreSQL migration runs; duplicate probes preserve identity and timestamp;
  direct unapproved fixture insertion fails the DB constraint.
- The dashboard shows success only after a matching POST/GET persistence round trip.
  Invalid response shapes, readback mismatches, network failure and retry paths do not
  produce false success.
- Real Chromium renders the production dashboard, performs real browser/API/DB
  operations, asserts CSP and no external browser requests, and checks desktop and
  390-pixel mobile layout without horizontal overflow.
- A separate, bounded API helper with an actually unreachable database returns liveness
  200, readiness 503, and mutation 503. The production DB is not stopped for this
  scenario.
- A browser-only network interception additionally verifies the visible failure and
  recovery state; it is not presented as a real DB outage test.

### Persisted synthetic record

```json
{
  "id": "0d9a6dab-cf71-45a8-b9a7-d84175431b3b",
  "fixture": "phase-1-synthetic",
  "createdAt": "2026-11-11T15:24:17.925044Z"
}
```

The same record survived the final API recreation. No database reset or destructive
cleanup was used.

## Exact component commands

All commands are run from the project root. `Verify` performs the necessary setup and
runs these steps in order; component commands require its local secret and installed
dependencies.

```powershell
docker info --format 'Server={{.ServerVersion}} OS={{.OSType}}'
docker compose version
docker compose -p halluminate -f .\infra\docker\compose.yaml config --quiet

docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm ci --no-audit --no-fund
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm run format:check
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm run build
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm test

docker compose -p halluminate -f .\infra\docker\compose.yaml up --detach --wait --wait-timeout 120 db
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps java mvn --batch-mode --no-transfer-progress -f services/api/pom.xml -l /workspace/.local/evidence/maven-verify.log verify
docker compose -p halluminate -f .\infra\docker\compose.yaml up --detach --no-deps --force-recreate --wait --wait-timeout 180 api
docker compose -p halluminate -f .\infra\docker\compose.yaml up --detach --no-deps --force-recreate --wait --wait-timeout 120 web

# Starts and always stops the failure helper; runs Chromium plus host-level gates.
.\scripts\dev.ps1 -Action Smoke
.\scripts\dev.ps1 -Action Status

curl.exe --noproxy '*' --fail http://localhost:18104/healthz
curl.exe --noproxy '*' --fail http://localhost:18204/actuator/health/readiness
```

### Actual toolchain

- Node 22.23.4; TypeScript 7.0.2; React 19.3.1; Vite 8.3.8; Vitest 5.1.0.
- Maven 3.9.11 / build Java 21.0.9; Spring Boot 3.5.16.
- Runtime Temurin Java 21.0.13; PostgreSQL 17.11; Nginx 1.28.3.
- Playwright 1.65.0 with real Chromium 158.0.8127.18.
- Runtime image IDs are in the runtime inspection JSON. Exact npm dependency resolution
  is in the generated lockfile. No host Node/Java changes were made.

## Evidence files

Generated evidence is local and ignored by Git; it contains only the synthetic workflow
and local operational diagnostics. No secret file is included.

- [Test-count summary](../.local/evidence/test-summary.json)
- [Maven build/test log](../.local/evidence/maven-verify.log)
- [HTTP JUnit XML](../services/api/target/surefire-reports/TEST-dev.halluminate.api.bootstrap.ProbeControllerTest.xml)
- [PostgreSQL integration JUnit XML](../services/api/target/failsafe-reports/TEST-dev.halluminate.api.bootstrap.ProbePersistenceIT.xml)
- [Frontend JUnit XML](../.local/evidence/frontend-junit.xml)
- [Chromium JUnit XML](../.local/evidence/e2e-junit.xml)
- [Playwright HTML report](../.local/evidence/playwright-report/index.html)
- [Desktop screenshot](../.local/evidence/halluminate-desktop.png)
- [Mobile screenshot](../.local/evidence/halluminate-mobile.png)
- [Runtime isolation/resource inspection](../.local/evidence/runtime-inspection.json)
- [Actual migration and row counts](../.local/evidence/database-state.json)
- [Persistence across API recreation](../.local/evidence/persistence-restart.json)

## Failures encountered and resolved

1. **Cold connection pool:** the first real integration run exhausted a two-second
   acquisition timeout before a cold asynchronous pool established its first connection.
   TCP and password authentication were tested directly. A bounded startup connection
   plus one warm connection fixed it without lengthening request acquisition. The failed
   Maven log is retained separately.
2. **Internal-only Docker bridge:** requested port mappings existed but effective
   mappings were empty, and host requests failed despite passing container E2E. Attach
   API/web to the existing Halluminate tooling bridge as well. DB remains internal-only;
   inspect effective bindings and require actual host requests.
3. **Shared address-pool exhaustion:** a third network could not be allocated. Reused
   Halluminate's existing network; did not prune or modify any other project or daemon
   settings.
4. **Windows nested-JAR reads:** a diagnostic thread dump showed the JVM doing
   bind-mounted ZIP reads before Spring startup. A bounded tmpfs startup snapshot fixed
   the slow I/O path and makes running artifact bytes immutable.
5. **Host/engine pause:** a retest's logs showed healthy HTTP responses separated by a
   roughly 20-minute activity gap while Compose's deadline expired. The unchanged test
   was rerun, then the entire workflow passed; no checks were disabled and no
   performance claims were made.
6. **Report location:** Playwright interpreted reporter paths relative to its
   configuration folder. Corrected them to the root evidence directory; final XML/HTML
   reports now exist at the documented locations.

The initial connection failure, helper startup failure, diagnostic thread dump, and
host-interruption transcript remain under `.local/evidence` with explicit failure names.
They are not substituted for the final passing reports.

## Exact changed files

All **49** source/configuration/documentation files below are new inside
`C:\Users\upadhsah\Desktop\project\Halluminate`. The lockfile and web TypeScript
configuration were generated with project-local tooling, then the configuration was
adapted to Vite. No files outside this project were authored.

```text
.editorconfig
.gitattributes
.github\workflows\ci.yml
.gitignore
.npmrc
.prettierignore
.prettierrc.json
README.md
package.json
package-lock.json
apps\web\index.html
apps\web\package.json
apps\web\tsconfig.json
apps\web\vite.config.ts
apps\web\src\api.ts
apps\web\src\App.tsx
apps\web\src\App.test.tsx
apps\web\src\main.tsx
apps\web\src\styles.css
apps\web\src\test-setup.ts
docs\ARCHITECTURE.md
docs\CONVENTIONS.md
docs\DECISIONS.md
docs\PLAN.md
docs\PRD.md
docs\THREAT_MODEL.md
docs\VERIFICATION.md
infra\docker\compose.yaml
infra\docker\nginx.conf
packages\contracts\openapi.yaml
scripts\dev.ps1
scripts\verify-runtime.ps1
services\api\pom.xml
services\api\src\main\java\dev\halluminate\api\HalluminateApplication.java
services\api\src\main\java\dev\halluminate\api\bootstrap\Probe.java
services\api\src\main\java\dev\halluminate\api\bootstrap\ProbeController.java
services\api\src\main\java\dev\halluminate\api\bootstrap\ProbeNotFoundException.java
services\api\src\main\java\dev\halluminate\api\bootstrap\ProbeRepository.java
services\api\src\main\java\dev\halluminate\api\bootstrap\ProbeRequest.java
services\api\src\main\java\dev\halluminate\api\http\ApiExceptionHandler.java
services\api\src\main\java\dev\halluminate\api\http\ApiProblems.java
services\api\src\main\java\dev\halluminate\api\http\RequestBoundaryFilter.java
services\api\src\main\resources\application.yaml
services\api\src\main\resources\db\migration\V1__bootstrap_probe.sql
services\api\src\test\java\dev\halluminate\api\bootstrap\ProbeControllerTest.java
services\api\src\test\java\dev\halluminate\api\bootstrap\ProbePersistenceIT.java
tests\e2e\playwright.config.ts
tests\e2e\smoke.spec.ts
tests\e2e\tsconfig.json
```

Additional generated local state: `.local/secrets/db-password` (never printed),
`.local/evidence` reports/screenshots/logs, `apps/web/dist` production assets, and
`services/api/target` compiled classes/JARs/test reports. Dependency caches and DB
storage are Compose-prefixed named volumes. None is a domain dataset.

The original PDF is unchanged, SHA-256:
`2713410CB2108CA0022706F83594E4AD5E3647EE22D4A3561F1A47E606BD9670`.

## Blockers, limitations and next phase

No unresolved blocker remains for the verified local Phase 0/1 skeleton.

- No Git initialization or hosted CI was performed by this session. Concurrent Git
  metadata was left untouched as instructed. The local CI workflow is supplied; a hosted
  run and fresh-clone validation are not claimed.
- This is not production-ready, authenticated, or a hostile-code sandbox. API/web
  outbound connectivity is possible; the DB is private.
- The prototype does not implement task/run APIs, domain permissions, agents, worlds,
  traces, snapshots, grading, replay, curriculum, or benchmarks.
- Future network expansion may require a host-owner decision because the shared daemon
  address pool was exhausted. No global changes were made to resolve it.
- No destructive rollback or data removal was performed; retain the local secret
  alongside the database volume.

**Next phase, only after approval: Phase 2 - core domain data and APIs.** Read the plan,
PRD and tests first; design the six domain tables, API contracts, permission model,
retry/idempotency semantics, and observable state transitions before implementing the
next vertical slice.

## Visual refinement follow-up

**Superseded.** The artwork, layout and tests described in this section were replaced by
the [cinematic rebuild](#cinematic-rebuild). `SignalField.tsx` no longer exists, and the
shared report files now hold the rebuild's results. The section is kept as a record of
what was done and checked at the time.

### Scope and result

The user requested a substantially more ambitious, awards-inspired visual experience.
The result is an original composition, not a copy of an existing site:

- Warm-black and peach art direction, locally bundled variable Space Grotesk, oversized
  type, a custom wordmark symbol, and an editorial light/dark rhythm.
- A procedurally drawn, pointer-responsive luminous toroidal field. No remote image,
  video, AI service, GPU framework, or extra backend is used.
- A visible motion control, reduced-motion stillness, offscreen/hidden-tab suspension, a
  30 FPS render ceiling and a device-pixel-ratio ceiling of 1.75. These are
  implementation limits, not measured performance benchmark results.
- Keyboard skip navigation and real anchors into the live persistence console.
- Existing input constraints, readiness, actual POST/GET readback, visible failures, and
  retry behavior retained. Planned engine capabilities and decorative graphics remain
  explicitly labeled.

No API, database, Compose topology, permission model or domain feature changed. Only the
web runtime was recreated; the original API/database processes remained running. The
isolated unavailable-DB helper was started for E2E and stopped afterward. No Git actions
or other-session operations were performed.

### Checks actually executed

| Check                    | Result                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Prettier                 | Repository-wide format check passed after the final edits                                               |
| TypeScript               | Strict web and E2E type checks passed                                                                   |
| Production Vite build    | Passed; local WOFF2 assets emitted                                                                      |
| Vitest                   | **6 passed**, zero failures/errors/skips                                                                |
| Chromium E2E             | **7 passed**, zero failures/errors/skips                                                                |
| Host readiness           | `http://localhost:18104/actuator/health/readiness` returned HTTP 200 / UP                               |
| Responsive visual checks | Screenshots inspected at mobile, tablet and desktop sizes                                               |
| Reduced motion           | Successive canvas screenshots were byte-identical when paused; explicit play changed the rendered frame |
| Keyboard/mobile          | Skip link focused the live workspace; 320-pixel layout had no horizontal overflow or clipped controls   |
| Browser safety           | Existing CSP, local-only resource requests, request validation and Origin checks still passed           |

The Java sources were not changed; backend unit/integration tests were not rerun for
this frontend-only pass. The seven E2E tests did exercise the real unchanged API and
PostgreSQL as well as the actually unavailable database helper.

The final bounded verification command sequence exited 0. Its command line and timing
are in [ui-redesign-verify.txt](../.local/evidence/ui-redesign-verify.txt); the output
itself was not saved. The report files named there have since been overwritten by the
cinematic rebuild's runs.

Screenshots:

- [1440-pixel desktop hero](../.local/evidence/halluminate-redesign-1440.png)
- [768-pixel tablet hero](../.local/evidence/halluminate-redesign-768.png)
- [Full desktop experience](../.local/evidence/halluminate-redesign-desktop.png)
- [Full mobile experience](../.local/evidence/halluminate-redesign-mobile.png)

### Corrections during verification

The selected font package exports its root stylesheet, not a `latin.css` entry; the
production build exposed this and the import was corrected. Two newly added browser
tests were initially nested inside an existing test; registration was fixed rather than
skipping them. A screenshot-heavy test exceeded its original teardown budget while the
artwork continued animating; deterministic captures now use the actual pause control,
while a separate test still exercises animation. The timeout was not raised. The
renderer also caches trigonometric values per frame instead of recomputing them per
vertex.

Full-page visual inspection exposed an offscreen skip link being captured midway down
the page. It now uses explicit clipping while unfocused and remains keyboard accessible.
Final narrow-screen, motion, keyboard and persistence checks passed.

### Reproduction commands

Run from the Halluminate root with the existing local runtime. Tools remain
containerized; the host Node installation is not used.

```powershell
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm ci --no-audit --no-fund
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm run format:check
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm run build
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm test
docker compose -p halluminate -f .\infra\docker\compose.yaml up --detach --no-deps --force-recreate --wait web

try {
    docker compose -p halluminate -f .\infra\docker\compose.yaml up --detach --no-deps --wait --wait-timeout 180 api-unavailable
    if ($LASTEXITCODE -ne 0) { throw 'Failure helper was not ready.' }
    docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps e2e
    if ($LASTEXITCODE -ne 0) { throw 'E2E tests failed.' }
} finally {
    docker compose -p halluminate -f .\infra\docker\compose.yaml stop api-unavailable
}
```

### Exact files changed in this follow-up

```text
README.md
docs\PLAN.md
docs\VERIFICATION.md
package-lock.json
apps\web\package.json
apps\web\index.html
apps\web\src\main.tsx
apps\web\src\App.tsx
apps\web\src\App.test.tsx
apps\web\src\styles.css
apps\web\src\SignalField.tsx (new)
tests\e2e\smoke.spec.ts
```

The single new dependency is `@fontsource-variable/space-grotesk` 5.3.0, OFL-1.1
licensed and bundled locally. Generated assets/reports stay in the existing ignored
project directories.

No functional blocker remains for the redesigned local UI. No award, production
readiness, complete accessibility certification, cross-browser certification, or
benchmark score is claimed. Phase 2 is still the next unstarted phase and requires
separate approval.

## Cinematic rebuild

### Scope and result

The user said twice that the front end was not the striking, awards-style experience
they expected. The front end was rebuilt around one generative WebGL2 particle field. It
is an original composition, not a copy of an existing site.

- **Field.** 56,000 particles with five formations: an orb, a world held in a cube, a
  branching trace, a knot and a wave field. Scroll position blends between them in the
  vertex shader. Light is accumulated in a half-float buffer and tone-mapped, with a
  soft glow drawn at quarter resolution.
- **Page.** An opening counter, a kinetic hero, a pinned three-chapter story, a premise
  that lights up word by word, a speed-reactive marquee, a glass sandbox console, a
  footer over the wave field, a cursor label and magnetic buttons.
- **Sandbox.** The console shows Write, Read and Compare as each request actually starts
  and finishes. A failure is attributed to the stage that stopped. A pulse runs through
  the field only after a real verified round trip.
- **Labels.** The field is captioned "Generative artwork. Not evaluation data." The
  chapters are tagged "Planned", and the premise lists what is built beside what is not
  implemented.
- **Motion and fallbacks.** A pause control; a paused start with reduced motion; four
  quality levels; still formations on emulated renderers; a static gradient and a
  visible notice without WebGL2. See decisions D013 and D014.

No API, database, Compose topology, permission model or domain feature changed. The only
API-facing change is in the browser client: `checkPersistence` reports each stage as it
begins. Only the web container was recreated; the API and database kept running. The
unavailable-database helper was started for the browser tests and stopped afterwards. No
Git action and no other-session operation was performed.

### Checks actually executed

All of these ran against the final source, in bounded Halluminate containers unless
noted.

| Check               | Result                                                                          |
| ------------------- | ------------------------------------------------------------------------------- |
| Locked dependencies | `npm ci --no-audit --no-fund` exited 0                                          |
| Prettier            | Repository-wide check passed, documentation included                            |
| TypeScript          | Strict web and E2E type checks passed                                           |
| Production build    | Vite build passed; script 268.83 kB (84.94 kB gzipped), styles 27.05 kB         |
| Unit tests          | **12 passed** in 3 files; zero failures, errors or skips                        |
| Chromium E2E        | **10 passed**; zero failures, errors or skips                                   |
| Real GPU            | Headless Edge 157 on this machine's Intel Arc GPU; full quality held, see below |
| Backend             | Sources and Compose files unchanged by hash; backend tests not rerun            |

The output of the final run is saved in
[ui-cinematic-verify.log](../.local/evidence/ui-cinematic-verify.log). Machine reports
are [frontend-junit.xml](../.local/evidence/frontend-junit.xml),
[e2e-junit.xml](../.local/evidence/e2e-junit.xml) and the
[Playwright report](../.local/evidence/playwright-report/index.html).

### What the tests exercise

Browser tests, against the running stack:

- **Round trip.** At full quality the field is lit; the page carries its CSP header; the
  hero link reaches the sandbox; the header steps aside going down and returns going up;
  one click produces three confirmed stages and a persisted ID that the API returns
  again unchanged; the 390-pixel layout does not overflow; there are no page errors,
  console errors or requests to another origin.
- **Opening and cursor.** With motion on, the opening overlay ends and is removed; the
  emulated renderer in the container shows a still field; the cursor label reads "Open"
  over the primary button and clears when the pointer leaves; the pause control works.
- **Scroll story.** The three chapters swap in order, and the orb, world, trace, knot
  and wave field are five different pictures at 56,000 particles.
- **Reduced motion.** Paused frames are byte-identical and no animation is running;
  pressing play changes the picture; pausing freezes it again.
- **No WebGL2.** With WebGL2 withheld, the static backdrop and its notice appear, the
  artwork caption is hidden, and the sandbox still verifies a round trip.
- **Keyboard and 320 pixels.** The skip link focuses the sandbox; nothing overflows; no
  control and no display heading is clipped.
- **Failure and recovery.** A blocked request shows "Check failed" with the first stage
  marked "Stopped here" and no success; the next attempt verifies.
- **API.** The three earlier API tests are unchanged: invalid input, health and Origin
  boundaries, and the really unreachable database.

Unit tests: the seven app tests cover success only after matching readback, failure and
retry, an unreachable network, invalid response shapes, a readback mismatch, the busy
state with per-stage status, and a failed readback attributed to its stage. One test
checks that the formations are repeatable and stay inside the camera's working volume.
Four tests cover the pacing rule.

### Measurements on real hardware

The container has no GPU, so frame pacing was measured separately in headless Edge
157.0.4341.46 on this machine. The renderer reported "ANGLE (Intel, Intel(R) Arc(TM) Pro
Graphics, Direct3D11)". Each figure is three seconds of frames at a 1440x900 viewport.

| Setting                            | Result                                                  |
| ---------------------------------- | ------------------------------------------------------- |
| Full quality, device scale 1       | 59 to 60 frames a second at all six positions           |
| Full quality, device scale 2       | 59.7 to 60 at four positions; 49.7 sandbox, 46.7 footer |
| Median frame, every row            | 16.7 ms                                                 |
| Automatic quality, device scale 2  | Stayed at full quality, animating, 60 at the sandbox    |
| Cursor label on the primary button | Active, reading "Open"                                  |

These are observations on one machine while other workloads were running, not
benchmarks. An earlier run of the same build measured 59 to 60 at every position, and
the sandbox figure with and without the console's background blur differed between runs.
The last run's output is in [gpu-check.txt](../.local/evidence/cinematic/gpu-check.txt).

In the software-rendered container, animating the field held the page to about 2 frames
a second at 1280x960, and 5 to 7 at the lightest level. With the field held still, the
page loop measured 60. Those numbers were read from console output during development
and are not saved as a file. They are the reason for decision D014.

Palette contrast on the flat background colours was computed: every text colour is at
least 4.5:1, the lowest being the dark orange on the light section at 4.51:1. That
calculation does not cover text over the moving field, which is kept readable with dark
gradients and text halos and was checked by eye.

### Screenshots

In [.local/evidence/cinematic](../.local/evidence/cinematic):

- `g-*.png`: real GPU, animated. [Hero](../.local/evidence/cinematic/g-hero.png),
  [world](../.local/evidence/cinematic/g-world.png),
  [trace](../.local/evidence/cinematic/g-trace.png),
  [knot](../.local/evidence/cinematic/g-loop.png),
  [sandbox](../.local/evidence/cinematic/g-sandbox.png),
  [footer](../.local/evidence/cinematic/g-footer.png),
  [hover label](../.local/evidence/cinematic/g-live-hover.png),
  [a formation mid-change](../.local/evidence/cinematic/g-live-morph.png) and
  [the premise lighting up](../.local/evidence/cinematic/g-live-words.png).
- `d-*.png`: 1440x900 still frames at full quality, top to bottom, including the
  [verified console](../.local/evidence/cinematic/d-09-console-verified.png).
- `m-*.png`: the same walk at 390x844.
- `i-*.png`: the opening sequence, held with a paused clock.

### Corrections during verification

- **Blown-out light.** Additive blending clipped dense areas to white. Light is now
  accumulated in a half-float buffer and tone-mapped. Support was checked first, and a
  direct-draw path remains for browsers without float render targets.
- **Unreadable shapes.** The first trace was a flat smear and the knot turned edge-on
  into a tangle. The trace became braided strands with recorded steps and faint
  branches, and the knot now turns in its own plane.
- **Cursor label.** A page-level `data-cursor` flag was matched by the lookup for
  per-element labels, so the label read "on" everywhere. The flag was renamed and a
  browser test now checks the label and its clearing.
- **Header.** The fixed header collided with content mid-page. It now has a backing bar,
  steps aside on the way down, and switches to dark text over the light section.
- **First full run.** Two of nine browser tests failed. The animation check timed out
  because software-rendered screenshots took about seven seconds each. At 320 pixels the
  "Meet the idea" link ran off the edge because the hero actions could not wrap. The
  layout was fixed, and the animation check now uses a small viewport at the lightest
  level. That run's output was not preserved.
- **Whole page slow in software.** Measured, then resolved by decision D014 rather than
  by removing the field.
- **Pacing rule too eager.** On the real GPU the first rule dropped a capable renderer
  to the third level during startup. It now needs two consecutive slow windows after a
  grace period, and was re-measured holding full quality.
- **Glow cost.** At device scale 2 the sandbox first measured 36.7 frames a second. The
  glow moved to a quarter-resolution buffer and the drawing buffer gained a pixel cap.
- **Legibility.** Small labels over the field gained dark gradients and halos, the
  sandbox backdrop is dimmed, and the non-affiliation notice sits on a solid strip.
- **Opening sequence.** A slow renderer could hold the counter back, so it now always
  ends within 4.5 seconds, and a browser test asserts that it ends.

### Limits of this verification

- Continuous animation is not covered by the automated suite, because the container
  renders in software. It was checked on the host GPU with a local helper.
- Only Chromium-family browsers were exercised: Playwright's Chromium and headless Edge.
  Firefox and Safari were not tested, and no physical phone was used.
- The per-test time limit in the browser suite was raised from 30 to 60 seconds for
  software-rendered frames. The 10-second limit on each assertion is unchanged, and the
  slowest test in the final run took about 23 seconds.
- No automated accessibility audit and no screen-reader pass was run.
- No award, production readiness or benchmark score is claimed.

### Reproduction commands

Run from the Halluminate root with the local runtime up. The browser suite takes about
two minutes.

```powershell
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm ci --no-audit --no-fund
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm run format:check
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm run build
docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps node npm test
docker compose -p halluminate -f .\infra\docker\compose.yaml up --detach --no-deps --force-recreate --wait web

try {
    docker compose -p halluminate -f .\infra\docker\compose.yaml up --detach --no-deps --wait --wait-timeout 180 api-unavailable
    if ($LASTEXITCODE -ne 0) { throw 'Failure helper was not ready.' }
    docker compose -p halluminate -f .\infra\docker\compose.yaml run --rm --no-deps e2e
    if ($LASTEXITCODE -ne 0) { throw 'E2E tests failed.' }
} finally {
    docker compose -p halluminate -f .\infra\docker\compose.yaml stop api-unavailable
}
```

The real-GPU measurement and the `d-`, `m-` and `i-` screenshots came from two helper
scripts in the ignored `.local/tools` folder. They are local scratch tools, not part of
the source inventory. The GPU helper starts headless Edge with a throwaway profile
inside this project and removes the profile afterwards.

### Exact files changed in this rebuild

Relative to the visual refinement above:

```text
README.md
docs\PLAN.md
docs\DECISIONS.md
docs\VERIFICATION.md
package-lock.json
apps\web\package.json
apps\web\index.html
apps\web\src\main.tsx
apps\web\src\api.ts
apps\web\src\App.tsx
apps\web\src\App.test.tsx
apps\web\src\styles.css
apps\web\src\SignalField.tsx (deleted)
apps\web\src\experience\Experience.tsx (new)
apps\web\src\experience\director.ts (new)
apps\web\src\experience\field.ts (new)
apps\web\src\experience\pacing.ts (new)
apps\web\src\experience\pacing.test.ts (new)
apps\web\src\experience\shapes.ts (new)
apps\web\src\experience\shapes.test.ts (new)
apps\web\src\experience\signals.ts (new)
tests\e2e\playwright.config.ts
tests\e2e\smoke.spec.ts
```

The one new dependency is `@fontsource/instrument-serif` 5.3.0, OFL-1.1 licensed and
bundled locally. The previous front-end sources are kept in the ignored
`.local/ui-v2-backup` folder and can be deleted once they are no longer wanted.

Phase 2 is still the next unstarted phase and requires separate approval.
