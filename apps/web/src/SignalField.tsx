import { useEffect, useRef, useState } from "react";

type Point = readonly [number, number, number];

const strands: Point[][] = Array.from({ length: 72 }, (_, strand) =>
  Array.from({ length: 145 }, (_, step): Point => {
    const u = (step / 144) * Math.PI * 2;
    const v = (strand / 72) * Math.PI * 2 + u * 2;
    const radius = 153 + 58 * Math.cos(v);
    return [radius * Math.cos(u), radius * Math.sin(u), 58 * Math.sin(v)];
  }),
);

export function SignalField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPlaying(!preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      setUnavailable(true);
      console.error("The decorative signal field requires a 2D canvas context.");
      return;
    }

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastFrame = 0;
    let visible = true;
    let pointerX = 0;
    let pointerY = 0;
    let tiltX = 0;
    let tiltY = 0;

    function draw() {
      if (!context || !width || !height) return;
      context.clearRect(0, 0, width, height);
      const scale = Math.min(width, height) / 515;
      const centerX = width * 0.5;
      const centerY = height * 0.49;
      const phase = phaseRef.current;

      const aura = context.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        width * 0.46,
      );
      aura.addColorStop(0, "rgba(232, 89, 32, 0.05)");
      aura.addColorStop(0.52, "rgba(243, 103, 34, 0.09)");
      aura.addColorStop(1, "rgba(243, 103, 34, 0)");
      context.fillStyle = aura;
      context.fillRect(0, 0, width, height);

      const pitch = 0.78 + tiltY * 0.14;
      const yaw = 0.28 + tiltX * 0.18;
      const roll = -0.54 + Math.sin(phase * 0.18) * 0.08;
      const cosPhase = Math.cos(phase);
      const sinPhase = Math.sin(phase);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosRoll = Math.cos(roll);
      const sinRoll = Math.sin(roll);
      const project = ([x, y, z]: Point): Point => {
        const rotatedX = x * cosPhase - y * sinPhase;
        const rotatedY = x * sinPhase + y * cosPhase;
        const y1 = rotatedY * cosPitch - z * sinPitch;
        const z1 = rotatedY * sinPitch + z * cosPitch;
        const x1 = rotatedX * cosYaw + z1 * sinYaw;
        const depth = -rotatedX * sinYaw + z1 * cosYaw;
        const perspective = 780 / (780 - depth);
        return [
          centerX + (x1 * cosRoll - y1 * sinRoll) * scale * perspective,
          centerY + (x1 * sinRoll + y1 * cosRoll) * scale * perspective,
          depth,
        ];
      };

      context.lineWidth = Math.max(0.65, scale * 0.7);
      strands.forEach((points, index) => {
        const light = (Math.sin((index / strands.length) * Math.PI * 2) + 1) / 2;
        context.strokeStyle = `rgba(255, ${Math.round(112 + light * 89)}, ${Math.round(53 + light * 84)}, ${0.25 + light * 0.46})`;
        context.beginPath();
        points.forEach((point, i) => {
          const [x, y] = project(point);
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.stroke();
      });

      context.globalCompositeOperation = "lighter";
      for (let i = 0; i < 190; i++) {
        const u = ((i * 2.39996) % (Math.PI * 2)) + phase * 0.1;
        const v = i * 1.618;
        const radius = 153 + 58 * Math.cos(v);
        const [x, y, z] = project([
          radius * Math.cos(u),
          radius * Math.sin(u),
          58 * Math.sin(v),
        ]);
        const brightness = Math.max(0.12, (z + 220) / 470);
        context.fillStyle = `rgba(255, 219, 177, ${brightness})`;
        context.beginPath();
        context.arc(x, y, (i % 13 === 0 ? 1.8 : 0.8) * scale, 0, Math.PI * 2);
        context.fill();
      }
      context.globalCompositeOperation = "source-over";
    }

    function tick(time: number) {
      if (time - lastFrame >= 1000 / 30) {
        phaseRef.current += Math.min((time - lastFrame) / 1000, 0.05) * 0.095;
        lastFrame = time;
        tiltX += (pointerX - tiltX) * 0.06;
        tiltY += (pointerY - tiltY) * 0.06;
        draw();
      }
      frame = requestAnimationFrame(tick);
    }

    function synchronize() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = performance.now();
      if (playing && visible && !document.hidden) frame = requestAnimationFrame(tick);
      else draw();
    }

    const resize = new ResizeObserver(([entry]) => {
      if (!entry || !context) return;
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      synchronize();
    });
    const move = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };
    const leave = () => {
      pointerX = 0;
      pointerY = 0;
    };

    resize.observe(canvas);
    intersection.observe(canvas);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", synchronize);
    synchronize();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", synchronize);
    };
  }, [playing]);

  return (
    <figure className="signal-field" data-motion={playing ? "playing" : "paused"}>
      <div className="field-heading" aria-hidden="true">
        <span className="crosshair">+</span>
        <span>FIG. 001 &nbsp; / &nbsp; THE POSSIBILITY FIELD</span>
        <span className="crosshair">+</span>
      </div>
      <div className="field-stage">
        <div className="field-orbit" aria-hidden="true" />
        <div className="field-orbit orbit-inner" aria-hidden="true" />
        <canvas ref={canvasRef} aria-hidden="true" />
        <span className="field-coordinate coordinate-top" aria-hidden="true">
          [ UNCERTAINTY ]
        </span>
        <span className="field-coordinate coordinate-bottom" aria-hidden="true">
          [ POSSIBILITY ]
        </span>
        <span className="field-axis axis-left" aria-hidden="true">
          +
        </span>
        <span className="field-axis axis-right" aria-hidden="true">
          +
        </span>
      </div>
      <figcaption className="field-caption">
        <span>
          {unavailable
            ? "Interactive artwork unavailable in this browser."
            : "Generative artwork. Not evaluation data."}
        </span>
        <button
          className="motion-control"
          onClick={() => setPlaying((value) => !value)}
          disabled={unavailable}
          aria-label={playing ? "Pause animation" : "Play animation"}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {playing ? <path d="M5 3v10M11 3v10" /> : <path d="m5 3 8 5-8 5Z" />}
          </svg>
          <span>{playing ? "Pause" : "Play"}</span>
        </button>
      </figcaption>
    </figure>
  );
}
