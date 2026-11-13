import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import {
  checkPersistence,
  checkReadiness,
  type Probe,
  type RoundTripStage,
} from "./api";
import { Experience } from "./experience/Experience";
import { announceVerified } from "./experience/signals";

type Health = "checking" | "ready" | "unavailable";
type StepState = "idle" | "active" | "done" | "failed";
type Check =
  | { status: "idle" }
  | { status: "running"; stage: RoundTripStage }
  | { status: "passed"; probe: Probe }
  | { status: "failed"; stage: RoundTripStage; message: string };

const STEPS: readonly { stage: RoundTripStage; verb: string; detail: string }[] = [
  { stage: "write", verb: "Write", detail: "POST /api/bootstrap/probes" },
  { stage: "read", verb: "Read", detail: "GET /api/bootstrap/probes/{id}" },
  { stage: "compare", verb: "Compare", detail: "id · fixture · createdAt" },
];

const STEP_LABEL: Record<StepState, string> = {
  idle: "Waiting",
  active: "In flight",
  done: "Confirmed",
  failed: "Stopped here",
};

const CHAPTERS = [
  {
    lead: "Isolate",
    rest: "the",
    accent: "world.",
    body: "The vision: disposable task worlds. A controlled place to explore, without consequences for the real one.",
    tag: "Planned · Task worlds",
    side: "left",
  },
  {
    lead: "Follow",
    rest: "the",
    accent: "thought.",
    body: "The vision: action traces and snapshots. Turn an opaque outcome into a sequence worth understanding.",
    tag: "Planned · Traces and snapshots",
    side: "left",
  },
  {
    lead: "Return",
    rest: "to the",
    accent: "why.",
    body: "The vision: deterministic grading and replay. Revisit the turning point, not just the final answer.",
    tag: "Planned · Grading and replay",
    side: "right",
  },
] as const;

const STATEMENT =
  "When an agent takes the *unexpected* path, the interesting question isn't only what happened. It's whether you can go back, watch it happen *again,* and understand *why.*".split(
    " ",
  );

const BUILT = [
  "React and TypeScript interface",
  "Java 21 and Spring Boot 3 API",
  "PostgreSQL with Flyway migrations",
  "Strict validation and live health checks",
  "A real write, readback and comparison",
];

const HORIZON = [
  "Disposable task worlds",
  "Action traces and snapshots",
  "Deterministic grading",
  "Replay and first divergence",
  "Reproducible benchmarks",
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error prevented the check. Inspect local API logs.";
}

function stepState(check: Check, stage: RoundTripStage): StepState {
  if (check.status === "idle") return "idle";
  if (check.status === "passed") return "done";
  const position = STEPS.findIndex((step) => step.stage === stage);
  const reached = STEPS.findIndex((step) => step.stage === check.stage);
  if (position < reached) return "done";
  if (position > reached) return "idle";
  return check.status === "failed" ? "failed" : "active";
}

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="arrow-icon">
      <path
        d={diagonal ? "M6 18 18 6M8 6h10v10" : "M4 12h16m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Spark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="spark">
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19" stroke="currentColor" />
    </svg>
  );
}

/** A masked line of display type that slides into place. */
function Line({ index = 0, children }: { index?: number; children: ReactNode }) {
  return (
    <span className="line">
      <span className="line-inner" style={{ "--i": index } as CSSProperties}>
        {children}
      </span>
    </span>
  );
}

