# Threat model and safety boundaries

## Assets and assumptions

Assets are the host machine, other concurrently running projects, the local database
password, build dependencies, and synthetic probe integrity. The host user and Docker
daemon are trusted. There are no real users, accounts, financial connections, uploaded
datasets, LLM credentials, or agent tools.

Loopback access is not user authentication. This development stack must not be published
on a LAN or internet-facing interface. Docker administrators can read containers and
local secrets; no protection against a compromised host is claimed.

## Boundaries and controls

| Threat                                   | Phase 1 control                                                                         | Verification / residual risk                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Changes affect other project sessions    | Work only under Halluminate; explicit Compose project; project-scoped commands          | Inspect labels, ports and limits; never prune or stop other containers                  |
| Remote access to local services          | Publish only 127.0.0.1:18104 and 127.0.0.1:18204; no DB binding                         | Inspect actual bindings; Docker daemon remains trusted                                  |
| Arbitrary or real data enters storage    | Strict JSON DTO, fixed fixture, DB check + unique constraints                           | Invalid/extra fields rejected; DB holds at most one fictional row                       |
| Injection through fixture or identifier  | Bean validation, typed UUID and parameterized SQL                                       | Negative input tests; no interpolation or command execution                             |
| Cross-origin website performs writes     | Same-origin proxy, explicit Origin allowlist, JSON-only mutation                        | Reject unexpected/null Origins; no-Origin CLI access is not authentication              |
| API failure is presented as success      | Non-2xx handling and runtime response guards; explicit UI error                         | Frontend tests and browser failure path                                                 |
| DB is unavailable but API is "ready"     | Readiness includes actual DB health; query errors return 503                            | Test actual connectivity loss without stopping other containers                         |
| Secrets or internals leak in logs/errors | Secret files, generic Problem Details, generated request IDs, no request-body logs      | Inspect representative error/log output; no credentials in artifacts                    |
| Browser loads untrusted content          | No external assets, restrictive CSP, no HTML injection APIs                             | Browser verifies CSP and local-only requests                                            |
| Resource exhaustion                      | Container CPU/memory/PID limits, bounded singleton table, one test worker               | Inspect container limits; public-service rate limiting is not implemented               |
| Dependency compromise                    | Pinned dependencies, npm lockfile, bounded tooling separate from runtime                | No package security certification claimed; review updates before adopting               |
| Runtime egress/data leakage              | DB is internal-only; API/web have a project ingress bridge and no external integrations | API/web can make outbound connections; no egress-firewall or hostile-code sandbox claim |
| Data destruction during validation       | No automatic volume deletion or destructive SQL; repeatable singleton check             | Persistence test preserves ID across API recreation                                     |

## Human approval gates

Separate approval is required before:

- Git initialization, branches, commits, remotes, pushes, or pull requests.
- Removing volumes/data, applying destructive migrations, or global Docker actions.
- Accessing real user data, real accounts, credentials, or money movement.
- Cloud provisioning, spending, external deployment, or publishing services.
- Expanding file scope, activating other sessions, or implementing Phase 2+.
- Introducing arbitrary tool execution, filesystem access, uploads, browser automation
  against external sites, or remote AI providers.

Downloading public package/container dependencies is required for the approved local
build; it does not authorize sending project code or data to a third party. The CI
workflow is authored locally but not dispatched to a remote service.

## Future safety work, not a Phase 1 claim

Before any real evaluator-facing feature: authentication and per-object authorization,
separate runtime/migration DB roles, explicit task/tool schemas, budgets/timeouts,
immutable trace attribution, isolation appropriate for untrusted execution, permissioned
snapshots, and audit retention rules.

Security review and adversarial engine benchmarks from the PDF's later prompts are
deferred. This document is a threat model, not a penetration-test report.
