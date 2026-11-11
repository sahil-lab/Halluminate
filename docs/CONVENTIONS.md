# Coding and validation conventions

- Use the guide's monorepo boundaries and keep all authored files in this project.
- Use Java records for immutable API DTOs, constructor injection, bean validation and
  parameterized JDBC. Keep applied Flyway migrations immutable.
- Use strict TypeScript, typed request/response boundaries and runtime validation for
  network results. Do not hide errors behind fallback success data.
- Run Prettier for web/config/docs and Spotless/Google Java Format for Java. Formatters
  are authoritative; do not manually reproduce generated lockfiles.
- Pin direct dependencies; commit a lockfile only after separately approved Git actions.
  `npm ci` consumes, and does not regenerate, the lockfile.
- Keep code ASCII unless the file/product explicitly requires other characters. Comment
  only non-obvious logic. Do not log bodies or credentials.
- Use unit tests for UI/error branches, real PostgreSQL integration tests for the
  migration/repository, and real Chromium against the running Compose stack.
- Run tooling sequentially within container limits. A red check blocks completion.
- Preserve failure evidence when useful, and record later successful reruns accurately.
  Do not invent test counts or benchmark results.
- Keep CI behavior equivalent to local `scripts/dev.ps1 -Action Verify`. A local pass
  does not establish a remote CI pass.
- Do not add domain features, tool execution, cloud deployment, or destructive cleanup
  to solve a skeleton-only problem.
