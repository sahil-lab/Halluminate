import { createGeometry, type FieldGeometry } from "./shapes";

export type FieldQuality = "high" | "medium" | "low" | "minimal";
export type FieldPipeline = "hdr" | "direct";

export interface FieldScene {
  /** 0 orb, 1 contained world, 2 trace, 3 loop, 4 horizon */
  morph: number;
  /** Centre of the formation in normalised device coordinates. */
  x: number;
  y: number;
  scale: number;
  yaw: number;
  pitch: number;
  roll: number;
  energy: number;
  time: number;
  pointerX: number;
  pointerY: number;
  pointerForce: number;
  /** 0 when idle, otherwise the progress of a shockwave from 0 to 1. */
  pulse: number;
}

interface RenderTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

const DISTANCE = 5.2;
const TAN_HALF_FOV = Math.tan((35 * Math.PI) / 360);
const INK = [10 / 255, 10 / 255, 9 / 255] as const;
// The soft glow is drawn at a quarter of the resolution, where it costs a sixteenth.
const GLOW_DIVISOR = 4;
// The drawing buffer is capped both relative to CSS pixels and in total, so a large or
// dense display does not multiply the cost. Below the display's resolution it is upscaled.
const LEVELS: Record<
  FieldQuality,
  { particles: number; pixelRatio: number; pixels: number; glow: boolean }
> = {
  high: { particles: 56000, pixelRatio: 1.5, pixels: 3_200_000, glow: true },
  medium: { particles: 32000, pixelRatio: 1.35, pixels: 2_000_000, glow: true },
  low: { particles: 14000, pixelRatio: 1, pixels: 1_300_000, glow: false },
  minimal: { particles: 9000, pixelRatio: 0.6, pixels: 500_000, glow: false },
};
const ORDER: readonly FieldQuality[] = ["high", "medium", "low", "minimal"];
const UNIFORMS = [
  "uProjection",
  "uRotation",
  "uOffset",
  "uScale",
  "uMorph",
  "uTime",
  "uPointScale",
  "uAspect",
  "uPointer",
  "uPulse",
  "uEnergy",
  "uDensity",
  "uHalo",
] as const;

const VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aOrb;
layout(location = 1) in vec3 aCube;
layout(location = 2) in vec3 aTrace;
layout(location = 3) in vec3 aLoop;
layout(location = 4) in vec3 aHorizon;
layout(location = 5) in vec4 aSeed;
layout(location = 6) in vec2 aParam;

uniform mat4 uProjection;
uniform mat3 uRotation;
uniform vec3 uOffset;
uniform float uScale;
uniform float uMorph;
uniform float uTime;
uniform float uPointScale;
uniform float uAspect;
uniform vec3 uPointer;
uniform float uPulse;
uniform float uEnergy;
uniform float uDensity;
uniform float uHalo;

out vec3 vColor;

const float PI = 3.14159265;

float ease(float t) {
  return t * t * (3.0 - 2.0 * t);
}

// Each particle leaves for the next formation slightly later than its neighbours.
float stage(float morph, float lag) {
  return ease(clamp(morph * 1.4 - lag, 0.0, 1.0));
}

float wobble(vec3 p, float t) {
  return sin(p.x * 2.3 + t * 0.61 + sin(p.y * 1.9 - t * 0.37) * 1.4)
    * sin(p.y * 2.7 - t * 0.53 + sin(p.z * 2.1 + t * 0.29) * 1.2)
    * sin(p.z * 2.1 + t * 0.47 + sin(p.x * 2.5 - t * 0.41) * 1.3);
}

