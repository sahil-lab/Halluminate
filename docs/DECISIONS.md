# Engineering decisions

## D001 - Follow the guide, stop at Phase 1

Use Java 21 + Spring Boot 3, React + TypeScript and PostgreSQL. The entire PDF is read,
but the user limits execution to Phase 0/1. Domain routes/tables and the later
QA/benchmark/demo prompts remain future work. No affiliation is implied.

## D002 - Prove the plumbing without implementing Phase 2

Use a bootstrap probe, not a task/run domain entity. Accept one fixed fictional fixture.
Persist a unique row and return it through the API to the dashboard. This demonstrates
validation, migration, database access, a real browser flow and failure handling while
keeping stored data bounded and smoke reruns non-destructive.

## D003 - Containerized toolchains and bounded compilation

The host has Node 14 and no Java on PATH. Do not alter either. Run Maven/Java 21, Node
22 LTS and matching Playwright/Chromium in explicitly limited Compose services. Build
artifacts stay inside the project; named dependency caches belong to Compose project
`halluminate`. Runtime services use read-only built artifacts instead of unbounded
multi-stage Docker build processes.

The existing Node container reports v22.23.4, satisfying current Vite, Vitest and jsdom
engine requirements. Public npm metadata and Maven Central were queried before selecting
exact versions; Spring Boot 3.5.16 was the latest published 3.5 release returned.
TypeScript uses the current published version as prescribed by the setup workflow, with
a generated bundler-oriented configuration then checked by compilation. Its root
directory is the web workspace rather than just `src` so the same type-check includes
the root-level Vite configuration.

## D004 - Loopback-only, project-private runtime

Use Compose project `halluminate`, web port 18104 and API port 18204, both bound to
127.0.0.1. The DB has no host port. Runtime containers share an internal network;
API/web additionally use the project's tooling bridge for loopback ingress (D011).
Resource limits are explicit. Do not inspect/change application data in other projects,
prune global state, or stop unrelated containers.

## D005 - No Phase 1 message broker or worker

There is no asynchronous workload in the skeleton. Redis, Kafka and worker services
would add resources and failure modes without proving an approved requirement. Their
interfaces are deferred, not replaced with fallback services.

## D006 - Local secrets and deliberately limited authorization

Generate a cryptographically random password into ignored local storage and mount it
through Docker secrets/config-tree files. Do not hardcode or echo it. A fixed fixture,
strict body validation and Origin checks constrain the local demo. They do not replace
authentication or domain permissions. The database owner performs migration and probe
operations only within this isolated local DB; least-privilege role separation is
required before production.

## D007 - No Git actions or remote CI execution

The guide requests repository creation and logical commits. The explicit user
instruction withholds that approval for Halluminate. Author local files and a CI
workflow, but do not run `git init`, create remotes, commit or push. Local execution is
recorded separately from hosted CI, which this session did not run or verify.

Git metadata appeared concurrently during final inventory validation. The user confirmed
to leave it untouched and finish the evidence/inventory. No Git state was changed in
response, and no approval for future Git operations is inferred.

## D008 - No destructive automatic rollback or cleanup

Use an immutable Flyway V1 with a singleton synthetic table. Repeated checks are safe
and do not require table truncation or volume deletion. A rollback that drops the table
is possible but destructive; document it rather than run it. Preserve the DB and stop
only temporary validation helpers after their checks.

## D009 - Honest baseline observability

Use structured JSON application logs, generated request IDs, and database-aware health
checks now. Do not label request IDs as distributed tracing. OpenTelemetry export,
dashboards and production telemetry are Phase 5 work.

## D010 - Separate bounded startup from request connection acquisition

The first real PostgreSQL integration run failed: a cold, asynchronous pool with zero
idle connections could not produce its first connection within the two-second request
acquisition limit. Tooling-to-DB TCP and password-authenticated `SELECT 1` both
succeeded, ruling out a missing network path or invalid local secret.

Keep one warm connection and allow up to 30 seconds for fail-fast pool startup, while
preserving the two-second request acquisition limit. The driver also has explicit
three-second connect and five-second socket timeouts. The deliberately unreachable-DB
helper alone disables pool startup failure so it can demonstrate live-but-not-ready
behavior. The backend rerun passed 14 HTTP tests and three real PostgreSQL integration
tests. The original failed log is retained.

## D011 - Verify effective publishing, not requested port configuration

On this Docker 29.4.1 engine, containers attached exclusively to an internal bridge had
the requested `HostConfig.PortBindings` but empty effective `NetworkSettings.Ports`.
Five in-network Chromium checks passed, yet both host loopback ports refused
connections. This was caught by the host-level gate.

