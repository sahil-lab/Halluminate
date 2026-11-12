import { useEffect, useState } from "react";
import { checkPersistence, checkReadiness, type Probe } from "./api";
import { SignalField } from "./SignalField";

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

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="arrow-icon">
      <path
        d={diagonal ? "M5 19 19 5M5 5h14v14" : "M4 12h16m-7-7 7 7-7 7"}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
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
    <div className="site-shell" id="top">
      <a className="skip-link" href="#workspace">
        Skip to live sandbox
      </a>
      <header className="site-header page-gutter">
        <a className="brand" href="#top" aria-label="Halluminate home">
          <svg
            className="brand-symbol"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
          >
            <path d="M8 3v30M28 3v30M8 18h20M13 8l10 20M23 8 13 28" />
          </svg>
          <span>
            halluminate<span className="brand-period">.</span>
          </span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#concept">
            The idea <span>01</span>
          </a>
          <a href="#workspace">
            Live sandbox <Arrow diagonal />
          </a>
        </nav>
        <div className={`header-status health-${health}`}>
          <span className="status-dot" aria-hidden="true" />
          <span>LOCAL ENVIRONMENT</span>
        </div>
      </header>

      <main>
        <section className="hero page-gutter" aria-labelledby="page-title">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow">
              <span className="tiny-star" aria-hidden="true">
                +
              </span>
              INTELLIGENCE DESERVES UNDERSTANDING
            </p>
            <h1 id="page-title">
              <span>Make the</span>
              <span>unknown</span>
              <span className="accent-word">
                repeatable<span className="title-period">.</span>
              </span>
            </h1>
            <p className="hero-description">
              A new perspective on agent evaluation.
              <br />
              An independent experiment in making complex behavior something we can
              understand.
            </p>
            <div className="hero-actions">
              <a className="button button-accent" href="#workspace">
                Open live sandbox <Arrow diagonal />
              </a>
              <a className="text-link" href="#concept">
                Meet the idea <span aria-hidden="true">+</span>
              </a>
            </div>
          </div>
          <SignalField />
          <div className="hero-baseline">
            <a className="scroll-cue" href="#concept">
              <span className="scroll-arrow" aria-hidden="true">
                <Arrow />
              </span>
              SCROLL TO DISCOVER
            </a>
            <span>
              INDEPENDENT PROTOTYPE <span className="baseline-divider">/</span> CHAPTER
              001
            </span>
          </div>
        </section>

        <section
          className="concept page-gutter"
          id="concept"
          aria-labelledby="concept-heading"
        >
          <div className="section-index">
            <span>01 / THE IDEA</span>
            <span>A NORTH STAR, NOT A FEATURE CLAIM</span>
          </div>
          <div className="concept-intro">
            <h2 id="concept-heading">
              Less black box.
              <br />
              <span>More understanding.</span>
            </h2>
            <p>
              When agents take the unexpected path, the interesting question isn't just{" "}
              <em>what happened.</em> It's whether we can understand it, learn from it,
              and follow that path again.
            </p>
          </div>
          <div className="principles">
            <article className="principle">
              <div className="principle-visual">
                <svg viewBox="0 0 240 110" fill="none" aria-hidden="true">
                  <path d="M66 20h108v70H66zM46 35h148v40H46zM88 4h64v102H88z" />
                  <path className="diagram-accent" d="M108 43h24v24h-24z" />
                  <path d="M16 55h30m148 0h30M120 0v4m0 102v4" strokeDasharray="2 4" />
                </svg>
                <span>01</span>
              </div>
              <h3>Isolate the world.</h3>
              <p>
                The vision: disposable task worlds. A controlled place to explore,
                without consequences for the real one.
              </p>
              <span className="future-label">PLANNED / TASK WORLDS</span>
            </article>
            <article className="principle">
              <div className="principle-visual">
                <svg viewBox="0 0 240 110" fill="none" aria-hidden="true">
                  <path d="M23 78 71 35l49 38 48-48 49 31M23 93V20m48 73V20m49 73V20m48 73V20m49 73V20" />
                  <circle cx="71" cy="35" r="5" className="diagram-accent" />
                  <circle cx="168" cy="25" r="5" className="diagram-accent" />
                  <path d="M23 94h194" strokeDasharray="2 4" />
                </svg>
                <span>02</span>
              </div>
              <h3>Follow the thought.</h3>
              <p>
                The vision: action traces and snapshots. Turn an opaque outcome into a
                sequence worth understanding.
              </p>
              <span className="future-label">PLANNED / OBSERVABILITY</span>
            </article>
            <article className="principle">
              <div className="principle-visual">
                <svg viewBox="0 0 240 110" fill="none" aria-hidden="true">
                  <circle cx="120" cy="55" r="37" />
                  <circle cx="120" cy="55" r="24" strokeDasharray="2 4" />
                  <path d="M83 55H45m150 0h-38M120 18V4m0 102V92" />
                  <path
                    className="diagram-accent"
                    d="m151 26 7 17-18-3M109 45l20 10-20 10Z"
                  />
                </svg>
                <span>03</span>
              </div>
              <h3>Return to the why.</h3>
              <p>
                The vision: deterministic grading and replay. Revisit the turning point,
                not just the final answer.
              </p>
              <span className="future-label">PLANNED / REPLAY</span>
            </article>
          </div>
          <div className="concept-footnote">
            <span className="tiny-star" aria-hidden="true">
              +
            </span>
            <p>
              Big questions. An honest starting point. The live experiment below
              verifies the foundation; these capabilities come later.
            </p>
          </div>
        </section>

        <section
          className="workspace page-gutter"
          id="workspace"
          aria-labelledby="workspace-heading"
          tabIndex={-1}
        >
          <div className="section-index">
            <span>02 / THE LIVE SANDBOX</span>
            <span className="chapter-tag">
              PHASE 01 &nbsp; / &nbsp; WORKING SKELETON
            </span>
          </div>
          <div className="workspace-intro">
            <h2 id="workspace-heading">
              Small test.
              <br />
              <span>Real proof.</span>
            </h2>
            <p>
              No simulated success. Send a fixed fictional fixture through the running
              stack. Write it. Read it. Verify it.
            </p>
          </div>

          <div className="workspace-grid">
            <section className="system-panel" aria-labelledby="system-heading">
              <p className="eyebrow">THE CONNECTION</p>
              <h3 id="system-heading">
                Three layers.
                <br />
                One round trip.
              </h3>
              <div className={`health-state health-${health}`} role="status">
                <span className="status-dot" aria-hidden="true" />
                {health === "checking" && "Checking local services..."}
                {health === "ready" && "API and database ready"}
                {health === "unavailable" && "Local services unavailable"}
              </div>
              {health === "unavailable" && (
                <p className="health-error" role="alert">
                  {healthError}
                </p>
              )}
              <ol className="service-list">
                <li>
                  <span className="service-number">01</span>
                  <div>
                    <strong>Interface</strong>
                    <span>React + TypeScript</span>
                  </div>
                  <span className="service-marker" aria-hidden="true">
                    /
                  </span>
                </li>
                <li>
                  <span className="service-number">02</span>
                  <div>
                    <strong>Orchestration</strong>
                    <span>Java 21 / Spring Boot 3</span>
                  </div>
                  <span className="service-marker" aria-hidden="true">
                    /
                  </span>
                </li>
                <li>
                  <span className="service-number">03</span>
                  <div>
                    <strong>Persistence</strong>
                    <span>PostgreSQL / Flyway</span>
                  </div>
                  <span className="service-marker" aria-hidden="true">
                    /
                  </span>
                </li>
              </ol>
              <button
                className="text-button"
                onClick={() => void refreshHealth()}
                disabled={health === "checking" || check.status === "running"}
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M16 9a6 6 0 1 0-1 4M16 3v6h-6" />
                </svg>
                Refresh readiness
              </button>
              <p className="panel-note">
                Readiness queries the live database.
                <br />
                No accounts. No external integrations.
              </p>
            </section>

            <section
              className={`probe-console check-${check.status}`}
              aria-labelledby="probe-heading"
              aria-busy={check.status === "running"}
            >
              <div className="console-bar">
                <span>
                  <span className="console-indicator" aria-hidden="true" /> halluminate
                  / bootstrap
                </span>
                <span>LOCAL ONLY</span>
              </div>
              <div className="console-body">
                <div className="console-title">
                  <div>
                    <p className="eyebrow">PERSISTENCE PROBE</p>
                    <h3 id="probe-heading">A little evidence goes a long way.</h3>
                  </div>
                  <span className="probe-symbol" aria-hidden="true">
                    <Arrow diagonal />
                  </span>
                </div>
                <div className="request-preview">
                  <div className="request-route">
                    <span>POST</span>
                    <code>/api/bootstrap/probes</code>
                  </div>
                  <pre>
                    <code>
                      <span className="code-bracket">{"{"}</span>
                      {"\n"} <span className="code-key">"fixture"</span>:{" "}
                      <span className="code-value">"phase-1-synthetic"</span>
                      {"\n"}
                      <span className="code-bracket">{"}"}</span>
                    </code>
                  </pre>
                  <span className="request-note">
                    ONE FICTIONAL FIXTURE. ALWAYS THE SAME RECORD.
                  </span>
                </div>
                <button
                  className="button button-accent run-button"
                  onClick={() => void runCheck()}
                  disabled={check.status === "running"}
                >
                  {check.status === "running" ? "Verifying..." : "Run synthetic check"}
                  {check.status === "running" ? (
                    <span className="working-indicator" aria-hidden="true" />
                  ) : (
                    <Arrow />
                  )}
                </button>
                <div className="check-output" aria-live="polite" aria-atomic="true">
                  {check.status === "idle" && (
                    <div className="idle-output">
                      <span aria-hidden="true">[ &nbsp; ]</span>
                      <p>
                        Ready when you are.
                        <br />
                        <span>No check run in this browser session.</span>
                      </p>
                    </div>
                  )}
                  {check.status === "running" && (
                    <p className="running-output">Writing and reading the fixture...</p>
                  )}
                  {check.status === "failed" && (
                    <div role="alert" className="error-output">
                      <span className="result-label">REQUEST UNSUCCESSFUL</span>
                      <strong>Check failed</strong>
                      <p>{check.message}</p>
                      <span>No success recorded. You can try again.</span>
                    </div>
                  )}
                  {check.status === "passed" && (
                    <div className="success-output">
                      <span className="result-label">
                        <span className="status-dot" aria-hidden="true" /> WRITE +
                        READBACK MATCHED
                      </span>
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
              </div>
              <div className="console-footer">
                <span>
                  POST <span aria-hidden="true">&rarr;</span> GET{" "}
                  <span aria-hidden="true">&rarr;</span> COMPARE
                </span>
                <span>NO FABRICATED RESULTS</span>
              </div>
            </section>
          </div>
          <aside className="scope-note">
            <span className="scope-label">A NOTE ON SCOPE</span>
            <p>
              A foundation, not a finished engine. Task worlds, runs, traces, snapshots,
              grading, replay, and benchmarks are not implemented here.
            </p>
            <span className="scope-asterisk" aria-hidden="true">
              *
            </span>
          </aside>
        </section>
      </main>

      <footer className="site-footer page-gutter">
        <div className="footer-top">
          <span>THE FUTURE IS WORTH UNDERSTANDING.</span>
          <a href="#top" className="back-to-top">
            Back to the beginning <Arrow diagonal />
          </a>
        </div>
        <div className="footer-wordmark" aria-hidden="true">
          halluminate<span>.</span>
        </div>
        <div className="footer-bottom">
          <span>Independent prototype. Not affiliated with Halluminate.</span>
          <span>BUILT FOR CURIOSITY. BOUNDED BY DESIGN.</span>
        </div>
      </footer>
    </div>
  );
}
