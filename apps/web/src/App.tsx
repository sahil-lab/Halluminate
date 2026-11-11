import { useEffect, useState } from "react";
import { checkPersistence, checkReadiness, type Probe } from "./api";

type Health = "checking" | "ready" | "unavailable";
type Check =
  | { status: "idle" }
  | { status: "running" }
  | { status: "passed"; probe: Probe }
  | { status: "failed"; message: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error prevented the check. Inspect local API logs.";
}

export function App() {
  const [health, setHealth] = useState<Health>("checking");
  const [healthError, setHealthError] = useState("");
  const [check, setCheck] = useState<Check>({ status: "idle" });

  async function refreshHealth() {
    setHealth("checking");
    setHealthError("");
    try {
      await checkReadiness();
      setHealth("ready");
    } catch (error: unknown) {
      setHealth("unavailable");
      setHealthError(errorMessage(error));
    }
  }

  useEffect(() => {
    void refreshHealth();
  }, []);

  async function runCheck() {
    setCheck({ status: "running" });
    try {
      const probe = await checkPersistence();
      setCheck({ status: "passed", probe });
    } catch (error: unknown) {
      setCheck({ status: "failed", message: errorMessage(error) });
    }
    await refreshHealth();
  }

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Halluminate home">
          <span className="brand-mark" aria-hidden="true">
            H
          </span>
          Halluminate
        </a>
        <span className="local-badge">LOCAL / SYNTHETIC ONLY</span>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">REPLAYABLE AGENT EVALUATION SANDBOX</p>
          <h1 id="page-title">
            A reliable foundation.
            <br />
            Before the first agent.
          </h1>
          <p className="intro-copy">
            Verify the browser, API, and database connection in an isolated local
            environment. No agents. No real accounts. Just the working skeleton.
          </p>
          <div className="phase-label">Phase 01 / Working skeleton</div>
        </section>

        <div className="dashboard-grid">
          <section className="card" aria-labelledby="system-heading">
            <div className="card-heading">
              <span className="step-number">01</span>
              <h2 id="system-heading">System readiness</h2>
            </div>
            <p className="muted">
              Readiness checks the API and its live PostgreSQL connection.
            </p>
            <div className={`health-state health-${health}`} role="status">
              <span className="status-dot" aria-hidden="true" />
              {health === "checking" && "Checking local services..."}
              {health === "ready" && "API and database ready"}
              {health === "unavailable" && "Local services unavailable"}
            </div>
            {health === "unavailable" && <p role="alert">{healthError}</p>}
            <ul className="service-list">
              <li>
                <span>Dashboard</span>
                <span>React + TypeScript</span>
              </li>
              <li>
                <span>Orchestration API</span>
                <span>Java 21 / Spring Boot 3</span>
              </li>
              <li>
                <span>Persistence</span>
                <span>PostgreSQL / Flyway</span>
              </li>
            </ul>
            <button
              className="button secondary"
              onClick={() => void refreshHealth()}
              disabled={health === "checking" || check.status === "running"}
            >
              Refresh readiness
            </button>
          </section>

          <section className="card probe-card" aria-labelledby="probe-heading">
            <div className="card-heading">
              <span className="step-number">02</span>
              <h2 id="probe-heading">Verify a round trip</h2>
            </div>
            <p className="muted">
              Persist one fixed fictional fixture, read it back, and compare the result.
              Repeated checks reuse the same record.
            </p>
            <div className="fixture">
              <span className="eyebrow">APPROVED FIXTURE</span>
              <code>phase-1-synthetic</code>
            </div>
            <button
              className="button primary"
              onClick={() => void runCheck()}
              disabled={check.status === "running"}
            >
              {check.status === "running" ? "Verifying..." : "Run synthetic check"}
            </button>

            <div className="check-output" aria-live="polite">
              {check.status === "idle" && (
                <p className="muted">No check has been run in this browser session.</p>
              )}
              {check.status === "running" && <p>Writing and reading the fixture...</p>}
              {check.status === "failed" && (
                <div role="alert" className="error">
                  <strong>Check failed</strong>
                  <p>{check.message}</p>
                </div>
              )}
              {check.status === "passed" && (
                <div className="success">
                  <strong>Persistence verified</strong>
                  <dl>
                    <dt>Persisted ID</dt>
                    <dd data-testid="probe-id">{check.probe.id}</dd>
                    <dt>Created at (UTC)</dt>
                    <dd>{check.probe.createdAt}</dd>
                  </dl>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="scope-note" aria-labelledby="scope-heading">
          <span className="scope-tag">SCOPE BOUNDARY</span>
          <div>
            <h2 id="scope-heading">
              Plumbing verified does not mean agents evaluated.
            </h2>
            <p>
              Task worlds, runs, traces, grading, replay, and benchmarks belong to later
              phases. They are not implemented here.
            </p>
          </div>
        </aside>
      </main>

      <footer>
        <span>Independent prototype. Not affiliated with Halluminate.</span>
        <span>Loopback only / No external integrations</span>
      </footer>
    </div>
  );
}
