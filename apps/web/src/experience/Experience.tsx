import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Director } from "./director";
import { onVerified } from "./signals";

type Intro = "playing" | "leaving" | "done";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Everything decorative: the particle backdrop, film grain, cursor follower, the
 * short opening sequence and the control that stops all of it.
 */
export function Experience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const directorRef = useRef<Director | null>(null);
  const [motion, setMotion] = useState(
    () => !window.matchMedia(REDUCED_MOTION).matches,
  );
  const motionRef = useRef(motion);
  const [intro, setIntro] = useState<Intro>(() =>
    window.matchMedia(REDUCED_MOTION).matches ? "done" : "playing",
  );

  useLayoutEffect(() => {
    motionRef.current = motion;
    document.documentElement.dataset["motion"] = motion ? "on" : "off";
    directorRef.current?.setMotion(motion);
    if (!motion) setIntro("done");
  }, [motion]);

  useLayoutEffect(() => {
    document.documentElement.dataset["intro"] = intro;
  }, [intro]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const director = new Director({
      canvas,
      cursor: cursorRef.current,
      motion: motionRef.current,
    });
    directorRef.current = director;
    try {
      director.start();
    } catch (error: unknown) {
      // The backdrop is decorative: report the failure and keep the page usable.
      console.error("The interactive backdrop could not start.", error);
      document.documentElement.dataset["renderer"] = "none";
    }
    const stopListening = onVerified(() => director.pulse());
    const preference = window.matchMedia(REDUCED_MOTION);
    const follow = () => setMotion(!preference.matches);
    preference.addEventListener("change", follow);
    return () => {
      preference.removeEventListener("change", follow);
      stopListening();
      director.dispose();
      directorRef.current = null;
    };
  }, []);

  // The counter follows real readiness (typefaces, first rendered frame) and is capped.
  useEffect(() => {
    if (intro !== "playing") return;
    let target = 10;
    let shown = 0;
    let frame = 0;
    let last = 0;
    let active = true;
    const started = performance.now();
    const settle = () => {
      target = Math.min(100, target + 45);
    };
    void document.fonts.ready.then(settle);
    void (directorRef.current?.ready ?? Promise.resolve()).then(settle);
    const tick = (now: number) => {
      if (!active) return;
      const dt = last ? Math.min((now - last) / 1000, 0.5) : 0.016;
      last = now;
      const elapsed = now - started;
      if (elapsed > 2800) target = 100;
      const step = Math.max((target - shown) * (1 - Math.exp(-dt * 5.5)), dt * 18);
      // Slow frames must not hold the page back: the sequence always ends by 4.5s.
      shown = elapsed > 4500 ? 100 : Math.min(target, shown + step);
      if (countRef.current) {
        countRef.current.textContent = String(Math.round(shown)).padStart(3, "0");
      }
      barRef.current?.style.setProperty("--progress", (shown / 100).toFixed(3));
      if (shown >= 99.5) {
        setIntro("leaving");
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [intro]);

  useEffect(() => {
    if (intro !== "leaving") return;
    const timer = window.setTimeout(() => setIntro("done"), 1100);
    return () => window.clearTimeout(timer);
  }, [intro]);

  return (
    <>
      <div className="backdrop" aria-hidden="true">
        <canvas ref={canvasRef} className="field" />
        <div className="backdrop-fallback" />
        <div className="backdrop-vignette" />
      </div>
      <div className="grain" aria-hidden="true" />
      <div ref={cursorRef} className="cursor" data-state="idle" aria-hidden="true">
        <span className="cursor-label" />
      </div>
      <button
        type="button"
        className="motion-toggle"
        onClick={() => setMotion((value) => !value)}
        aria-label={motion ? "Pause animation" : "Play animation"}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          {motion ? <path d="M5 3v10M11 3v10" /> : <path d="m5 3 8 5-8 5Z" />}
        </svg>
      </button>
      {intro !== "done" && (
        <div className="intro" data-state={intro} aria-hidden="true">
          <div className="intro-top">
            <span>halluminate.</span>
            <span>Independent prototype</span>
          </div>
          <div className="intro-count">
            <span ref={countRef}>000</span>
          </div>
          <div className="intro-bottom">
            <span>Composing the field</span>
            <span className="intro-bar">
              <span ref={barRef} />
            </span>
            <span>Local · fictional data</span>
          </div>
        </div>
      )}
    </>
  );
}