void main() {
  float morph = clamp(uMorph, 0.0, 4.0);
  float lag = aSeed.x * 0.4;
  float toCube = stage(morph, lag);
  float toTrace = stage(morph - 1.0, lag);
  float toLoop = stage(morph - 2.0, lag);
  float toHorizon = stage(morph - 3.0, lag);

  float shell = 1.0 - smoothstep(1.02, 1.3, length(aOrb));
  float swell = wobble(normalize(aOrb) * 1.3, uTime);
  vec3 orb = aOrb * (1.0 + 0.17 * swell * shell);

  vec3 horizon = aHorizon;
  horizon.y += 0.17 * sin(horizon.x * 1.2 + uTime * 0.5) * cos(horizon.z * 0.85 - uTime * 0.38)
    + 0.06 * sin(horizon.x * 3.0 - horizon.z * 2.2 + uTime * 0.75);

  vec3 position = mix(orb, aCube, toCube);
  position = mix(position, aTrace, toTrace);
  position = mix(position, aLoop, toLoop);
  position = mix(position, horizon, toHorizon);

  float travel = sin(PI * toCube) + sin(PI * toTrace) + sin(PI * toLoop) + sin(PI * toHorizon);
  vec3 drift = vec3(
    sin(aSeed.w * 43.0 + uTime * 0.9 + position.y * 2.6),
    sin(aSeed.w * 71.0 + uTime * 0.7 + position.z * 2.6),
    sin(aSeed.w * 97.0 + uTime * 0.8 + position.x * 2.6));
  position += drift * travel * (0.1 + 0.2 * aSeed.y);

  float reach = length(position);
  float ring = (reach - uPulse * 3.4) * 3.2;
  float wave = exp(-ring * ring) * (1.0 - uPulse) * step(0.0001, uPulse);
  position += position / max(reach, 0.001) * wave * 0.3;

  vec4 view = vec4(uRotation * (position * uScale) + uOffset, 1.0);
  vec4 clip = uProjection * view;

  vec2 away = clip.xy / clip.w - uPointer.xy;
  away.x *= uAspect;
  float push = exp(-dot(away, away) * 9.0) * uPointer.z;
  away /= max(length(away), 0.0001);
  away.x /= uAspect;
  clip.xy += away * push * 0.09 * clip.w;
  gl_Position = clip;

  // Depth of field: particles away from the focal plane grow and fade.
  float depth = max(-view.z, 0.1);
  float blur = clamp(abs(depth + uOffset.z) * 0.42, 0.0, 1.0);
  float core = mix(0.0042, 0.0092, aSeed.y * aSeed.y) * pow(uDensity, 0.3);
  float sharp = core + blur * blur * 0.03;
  float pixels = mix(sharp, sharp * 5.0 + 0.03, uHalo) * uPointScale / depth;
  gl_PointSize = clamp(pixels, 1.5, 140.0);

  float tracePulse = pow(0.5 + 0.5 * sin((aParam.x - uTime * 0.09) * PI * 8.0), 12.0)
    * step(0.0, aParam.x) * toTrace * (1.0 - toLoop);
  float loopPulse = pow(0.5 + 0.5 * sin((aParam.y - uTime * 0.06) * PI * 4.0), 16.0)
    * step(0.0, aParam.y) * toLoop * (1.0 - toHorizon);
  float crest = max(swell, 0.0) * shell * (1.0 - toCube);
  float glow = 1.0 + 1.4 * crest + 5.0 * (tracePulse + loopPulse) + 5.0 * wave;

  float focus = (core * core) / (sharp * sharp);
  // Fewer particles are each drawn brighter, but only up to a point: past it they would
  // read as confetti over the text rather than as one formation.
  float alpha = mix(focus * min(1.0, pixels * pixels / 2.25), 0.04, uHalo)
    * glow * uEnergy * min(mix(1.0, uDensity, 0.55), 2.2);

  vec3 color = mix(vec3(1.0, 0.34, 0.09), vec3(1.0, 0.66, 0.42), smoothstep(0.15, 0.85, aSeed.z));
  color = mix(color, vec3(0.38, 0.5, 1.0), step(0.9, aSeed.z));
  color += vec3(0.45, 0.42, 0.36) * min(glow - 1.0, 1.6) * 0.4;
  vColor = color * alpha;
}
`;

const FRAGMENT = `#version 300 es
precision highp float;

in vec3 vColor;
out vec4 outColor;

void main() {
  vec2 offset = gl_PointCoord * 2.0 - 1.0;
  float falloff = max(1.0 - dot(offset, offset), 0.0);
  outColor = vec4(vColor * falloff * falloff, 1.0);
}
`;

const COMPOSITE_VERTEX = `#version 300 es

out vec2 vUv;

