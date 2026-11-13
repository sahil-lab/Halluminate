import { type FieldQuality, type FieldScene, ParticleField } from "./field";
import { FramePacer } from "./pacing";

export interface DirectorOptions {
  canvas: HTMLCanvasElement;
  cursor: HTMLElement | null;
  motion: boolean;
}

interface Pose {
  x: number;
  y: number;
  scale: number;
  yaw: number;
  pitch: number;
  roll: number;
  energy: number;
}

interface MarqueeRow {
  track: HTMLElement;
  direction: number;
  width: number;
  offset: number;
}

// Hero orb, contained world, trace, loop, sandbox ambience, footer horizon.
const LANDSCAPE: readonly Pose[] = [
  { x: 0.5, y: 0.1, scale: 1.04, yaw: 0, pitch: 0.18, roll: -0.12, energy: 1 },
  { x: 0.46, y: 0.02, scale: 0.86, yaw: 0.62, pitch: 0.42, roll: 0, energy: 1 },
  { x: 0.1, y: 0.13, scale: 0.94, yaw: -0.1, pitch: 0.14, roll: -0.1, energy: 1 },
  { x: -0.45, y: -0.05, scale: 0.75, yaw: 0.3, pitch: 0.25, roll: 0.1, energy: 1 },
  { x: 0.5, y: 0, scale: 2.1, yaw: 0.4, pitch: 0.5, roll: 0.3, energy: 0.26 },
  { x: 0, y: -0.04, scale: 1, yaw: 0, pitch: 0.1, roll: 0, energy: 0.8 },
];
const PORTRAIT: readonly Pose[] = [
  { x: 0, y: 0.54, scale: 0.46, yaw: 0, pitch: 0.18, roll: -0.12, energy: 1 },
  { x: 0, y: 0.36, scale: 0.48, yaw: 0.62, pitch: 0.42, roll: 0, energy: 1 },
  { x: 0, y: 0.31, scale: 0.42, yaw: -0.1, pitch: 0.14, roll: -0.5, energy: 1 },
  { x: 0, y: 0.32, scale: 0.43, yaw: 0.3, pitch: 0.25, roll: 0.1, energy: 1 },
  { x: 0.2, y: 0.1, scale: 1.3, yaw: 0.4, pitch: 0.5, roll: 0.3, energy: 0.2 },
  { x: 0, y: -0.1, scale: 0.8, yaw: 0, pitch: 0.1, roll: 0, energy: 0.8 },
];

const QUALITIES: readonly FieldQuality[] = ["high", "medium", "low", "minimal"];
// The slowest sustained average frame, in milliseconds, each level may run at before
// giving way. Full quality at around forty frames a second is kept over a sparser field.
const FRAME_BUDGET: Record<FieldQuality, number> = {
  high: 30,
  medium: 30,
  low: 40,
  minimal: 50,
};
// Loading, the opening sequence and the first reveals are not representative.
const PACING_GRACE_MS = 6000;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const ease = (t: number): number => t * t * (3 - 2 * t);
const mix = (from: number, to: number, t: number): number => from + (to - from) * t;
const wrap = (angle: number): number =>
  angle - Math.round(angle / (Math.PI * 2)) * Math.PI * 2;

function blend(from: Pose, to: Pose, t: number): Pose {
  return {
    x: mix(from.x, to.x, t),
    y: mix(from.y, to.y, t),
    scale: mix(from.scale, to.scale, t),
    yaw: mix(from.yaw, to.yaw, t),
    pitch: mix(from.pitch, to.pitch, t),
    roll: mix(from.roll, to.roll, t),
    energy: mix(from.energy, to.energy, t),
  };
}

/**
 * One animation loop for the whole page: scroll progress drives the particle
 * formation, the pinned story, the word highlight, the marquee and the cursor.
 * With motion off nothing moves on its own and formations switch without travel.
 * A renderer that cannot keep up is stepped down and, at the bottom, held still the
 * same way, so the page stays responsive.
 */
export class Director {
  readonly ready: Promise<void>;