Attach API/web to the existing project-scoped tooling bridge as well, preserving
explicit 127.0.0.1 bindings and PostgreSQL's internal-only attachment. Do not use host
networking, relax to 0.0.0.0, publish the DB, or modify daemon/firewall settings.
Inspect both requested and effective bindings and require actual host HTTP requests to
succeed.

Trade-off: API/web now have possible outbound connectivity, although they implement no
external integrations. Do not claim network-enforced egress denial; future untrusted
tool execution requires a separately approved isolation design.

An attempted third, dedicated ingress network hit the shared daemon's exhausted default
address pool. Reuse Halluminate's existing bridge instead of pruning other networks,
changing daemon configuration, or guessing a potentially conflicting subnet. Halluminate
therefore uses exactly two project-scoped networks.

Reference:
[Docker port publishing](https://docs.docker.com/engine/network/port-publishing/).

## D012 - Snapshot the JAR before starting Java on a Windows bind mount

A later complete verification passed both builds and all 22 unit/integration tests, but
the isolated failure-helper JVM did not reach Spring startup before its health deadline.
A non-terminating thread dump showed the main thread reading nested JAR entries through
`UnixFileDispatcherImpl.pread0` and Spring Boot's ZIP loader from the Windows bind
mount. This was not a database or out-of-memory failure.

Copy the 28,219,852-byte packaged JAR once into a 96 MiB container tmpfs, then
`exec java` against that startup snapshot. The copy fails explicitly if it cannot
complete. The tmpfs counts against the unchanged 512 MiB container limit. This avoids
repeated random cross-filesystem reads and prevents a subsequent host build from
changing the bytes of a running application's JAR. Startup commands recreate only
API/web after builds to load the new artifacts.

The original failed verification transcript and JVM diagnostic are retained. After this
change, the helper's logs showed successful startup and HTTP 200 health responses. One
retest nevertheless crossed a roughly 20-minute gap in host/engine activity and its
Compose deadline expired. No application fallback or enlarged timeout was added for that
interruption.

The subsequent smoke run and the complete `Verify` command both exited 0. The final run
passed all 27 tests and the host persistence/isolation gate. These are functional
observations, not startup-performance benchmark claims.

## D013 - One hand-written WebGL2 field instead of a graphics library

The user asked twice for a far more ambitious visual result than the first two front
ends. The page is now built around a single full-viewport WebGL2 canvas.

Each particle carries five precomputed positions (orb, contained world, trace, knot,
wave field) as vertex attributes. The vertex shader blends between them from one scroll
value, so a formation change costs no per-frame work in JavaScript. Light is added into
a half-float buffer and tone-mapped, because plain additive blending clipped dense areas
to white. A soft glow is drawn at a quarter of the resolution and added on top.

No three.js, animation library or smooth-scroll library was added. The field, the scroll
director and the pacing rule are about 1,600 lines under `apps/web/src/experience`; the
production script is 268.83 kB (84.94 kB gzipped) including React. The only new
dependency is a second locally bundled font. Styles are still set through the CSSOM, so
the content security policy did not need loosening.

Trade-offs: the shaders and matrix code are ours to maintain; the field needs WebGL2 and
float render targets for its full look, with a direct-draw path and a static gradient
behind it; scrolling is native and is not smoothed or hijacked.

## D014 - Keep the page responsive when the renderer cannot keep up

In the bounded Playwright container WebGL is emulated on one CPU. Animating the field
there held the whole page to about 2 frames a second at 1280x960, and 5 to 7 at the
lightest level. Hiding the canvas alone brought the same page back to 23, so presenting
each frame was the cost and fewer particles could not fix it.

A renderer that reports itself as emulated therefore shows each formation as a still
picture, drawn once when the page reaches it. The page's own loop then measured 60
frames a second in the same container.

On hardware, a small pacing rule steps the field down through four levels and finally
holds it still. It averages real frame intervals over 1.2-second windows and acts only
on two consecutive slow windows, after a 6-second grace period, against budgets of 30,
30, 40 and 50 ms. The first version acted on one window against 22 ms after 2.5 seconds.
A check on this machine's GPU showed it dropping a capable renderer to the third level
during startup hitches, so it was loosened and re-measured. `?quality=` pins a level and
turns the rule off.

Consequence for testing: the container cannot observe continuous animation at realistic
sizes. One browser test pins the lightest level at 640x480 to prove that play changes
the picture and pause freezes it. Continuous animation and frame pacing were checked on
the host GPU with a local helper, outside the automated suite.