void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uGlow;
uniform vec2 uGlowTexel;
uniform float uGlowStrength;
uniform vec3 uInk;

in vec2 vUv;
out vec4 outColor;

void main() {
  vec3 light = texture(uScene, vUv).rgb;
  // Four bilinear taps half a texel apart smooth the low-resolution glow as it is enlarged.
  vec2 reach = uGlowTexel * 0.5;
  vec3 glow = texture(uGlow, vUv + reach).rgb
    + texture(uGlow, vUv - reach).rgb
    + texture(uGlow, vUv + vec2(reach.x, -reach.y)).rgb
    + texture(uGlow, vUv + vec2(-reach.x, reach.y)).rgb;
  light += glow * 0.25 * uGlowStrength;
  float luma = dot(light, vec3(0.299, 0.587, 0.114));
  // Dense regions keep their hue instead of clipping; only the hottest cores whiten.
  vec3 mapped = mix(light / (1.0 + luma), 1.0 - exp(-light), 0.3);
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  outColor = vec4(uInk + mapped + dither / 255.0, 1.0);
}
`;

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("The browser could not allocate a shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${log ?? "no details"}`);
  }
  return shader;
}

function link(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("The browser could not allocate a shader program.");
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Shader linking failed: ${log ?? "no details"}`);
  }
  return program;
}

function isSoftwareRenderer(gl: WebGL2RenderingContext): boolean {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer: unknown = gl.getParameter(
    info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
  );
  return /swiftshader|llvmpipe|software|basic render/i.test(String(renderer));
}

/**
 * Additive particles are accumulated in a half-float buffer and tone-mapped, so dense
 * formations stay coloured, with a soft glow drawn at low resolution and added on top.
 * Without float render targets the particles are drawn directly, without the glow.
 */
export class ParticleField {
  /** True when WebGL is emulated on the processor, where every frame is expensive. */
  readonly software: boolean;

  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly geometry: FieldGeometry;
  private readonly projection = new Float32Array(16);
  private readonly rotation = new Float32Array(9);
  private readonly uniforms = {} as Record<
    (typeof UNIFORMS)[number],
    WebGLUniformLocation | null
  >;
  private program: WebGLProgram | null = null;
  private composite: WebGLProgram | null = null;
  private glowStrength: WebGLUniformLocation | null = null;
  private glowTexel: WebGLUniformLocation | null = null;
  private vertexArray: WebGLVertexArrayObject | null = null;
  private buffers: WebGLBuffer[] = [];
  private targets: { scene: RenderTarget; glow: RenderTarget } | null = null;
  private level: FieldQuality;
  private lost = false;

  /** Returns null when WebGL2 is unavailable; throws when the shaders cannot be built. */
  static create(
    canvas: HTMLCanvasElement,
    preferred: FieldQuality,
    forced: boolean,
  ): ParticleField | null {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    return gl ? new ParticleField(canvas, gl, preferred, forced) : null;
  }

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    preferred: FieldQuality,
    forced: boolean,
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.software = isSoftwareRenderer(gl);
    this.level = !forced && this.software ? "low" : preferred;
    this.geometry = createGeometry(LEVELS.high.particles);
    this.build();
    canvas.addEventListener("webglcontextlost", this.handleLost);
    canvas.addEventListener("webglcontextrestored", this.handleRestored);
  }

  get quality(): FieldQuality {
    return this.level;
  }

  get particles(): number {
    return LEVELS[this.level].particles;
  }

  get pipeline(): FieldPipeline {
    return this.targets ? "hdr" : "direct";
  }

  /** Matches the drawing buffer to the element. Returns true when the size changed. */
  resize(): boolean {
    const level = LEVELS[this.level];
    const cssWidth = this.canvas.clientWidth;
    const cssHeight = this.canvas.clientHeight;
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      level.pixelRatio,
      Math.sqrt(level.pixels / Math.max(cssWidth * cssHeight, 1)),
    );
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (this.canvas.width === width && this.canvas.height === height) return false;
    this.canvas.width = width;
    this.canvas.height = height;
    this.allocateTargets();
    return true;
  }

  /** Steps down one quality level. Returns false when already at the lowest. */
  lower(): boolean {
    const next = ORDER[ORDER.indexOf(this.level) + 1];
    if (!next) return false;
    this.level = next;
    this.resize();
    return true;
  }

  draw(scene: FieldScene): void {
    if (this.lost || !this.program) return;
    const { gl, uniforms, projection, rotation, targets } = this;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const aspect = width / height;
    const level = LEVELS[this.level];

    const near = 0.1;
    const far = 60;
    projection.fill(0);
    projection[0] = 1 / (TAN_HALF_FOV * aspect);
    projection[5] = 1 / TAN_HALF_FOV;
    projection[10] = (far + near) / (near - far);
    projection[11] = -1;
    projection[14] = (2 * far * near) / (near - far);

    // Column-major roll * pitch * yaw.
    const cy = Math.cos(scene.yaw);
    const sy = Math.sin(scene.yaw);
    const cp = Math.cos(scene.pitch);
    const sp = Math.sin(scene.pitch);
    const cr = Math.cos(scene.roll);
    const sr = Math.sin(scene.roll);
    rotation[0] = cr * cy - sr * sp * sy;
    rotation[1] = sr * cy + cr * sp * sy;
    rotation[2] = -cp * sy;
    rotation[3] = -sr * cp;
    rotation[4] = cr * cp;
    rotation[5] = sp;
    rotation[6] = cr * sy + sr * sp * cy;
    rotation[7] = sr * sy - cr * sp * cy;
    rotation[8] = cp * cy;

    gl.bindFramebuffer(gl.FRAMEBUFFER, targets ? targets.scene.framebuffer : null);
    gl.viewport(0, 0, width, height);
    if (targets) gl.clearColor(0, 0, 0, 1);
    else gl.clearColor(INK[0], INK[1], INK[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.uniformMatrix4fv(uniforms.uProjection, false, projection);
    gl.uniformMatrix3fv(uniforms.uRotation, false, rotation);
    gl.uniform3f(
      uniforms.uOffset,
      scene.x * DISTANCE * TAN_HALF_FOV * aspect,
      scene.y * DISTANCE * TAN_HALF_FOV,
      -DISTANCE,
    );
    gl.uniform1f(uniforms.uScale, scene.scale);
    gl.uniform1f(uniforms.uMorph, scene.morph);
    gl.uniform1f(uniforms.uTime, scene.time);
    gl.uniform1f(uniforms.uPointScale, height / TAN_HALF_FOV);
    gl.uniform1f(uniforms.uAspect, aspect);
    gl.uniform3f(uniforms.uPointer, scene.pointerX, scene.pointerY, scene.pointerForce);
    gl.uniform1f(uniforms.uPulse, scene.pulse);
    // Without tone mapping the same light would clip, so it is turned down.
    gl.uniform1f(uniforms.uEnergy, scene.energy * (targets ? 1 : 0.5));
    gl.uniform1f(uniforms.uDensity, LEVELS.high.particles / level.particles);
    gl.uniform1f(uniforms.uHalo, 0);
    gl.drawArrays(gl.POINTS, 0, level.particles);
    if (!targets) return;

    if (level.glow) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets.glow.framebuffer);
      gl.viewport(0, 0, targets.glow.width, targets.glow.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uniforms.uPointScale, targets.glow.height / TAN_HALF_FOV);
      gl.uniform1f(uniforms.uHalo, 1);
      gl.drawArrays(gl.POINTS, 0, Math.floor(level.particles / 7));
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.useProgram(this.composite);
    gl.bindVertexArray(null);
    gl.uniform1f(this.glowStrength, level.glow ? 1 : 0);
    gl.uniform2f(this.glowTexel, 1 / targets.glow.width, 1 / targets.glow.height);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, targets.glow.texture);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets.scene.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Samples the frame that was just drawn and reports whether anything is visibly lit. */
  inspect(): boolean {
    const { gl } = this;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const row = new Uint8Array(width * 4);
    let lit = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (let line = 1; line < 48; line++) {
      gl.readPixels(
        0,
        Math.floor((height * line) / 48),
        width,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        row,
      );
      for (let x = 0; x < row.length; x += 4) {
        if ((row[x] as number) > 40) lit++;
      }
    }
    return lit > 24;
  }

  dispose(): void {
    this.canvas.removeEventListener("webglcontextlost", this.handleLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleRestored);
    this.release();
  }

  private build(): void {
    const { gl, geometry } = this;
    const program = link(gl, VERTEX, FRAGMENT);
    const vertexArray = gl.createVertexArray();
    gl.bindVertexArray(vertexArray);
    const attributes: [Float32Array, number][] = [
      [geometry.orb, 3],
      [geometry.cube, 3],
      [geometry.trace, 3],
      [geometry.loop, 3],
      [geometry.horizon, 3],
      [geometry.seeds, 4],
      [geometry.params, 2],
    ];
    this.buffers = attributes.map(([data, size], location) => {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("The browser could not allocate particle storage.");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      return buffer;
    });
    gl.bindVertexArray(null);
    for (const name of UNIFORMS) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.program = program;
    this.vertexArray = vertexArray;

    if (
      gl.getExtension("EXT_color_buffer_float") ||
      gl.getExtension("EXT_color_buffer_half_float")
    ) {
      const composite = link(gl, COMPOSITE_VERTEX, COMPOSITE_FRAGMENT);
      gl.useProgram(composite);
      gl.uniform1i(gl.getUniformLocation(composite, "uScene"), 0);
      gl.uniform1i(gl.getUniformLocation(composite, "uGlow"), 1);
      gl.uniform3f(gl.getUniformLocation(composite, "uInk"), INK[0], INK[1], INK[2]);
      this.glowStrength = gl.getUniformLocation(composite, "uGlowStrength");
      this.glowTexel = gl.getUniformLocation(composite, "uGlowTexel");
      this.composite = composite;
      this.allocateTargets();
    }
  }

  /** (Re)creates the half-float buffers for the current canvas size. */
  private allocateTargets(): void {
    const { gl, canvas } = this;
    if (!this.composite) return;
    this.releaseTargets();
    const scene = this.createTarget(canvas.width, canvas.height, gl.NEAREST);
    const glow = scene
      ? this.createTarget(
          Math.max(1, Math.round(canvas.width / GLOW_DIVISOR)),
          Math.max(1, Math.round(canvas.height / GLOW_DIVISOR)),
          gl.LINEAR,
        )
      : null;
    if (scene && glow) {
      this.targets = { scene, glow };
      return;
    }
    if (scene) {
      gl.deleteFramebuffer(scene.framebuffer);
      gl.deleteTexture(scene.texture);
    }
    gl.deleteProgram(this.composite);
    this.composite = null;
    console.warn("Float render targets are unusable here. Drawing the field directly.");
  }

  private createTarget(
    width: number,
    height: number,
    filter: number,
  ): RenderTarget | null {
    const { gl } = this;
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (texture && framebuffer) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        width,
        height,
        0,
        gl.RGBA,
        gl.HALF_FLOAT,
        null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      const complete =
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (complete) return { framebuffer, texture, width, height };
    }
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    return null;
  }

  private releaseTargets(): void {
    if (!this.targets) return;
    for (const target of [this.targets.scene, this.targets.glow]) {
      this.gl.deleteFramebuffer(target.framebuffer);
      this.gl.deleteTexture(target.texture);
    }
    this.targets = null;
  }

  private release(): void {
    const { gl } = this;
    this.releaseTargets();
    for (const buffer of this.buffers) gl.deleteBuffer(buffer);
    this.buffers = [];
    gl.deleteVertexArray(this.vertexArray);
    gl.deleteProgram(this.program);
    gl.deleteProgram(this.composite);
    this.vertexArray = null;
    this.program = null;
    this.composite = null;
  }

  private readonly handleLost = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
  };

  private readonly handleRestored = (): void => {
    // Everything created before the loss is gone; drop the stale handles and rebuild.
    this.buffers = [];
    this.targets = null;
    this.vertexArray = null;
    this.program = null;
    this.composite = null;
    try {
      this.build();
      this.lost = false;
    } catch (error: unknown) {
      console.error("The particle field could not be restored.", error);
    }
  };
}