  private readonly canvas: HTMLCanvasElement;
  private readonly cursor: HTMLElement | null;
  private readonly cursorText: HTMLElement | null;
  private readonly root = document.documentElement;
  private readonly finePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  );
  private readonly progress: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  private readonly pointer = { x: 0, y: 0, targetX: 0, targetY: 0, force: 0, moved: 0 };
  private readonly follower = { x: 0, y: 0, targetX: 0, targetY: 0, shown: false };
  private readonly magnets = new Map<HTMLElement, { x: number; y: number }>();
  private readonly pacer = new FramePacer();

  private resolveReady: () => void = () => {};
  private field: ParticleField | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private revealObserver: IntersectionObserver | null = null;
  private motion: boolean;
  private adaptive = true;
  private still = false;
  private raf = 0;
  private last = 0;
  private started = 0;
  private stale = true;
  private primed = false;
  private drawn = false;

  private hero: HTMLElement | null = null;
  private story: HTMLElement | null = null;
  private chapters: HTMLElement[] = [];
  private rail: HTMLElement | null = null;
  private storyIndex: HTMLElement | null = null;
  private cover: HTMLElement | null = null;
  private wordsHost: HTMLElement | null = null;
  private words: HTMLElement[] = [];
  private wordOpacity: number[] = [];
  private marqueeHost: HTMLElement | null = null;
  private marquees: MarqueeRow[] = [];
  private sandbox: HTMLElement | null = null;
  private footer: HTMLElement | null = null;

  private vw = 1;
  private vh = 1;
  private storyTop = 1;
  private storyHeight = 1;
  private coverTop = Infinity;
  private coverBottom = -Infinity;
  private sandboxTop = Infinity;
  private footerTop = Infinity;
  private wordsTop = 0;
  private wordsHeight = 1;
  private marqueeTop = 0;
  private marqueeBottom = 0;

  private activeChapter = -1;
  private headerMark = 0;
  private headerHidden = false;
  private headerLight = false;
  private headerBacked = false;
  private railProgress = -1;
  private heroExit = -1;
  private wordsProgress = -1;
  private velocity = 0;
  private lastScroll = 0;
  private time = 0;
  private turn = 0;
  private spin = 0;
  private pulseStart = 0;
  private sceneKey = "";
  private cursorLabel = "";

  constructor(options: DirectorOptions) {
    this.canvas = options.canvas;
    this.cursor = options.cursor;
    this.cursorText =
      options.cursor?.querySelector<HTMLElement>(".cursor-label") ?? null;
    this.motion = options.motion;
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  start(): void {
    this.collect();
    this.createField();
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    document.addEventListener("pointerover", this.handlePointerOver, { passive: true });
    document.addEventListener("visibilitychange", this.handleResize);
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(document.body);
    this.revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-inview");
          this.revealObserver?.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    for (const element of document.querySelectorAll("[data-reveal]")) {
      this.revealObserver.observe(element);
    }
    // Content is only held back for a reveal once something is watching for it.
    this.root.dataset["observe"] = "on";
    for (const element of document.querySelectorAll<HTMLElement>("[data-magnetic]")) {
      element.addEventListener("pointermove", this.handleMagnet, { passive: true });
      element.addEventListener("pointerleave", this.handleMagnetLeave, {
        passive: true,
      });
    }
    this.started = performance.now();
    this.invalidate();
  }

  setMotion(motion: boolean): void {
    if (motion === this.motion) return;
    this.motion = motion;
    this.last = 0;
    this.sceneKey = "";
    this.pacer.reset();
    if (!motion) this.neutralize();
    this.invalidate();
  }

  /** A shockwave through the formation, used when a real round trip is verified. */
  pulse(): void {
    if (this.motion && !this.still) this.pulseStart = performance.now();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("pointermove", this.handlePointerMove);
    document.removeEventListener("pointerover", this.handlePointerOver);
    document.removeEventListener("visibilitychange", this.handleResize);
    this.resizeObserver?.disconnect();
    this.revealObserver?.disconnect();
    delete this.root.dataset["observe"];
    delete this.root.dataset["header"];
    delete this.root.dataset["headerTone"];
    delete this.root.dataset["headerBar"];
    delete this.root.dataset["fieldQuality"];
    for (const element of document.querySelectorAll<HTMLElement>("[data-magnetic]")) {
      element.removeEventListener("pointermove", this.handleMagnet);
      element.removeEventListener("pointerleave", this.handleMagnetLeave);
    }
    this.neutralize();
    this.field?.dispose();
    this.field = null;
    this.resolveReady();
  }

  private collect(): void {
    const one = (selector: string) => document.querySelector<HTMLElement>(selector);
    const all = (selector: string) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector));
    this.hero = one("[data-hero]");
    this.story = one("[data-story]");
    this.chapters = all("[data-chapter]");
    this.rail = one("[data-story-rail]");
    this.storyIndex = one("[data-story-index]");
    this.cover = one("[data-cover]");
    this.wordsHost = one("[data-words]");
    this.words = all("[data-word]");
    this.wordOpacity = this.words.map(() => -1);
    this.marqueeHost = one("[data-marquees]");
    this.marquees = all("[data-marquee]").flatMap((row) => {
      const track = row.querySelector<HTMLElement>(".marquee-track");
      const direction = Number(row.dataset["marquee"]) < 0 ? -1 : 1;
      return track ? [{ track, direction, width: 1, offset: 0 }] : [];
    });
    this.sandbox = one("[data-sandbox]");
    this.footer = one("[data-footer]");
  }

  private createField(): void {
    // ?quality=<level> pins a level and turns the automatic adjustment off.
    const requested = new URLSearchParams(window.location.search).get("quality");
    const forced = QUALITIES.find((quality) => quality === requested) ?? null;
    const compact =
      window.matchMedia("(pointer: coarse)").matches ||
      Math.min(window.innerWidth, window.innerHeight) < 700;
    const preferred: FieldQuality = forced ?? (compact ? "medium" : "high");
    this.adaptive = forced === null;
    try {
      this.field = ParticleField.create(this.canvas, preferred, forced !== null);
      if (!this.field) {
        console.warn("WebGL2 is unavailable. Showing the static backdrop instead.");
      }
    } catch (error: unknown) {
      console.error(
        "The particle field could not start. Showing the static backdrop instead.",
        error,
      );
    }
    const status = this.field ? "webgl2" : "none";
    this.root.dataset["renderer"] = status;
    this.canvas.dataset["renderer"] = status;
    // An emulated renderer shows each formation as a still picture from the start:
    // animating it would cost the rest of the page its responsiveness.
    if (this.adaptive && this.field?.software) this.still = true;
    this.describeField();
    if (!this.field) this.resolveReady();
  }

  private describeField(): void {
    if (!this.field) return;
    this.canvas.dataset["quality"] = this.field.quality;
    this.canvas.dataset["particles"] = String(this.field.particles);
    this.canvas.dataset["pipeline"] = this.field.pipeline;
    this.canvas.dataset["mode"] = this.still ? "still" : "live";
    this.root.dataset["fieldQuality"] = this.field.quality;
  }

  private measure(): void {
    this.stale = false;
    const scrollY = window.scrollY;
    const top = (element: HTMLElement | null, missing: number): number =>
      element ? element.getBoundingClientRect().top + scrollY : missing;
    this.vw = this.root.clientWidth || 1;
    this.vh = window.innerHeight || 1;
    this.storyTop = top(this.story, this.vh);
    this.storyHeight = this.story?.offsetHeight ?? this.vh;
    this.coverTop = top(this.cover, Infinity);
    this.coverBottom = this.coverTop + (this.cover?.offsetHeight ?? 0);
    this.sandboxTop = top(this.sandbox, Infinity);
    this.footerTop = top(this.footer, Infinity);
    this.wordsTop = top(this.wordsHost, 0);
    this.wordsHeight = this.wordsHost?.offsetHeight ?? 1;
    this.marqueeTop = top(this.marqueeHost, 0);
    this.marqueeBottom = this.marqueeTop + (this.marqueeHost?.offsetHeight ?? 0);
    for (const row of this.marquees) {
      const group = row.track.firstElementChild;
      row.width = group instanceof HTMLElement ? Math.max(group.offsetWidth, 1) : 1;
    }
    if (this.field?.resize()) {
      this.sceneKey = "";
      this.describeField();
    }
  }

  private invalidate(): void {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.raf = 0;
    const interval = this.last ? now - this.last : 16;
    const dt = Math.min(Math.max(interval / 1000, 0.001), 0.05);
    this.last = now;
    if (this.stale) this.measure();
    this.update(now, dt, interval);
    if (this.motion) this.raf = requestAnimationFrame(this.frame);
    else this.last = 0;
  };

  private update(now: number, dt: number, interval: number): void {
    const scrollY = window.scrollY;
    const heroT = clamp01(scrollY / Math.max(this.storyTop, 1));
    const storyT = clamp01(
      (scrollY - this.storyTop) / Math.max(this.storyHeight - this.vh, 1),
    );
    const targets = [
      clamp01((heroT - 0.3) / 0.7),
      clamp01((storyT - 0.27) / 0.15),
      clamp01((storyT - 0.62) / 0.15),
      clamp01((scrollY + this.vh - this.sandboxTop) / this.vh),
      clamp01((scrollY + this.vh - this.footerTop) / (this.vh * 0.9)),
    ];
    const travelling = this.motion && !this.still;
    const settle = travelling && this.primed ? 1 - Math.exp(-dt * 6) : 1;
    for (let i = 0; i < this.progress.length; i++) {
      const raw = targets[i] as number;
      const target = travelling ? raw : raw >= 0.5 ? 1 : 0;
      const current = this.progress[i] as number;
      this.progress[i] =
        Math.abs(target - current) < 0.0005
          ? target
          : current + (target - current) * settle;
    }
    this.primed = true;

    const speed = (scrollY - this.lastScroll) / dt;
    this.velocity += (speed - this.velocity) * (1 - Math.exp(-dt * 8));
    this.lastScroll = scrollY;

    this.updateHeader(scrollY);
    this.updateStory(storyT);
    if (this.motion) {
      this.updateHero(heroT);
      this.updateWords(scrollY);
      this.updateMarquees(scrollY, dt);
      this.updateFollower(dt);
    }
    this.render(now, dt, interval, scrollY);
  }

  /**
   * The header steps aside while reading down the page and returns on the way up,
   * with a backing bar once it is over content and ink text over the light section.
   */
  private updateHeader(scrollY: number): void {
    const line = scrollY + 44;
    const light = line >= this.coverTop && line <= this.coverBottom;
    if (light !== this.headerLight) {
      this.headerLight = light;
      if (light) this.root.dataset["headerTone"] = "light";
      else delete this.root.dataset["headerTone"];
    }
    const backed = scrollY > this.vh * 0.5;
    if (backed !== this.headerBacked) {
      this.headerBacked = backed;
      if (backed) this.root.dataset["headerBar"] = "on";
      else delete this.root.dataset["headerBar"];
    }

    const nearTop = scrollY <= this.vh * 0.4;
    const moved = scrollY - this.headerMark;
    if (!nearTop && Math.abs(moved) < 8) return;
    this.headerMark = scrollY;
    const hidden = !nearTop && moved > 0;
    if (hidden === this.headerHidden) return;
    this.headerHidden = hidden;
    if (hidden) this.root.dataset["header"] = "hidden";
    else delete this.root.dataset["header"];
  }

  private updateStory(storyT: number): void {
    const active = storyT < 0.345 ? 0 : storyT < 0.695 ? 1 : 2;
    if (active !== this.activeChapter) {
      this.activeChapter = active;
      this.chapters.forEach((chapter, index) => {
        chapter.dataset["state"] =
          index === active ? "active" : index < active ? "before" : "after";
      });
      if (this.storyIndex) this.storyIndex.textContent = `0${active + 1}`;
    }
    const progress = Math.round(storyT * 1000) / 1000;
    if (progress !== this.railProgress) {
      this.railProgress = progress;
      this.rail?.style.setProperty("--progress", String(progress));
    }
  }

  private updateHero(heroT: number): void {
    const exit = Math.round(heroT * 200) / 200;
    if (exit === this.heroExit) return;
    this.heroExit = exit;
    this.hero?.style.setProperty("--exit", String(exit));
  }

  private updateWords(scrollY: number): void {
    const start = this.wordsTop - this.vh * 0.82;
    const end = this.wordsTop + this.wordsHeight - this.vh * 0.42;
    const progress =
      Math.round(clamp01((scrollY - start) / Math.max(end - start, 1)) * 500) / 500;
    if (progress === this.wordsProgress) return;
    this.wordsProgress = progress;
    const lit = progress * (this.words.length + 5);
    this.words.forEach((word, index) => {
      const opacity = Math.round((0.16 + 0.84 * clamp01(lit - index)) * 100) / 100;
      if (opacity === this.wordOpacity[index]) return;
      this.wordOpacity[index] = opacity;
      word.style.opacity = String(opacity);
    });
  }

  private updateMarquees(scrollY: number, dt: number): void {
    if (scrollY + this.vh < this.marqueeTop || scrollY > this.marqueeBottom) return;
    const pace = 70 + Math.min(520, Math.max(-520, this.velocity * 0.22));
    for (const row of this.marquees) {
      const next = row.offset + row.direction * pace * dt;
      row.offset = ((next % row.width) + row.width) % row.width;
      row.track.style.transform = `translate3d(${(-row.offset).toFixed(2)}px, 0, 0)`;
    }
  }

  private updateFollower(dt: number): void {
    const follower = this.follower;
    if (!this.cursor || !follower.shown) return;
    const follow = 1 - Math.exp(-dt * 16);
    const x = follower.x + (follower.targetX - follower.x) * follow;
    const y = follower.y + (follower.targetY - follower.y) * follow;
    if (Math.abs(x - follower.x) + Math.abs(y - follower.y) < 0.01) return;
    follower.x = x;
    follower.y = y;
    this.cursor.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
  }

  private render(now: number, dt: number, interval: number, scrollY: number): void {
    const field = this.field;
    if (!field) return;
    // Nothing to draw while the opaque premise section fills the viewport. The margin
    // keeps its rounded corners, which reveal the field, out of the skipped range.
    if (scrollY >= this.coverTop + 64 && scrollY + this.vh <= this.coverBottom - 64) {
      return;
    }

    const [toWorld, toTrace, toLoop, toSandbox, toHorizon] = this.progress;
    const wide = clamp01((this.vw / this.vh - 0.8) / 0.5);
    const pose = (index: number): Pose =>
      blend(PORTRAIT[index] as Pose, LANDSCAPE[index] as Pose, wide);
    let current = blend(pose(0), pose(1), ease(toWorld));
    current = blend(current, pose(2), ease(toTrace));
    current = blend(current, pose(3), ease(toLoop));
    current = blend(current, pose(4), ease(toSandbox));
    current = blend(current, pose(5), ease(toHorizon));

    const live = this.motion && !this.still;
    const pointer = this.pointer;
    if (live) {
      this.time += dt;
      // The two free rotations only advance while they carry full weight, so the
      // angle can wrap without a visible jump.
      if (toTrace < 0.001) this.turn += dt * 0.16;
      if (toLoop > 0.999 && toHorizon < 0.001) this.spin += dt * 0.2;
      const follow = 1 - Math.exp(-dt * 4);
      pointer.x += (pointer.targetX - pointer.x) * follow;
      pointer.y += (pointer.targetY - pointer.y) * follow;
      const wanted = now - pointer.moved < 1600 ? 1 : 0;
      pointer.force += (wanted - pointer.force) * (1 - Math.exp(-dt * 3));
    }

    let pulse = 0;
    if (this.pulseStart) {
      pulse = Math.max((now - this.pulseStart) / 1800, 0.001);
      if (pulse >= 1) {
        pulse = 0;
        this.pulseStart = 0;
      }
    }

    const facing = ease(toTrace);
    // The knot turns in its own plane, so it always faces the viewer as a loop.
    const turning = wrap(this.spin) * ease(toLoop) * (1 - ease(toHorizon));
    // A formation drawn smaller packs the same light into fewer pixels.
    const packed = Math.min(1, (current.scale / 0.8) ** 2);
    const scene: FieldScene = {
      morph: toWorld + toTrace + toLoop + toHorizon,
      x: current.x,
      y: current.y,
      scale: current.scale,
      yaw:
        current.yaw +
        wrap(this.turn) * (1 - facing) +
        Math.sin(this.time * 0.21) * 0.14 * facing +
        pointer.x * 0.16,
      pitch: current.pitch - pointer.y * 0.1,
      roll: current.roll + turning,
      energy:
        current.energy * packed + (pulse > 0 ? Math.sin(Math.PI * pulse) * 0.6 : 0),
      time: this.time,
      pointerX: pointer.x,
      pointerY: pointer.y,
      pointerForce: pointer.force,
      pulse,
    };

    // A field that is not animating is only redrawn when the page moves it.
    if (!live) {
      const key = [
        scene.morph,
        scene.x,
        scene.y,
        scene.scale,
        this.canvas.width,
        this.canvas.height,
      ].join("|");
      if (key === this.sceneKey) return;
      this.sceneKey = key;
    }

    field.draw(scene);
    if (!this.drawn) {
      this.drawn = true;
      this.canvas.dataset["lit"] = String(field.inspect());
      this.resolveReady();
    }

    if (
      live &&
      this.adaptive &&
      now - this.started > PACING_GRACE_MS &&
      this.pacer.exceeds(interval, FRAME_BUDGET[field.quality])
    ) {
      if (field.lower()) this.describeField();
      else this.holdStill();
    }
  }

  /**
   * Stops the field animating on its own once even the lightest level is too slow. It
   * still follows the page from one formation to the next.
   */
  private holdStill(): void {
    this.still = true;
    this.pointer.x = 0;
    this.pointer.y = 0;
    this.pointer.force = 0;
    this.pulseStart = 0;
    this.sceneKey = "";
    this.describeField();
  }

  /** Clears everything the loop wrote so the static layout takes over. */
  private neutralize(): void {
    this.hero?.style.removeProperty("--exit");
    this.heroExit = -1;
    for (const word of this.words) word.style.removeProperty("opacity");
    this.wordOpacity = this.words.map(() => -1);
    this.wordsProgress = -1;
    for (const row of this.marquees) {
      row.offset = 0;
      row.track.style.removeProperty("transform");
    }
    for (const element of this.magnets.keys()) {
      element.style.removeProperty("--mx");
      element.style.removeProperty("--my");
    }
    this.magnets.clear();
    this.pointer.x = 0;
    this.pointer.y = 0;
    this.pointer.force = 0;
    this.pulseStart = 0;
    this.follower.shown = false;
    delete this.root.dataset["follower"];
  }

  private readonly handleScroll = (): void => {
    this.invalidate();
  };

  private readonly handleResize = (): void => {
    this.stale = true;
    this.invalidate();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.motion || event.pointerType === "touch") return;
    const pointer = this.pointer;
    pointer.targetX = (event.clientX / this.vw) * 2 - 1;
    pointer.targetY = 1 - (event.clientY / this.vh) * 2;
    pointer.moved = performance.now();
    const follower = this.follower;
    follower.targetX = event.clientX;
    follower.targetY = event.clientY;
    if (!follower.shown && this.cursor && this.finePointer.matches) {
      follower.shown = true;
      follower.x = event.clientX;
      follower.y = event.clientY;
      this.cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      // Not "cursor": that key holds the per-element labels looked up on hover.
      this.root.dataset["follower"] = "on";
    }
  };

  private readonly handlePointerOver = (event: PointerEvent): void => {
    if (!this.cursor) return;
    const host =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-cursor]")
        : null;
    const label = host?.dataset["cursor"] ?? "";
    if (label === this.cursorLabel) return;
    this.cursorLabel = label;
    this.cursor.dataset["state"] = label ? "active" : "idle";
    if (label && this.cursorText) this.cursorText.textContent = label;
  };

  private readonly handleMagnet = (event: PointerEvent): void => {
    const element = event.currentTarget;
    if (!this.motion || event.pointerType === "touch") return;
    if (!(element instanceof HTMLElement)) return;
    const held = this.magnets.get(element) ?? { x: 0, y: 0 };
    const bounds = element.getBoundingClientRect();
    const pull = {
      x: (event.clientX - (bounds.left - held.x + bounds.width / 2)) * 0.24,
      y: (event.clientY - (bounds.top - held.y + bounds.height / 2)) * 0.34,
    };
    this.magnets.set(element, pull);
    element.style.setProperty("--mx", `${pull.x.toFixed(1)}px`);
    element.style.setProperty("--my", `${pull.y.toFixed(1)}px`);
  };

  private readonly handleMagnetLeave = (event: PointerEvent): void => {
    const element = event.currentTarget;
    if (!(element instanceof HTMLElement)) return;
    this.magnets.delete(element);
    element.style.removeProperty("--mx");
    element.style.removeProperty("--my");
  };
}