function Marquee({
  words,
  direction,
  outline = false,
}: {
  words: readonly string[];
  direction: 1 | -1;
  outline?: boolean;
}) {
  return (
    <div
      className={outline ? "marquee-row marquee-outline" : "marquee-row"}
      data-marquee={direction}
    >
      <div className="marquee-track">
        {[0, 1, 2].map((copy) => (
          <span className="marquee-group" key={copy}>
            {words.map((word) => (
              <span key={word}>
                {word}
                <Spark />
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
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
    let stage: RoundTripStage = "write";
    setCheck({ status: "running", stage });
    try {
      const probe = await checkPersistence((next) => {
        stage = next;
        setCheck({ status: "running", stage: next });
      });
      setCheck({ status: "passed", probe });
      announceVerified();
    } catch (error: unknown) {
      setCheck({ status: "failed", stage, message: errorMessage(error) });
    }
    await refreshHealth();
  }

  const running = check.status === "running";

  return (
    <div className="site-shell" id="top">
      <a className="skip-link" href="#workspace">
        Skip to live sandbox
      </a>
      <Experience />

      <header className="site-header">
        <a
          className="brand"
          href="#top"
          aria-label="Halluminate home"
          data-cursor="Home"
        >
          <svg
            className="brand-symbol"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
          >
            <path d="M8 3v30M28 3v30M8 18h20M13 8l10 20M23 8 13 28" />
          </svg>
          <span>halluminate.</span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#concept" data-cursor="Read">
            The idea
          </a>
          <a href="#workspace" data-cursor="Open">
            Live sandbox
          </a>
        </nav>
        <p className={`header-status health-${health}`}>
          <span className="status-dot" aria-hidden="true" />
          {health === "ready" && "Local stack ready"}
          {health === "checking" && "Checking local stack"}
          {health === "unavailable" && "Local stack unavailable"}
        </p>
      </header>

      <main>
        <section className="hero" data-hero aria-labelledby="page-title">
          <div className="hero-inner">
            <div className="hero-heading">
              <p className="eyebrow">
                <Spark />
                Intelligence deserves understanding
              </p>
              <h1 id="page-title" className="hero-title">
                <Line index={0}>Make the</Line>{" "}
                <Line index={1}>
                  <em>unknown</em>
                </Line>{" "}
                <Line index={2}>
                  repeatable<span className="accent-dot">.</span>
                </Line>
              </h1>
            </div>
            <div className="hero-aside">
              <p className="hero-description">
                A new perspective on agent evaluation: an independent experiment in
                making complex behavior something you can watch, question and repeat.
              </p>
              <div className="hero-actions">
                <a
                  className="button"
                  href="#workspace"
                  data-magnetic
                  data-cursor="Open"
                >
                  <span>Open live sandbox</span>
                  <span className="button-icon">
                    <Arrow diagonal />
                  </span>
                </a>
                <a className="text-link" href="#concept" data-cursor="Read">
                  Meet the idea
                </a>
              </div>
            </div>
          </div>
          <div className="hero-foot">
            <a className="scroll-cue" href="#concept">
              <span className="scroll-line" aria-hidden="true" />
              Scroll to explore
            </a>
            <span className="field-note field-note-live">
              Generative artwork. Not evaluation data.
            </span>
            <span className="field-note field-note-static">
              Static backdrop. The live field could not start in this browser.
            </span>
            <span className="hero-foot-end">Independent prototype / Phase 01</span>
          </div>
        </section>

        <section
          className="story"
          id="concept"
          data-story
          aria-labelledby="story-heading"
        >
          <div className="story-pin">
            <div className="story-head">
              <h2 id="story-heading">The idea</h2>
              <span>A north star, not a feature claim</span>
              <span className="story-count" aria-hidden="true">
                <span data-story-index>01</span> / 03
              </span>
            </div>
            <div className="story-rail" data-story-rail aria-hidden="true">
              <span />
            </div>
            <ol className="chapters">
              {CHAPTERS.map((chapter, index) => (
                <li
                  className="chapter"
                  key={chapter.lead}
                  data-chapter
                  data-side={chapter.side}
                  data-state={index === 0 ? "active" : "after"}
                >
                  <span className="chapter-number" aria-hidden="true">
                    Chapter 0{index + 1}
                  </span>
                  <h3>
                    <Line index={0}>{chapter.lead}</Line>{" "}
                    <Line index={1}>
                      {chapter.rest} <em>{chapter.accent}</em>
                    </Line>
                  </h3>
                  <p>{chapter.body}</p>
                  <span className="tag">{chapter.tag}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="cover" data-cover>
          <section className="premise" aria-labelledby="premise-heading">
            <div className="section-label">
              <span>01</span>
              <h2 id="premise-heading">The premise</h2>
              <span>Why replay matters</span>
            </div>
            <p className="statement" data-words>
              {STATEMENT.map((token, index) => {
                const marked = token.startsWith("*");
                return (
                  <span key={index} data-word>
                    {marked ? <em>{token.slice(1, -1)}</em> : token}{" "}
                  </span>
                );
              })}
            </p>
            <div className="ledger">
              <div className="ledger-column" data-reveal="rise">
                <h3>
                  <span className="ledger-dot ledger-real" aria-hidden="true" />
                  Built and locally verified
                </h3>
                <ol>
                  {BUILT.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
              <div className="ledger-column" data-reveal="rise">
                <h3>
                  <span className="ledger-dot" aria-hidden="true" />
                  On the horizon, not implemented
                </h3>
                <ol>
                  {HORIZON.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
          <div className="marquees" data-marquees aria-hidden="true">
            <Marquee words={["Write", "Read", "Compare", "Repeat"]} direction={1} />
            <Marquee
              words={[
                "No fabricated results",
                "Fictional data only",
                "Local by design",
              ]}
              direction={-1}
              outline
            />
          </div>
        </div>

        <section
          className="sandbox"
          id="workspace"
          data-sandbox
          aria-labelledby="workspace-heading"
          tabIndex={-1}
        >
          <div className="section-label">
            <span>02</span>
            <span>The live sandbox</span>
            <span>Phase 01 / Working skeleton</span>
          </div>
          <div className="sandbox-grid">
            <div className="sandbox-intro">
              <h2 id="workspace-heading" data-reveal="lines">
                <Line index={0}>Small test.</Line>{" "}
                <Line index={1}>
                  <em>Real</em> proof.
                </Line>
              </h2>
              <p className="sandbox-lede" data-reveal="rise">
                No simulated success. Send one fixed fictional fixture through the
                running stack. Write it. Read it back. Compare.
              </p>
              <div className="system" data-reveal="rise">
                <div className={`health health-${health}`} role="status">
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
                <ol className="layers">
                  <li>
                    <span>01</span>
                    <strong>Interface</strong>
                    <span>React + TypeScript</span>
                  </li>
                  <li>
                    <span>02</span>
                    <strong>Orchestration</strong>
                    <span>Java 21 / Spring Boot 3</span>
                  </li>
                  <li>
                    <span>03</span>
                    <strong>Persistence</strong>
                    <span>PostgreSQL / Flyway</span>
                  </li>
                </ol>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void refreshHealth()}
                  disabled={health === "checking" || running}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M16 9a6 6 0 1 0-1 4M16 3v6h-6" />
                  </svg>
                  Refresh readiness
                </button>
              </div>
            </div>

            <section
              className="console"
              aria-labelledby="probe-heading"
              aria-busy={running}
              data-check={check.status}
              data-reveal="rise"
            >
              <div className="console-bar">
                <span className="console-lights" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>halluminate / bootstrap</span>
                <span>Local only</span>
              </div>
              <div className="console-body">
                <p className="eyebrow">Persistence probe</p>
                <h3 id="probe-heading">A little evidence goes a long way.</h3>
                <div className="request">
                  <div className="request-line">
                    <span>POST</span>
                    <code>/api/bootstrap/probes</code>
                  </div>
                  <pre>
                    <code>
                      {"{ "}
                      <span className="code-key">"fixture"</span>
                      {": "}
                      <span className="code-value">"phase-1-synthetic"</span>
                      {" }"}
                    </code>
                  </pre>
                </div>
                <ol className="roundtrip" aria-label="Round trip">
                  {STEPS.map((step, index) => {
                    const state = stepState(check, step.stage);
                    return (
                      <li key={step.stage} data-state={state}>
                        <span className="roundtrip-index" aria-hidden="true">
                          0{index + 1}
                        </span>
                        <span className="roundtrip-verb">{step.verb}</span>
                        <code>{step.detail}</code>
                        <span className="roundtrip-status">{STEP_LABEL[state]}</span>
                      </li>
                    );
                  })}
                </ol>
                <button
                  type="button"
                  className="run-button"
                  data-cursor="Run"
                  onClick={() => void runCheck()}
                  disabled={running}
                >
                  <span>{running ? "Verifying..." : "Run synthetic check"}</span>
                  {running ? (
                    <span className="working-indicator" aria-hidden="true" />
                  ) : (
                    <Arrow />
                  )}
                </button>
                <div className="check-output" aria-live="polite" aria-atomic="true">
                  {check.status === "idle" && (
                    <p className="idle-output">
                      Ready when you are. No check has run in this browser session.
                    </p>
                  )}
                  {running && (
                    <p className="running-output">Writing and reading the fixture...</p>
                  )}
                  {check.status === "failed" && (
                    <div role="alert" className="error-output">
                      <span className="result-label">Request unsuccessful</span>
                      <strong>Check failed</strong>
                      <p>{check.message}</p>
                      <span>No success recorded. You can try again.</span>
                    </div>
                  )}
                  {check.status === "passed" && (
                    <div className="success-output">
                      <span className="result-label">
                        <span className="status-dot" aria-hidden="true" />
                        Write and readback matched
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
            </section>
          </div>
          <p className="scope-note" data-reveal="rise">
            <span>A note on scope</span>A foundation, not a finished engine. Task
            worlds, runs, traces, snapshots, grading, replay and benchmarks are not
            implemented here.
          </p>
        </section>
      </main>

      <footer className="site-footer" data-footer>
        <div className="footer-top" data-reveal="rise">
          <p>
            The future is worth <em>understanding.</em>
          </p>
          <a className="round-link" href="#top" data-magnetic data-cursor="Top">
            <span>Back to the beginning</span>
            <Arrow diagonal />
          </a>
        </div>
        <div className="footer-wordmark" aria-hidden="true" data-reveal="letters">
          {"halluminate.".split("").map((letter, index) => (
            <span key={index} style={{ "--i": index } as CSSProperties}>
              {letter}
            </span>
          ))}
        </div>
        <div className="footer-meta">
          <span>Independent prototype. Not affiliated with Halluminate.</span>
          <span>Local only / Fictional data / Phase 01</span>
        </div>
      </footer>
    </div>
  );
}
