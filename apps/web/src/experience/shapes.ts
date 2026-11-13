export interface FieldGeometry {
  count: number;
  orb: Float32Array;
  cube: Float32Array;
  trace: Float32Array;
  loop: Float32Array;
  horizon: Float32Array;
  /** stagger, size, heat, phase */
  seeds: Float32Array;
  /** position along the trace and along the loop; -1 when the particle is off the curve */
  params: Float32Array;
}

type Point = [number, number, number];

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function tracePoint(t: number): Point {
  return [
    (t - 0.5) * 4.6,
    0.4 * Math.sin(t * 7.2 + 0.4) + 0.14 * Math.sin(t * 19 + 1.3),
    0.5 * Math.cos(t * 5.6 + 0.8),
  ];
}

function loopPoint(t: number): Point {
  const angle = t * TAU;
  const ring = 0.9 + 0.4 * Math.cos(3 * angle);
  return [
    ring * Math.cos(2 * angle),
    ring * Math.sin(2 * angle),
    0.4 * Math.sin(3 * angle),
  ];
}

/**
 * Five targets for the same particles. Every target is sampled independently of the
 * particle index, so drawing only a prefix of the buffers is still an even subsample.
 */
export function createGeometry(count: number, seed = 2026): FieldGeometry {
  const random = createRandom(seed);
  const gaussian = () =>
    Math.sqrt(-2 * Math.log(Math.max(random(), 1e-7))) * Math.cos(TAU * random());
  const direction = (): Point => {
    const y = random() * 2 - 1;
    const ring = Math.sqrt(1 - y * y);
    const angle = random() * TAU;
    return [ring * Math.cos(angle), y, ring * Math.sin(angle)];
  };

  const orb = new Float32Array(count * 3);
  const cube = new Float32Array(count * 3);
  const trace = new Float32Array(count * 3);
  const loop = new Float32Array(count * 3);
  const horizon = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  const params = new Float32Array(count * 2);

  const slots = new Uint32Array(count);
  for (let i = 0; i < count; i++) slots[i] = i;
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const held = slots[i] as number;
    slots[i] = slots[j] as number;
    slots[j] = held;
  }

  const columns = Math.ceil(Math.sqrt(count * 1.9));
  const rows = Math.ceil(count / columns);

  for (let i = 0; i < count; i++) {
    const slot = slots[i] as number;
    const at = i * 3;

    const role = random();
    let [dx, dy, dz] = direction();
    let radius = 1.12 + Math.pow(random(), 2.4) * 1.6;
    if (role < 0.7) {
      dy = 1 - (2 * (slot + 0.5)) / count;
      const ring = Math.sqrt(1 - dy * dy);
      dx = ring * Math.cos(slot * GOLDEN_ANGLE);
      dz = ring * Math.sin(slot * GOLDEN_ANGLE);
      radius = 1 + gaussian() * 0.004;
    } else if (role < 0.84) {
      radius = 0.72 + gaussian() * 0.01;
    }
    orb[at] = dx * radius;
    orb[at + 1] = dy * radius;
    orb[at + 2] = dz * radius;

    if (role < 0.16) {
      // The same surface particles contract into a world held inside the box.
      cube[at] = dx * 0.46;
      cube[at + 1] = dy * 0.46;
      cube[at + 2] = dz * 0.46;
    } else {
      const face = Math.floor(random() * 6);
      const side = (face & 1) === 0 ? -0.9 : 0.9;
      let u = random() * 2 - 1;
      let v = random() * 2 - 1;
      const kind = random();
      if (kind < 0.34) {
        if (random() < 0.5) u = random() < 0.5 ? -1 : 1;
        else v = random() < 0.5 ? -1 : 1;
      } else if (kind < 0.88) {
        if (random() < 0.5) u = Math.round(u * 4) / 4;
        else v = Math.round(v * 4) / 4;
      }
      const axis = face >> 1;
      cube[at] = axis === 0 ? side : u * 0.9;
      cube[at + 1] = axis === 1 ? side : axis === 0 ? u * 0.9 : v * 0.9;
      cube[at + 2] = axis === 2 ? side : v * 0.9;
    }

    const traceRole = random();
    let along = -1;
    if (traceRole < 0.4) {
      // Five strands twisting around the path, like a braided fibre.
      along = random();
      const [x, y, z] = tracePoint(along);
      const strand = Math.floor(random() * 5);
      const twist = along * 26 + (strand * TAU) / 5;
      const spread = 0.055 + 0.02 * Math.sin(along * 40 + strand);
      trace[at] = x + gaussian() * 0.006;
      trace[at + 1] = y + Math.cos(twist) * spread + gaussian() * 0.006;
      trace[at + 2] = z + Math.sin(twist) * spread + gaussian() * 0.006;
    } else if (traceRole < 0.6) {
      // Eight recorded steps along the way.
      along = (Math.floor(random() * 8) + 0.5) / 8;
      const [x, y, z] = tracePoint(along);
      const [nx, ny, nz] = direction();
      const shell = 0.105 + gaussian() * 0.004;
      trace[at] = x + nx * shell;
      trace[at + 1] = y + ny * shell;
      trace[at + 2] = z + nz * shell;
    } else if (traceRole < 0.77) {
      // Faint branches: the paths that were available but not taken.
      const node = 1 + Math.floor(random() * 6);
      const reach = Math.pow(random(), 1.7);
      const [x, y, z] = tracePoint((node + 0.5) / 8 + reach * 0.2);
      const spread = 0.01 + reach * 0.03;
      trace[at] = x + gaussian() * spread;
      trace[at + 1] =
        y + (node % 2 === 0 ? 0.8 : -0.8) * Math.pow(reach, 1.5) + gaussian() * spread;
      trace[at + 2] = z + Math.sin(node * 1.7) * 0.4 * reach + gaussian() * spread;
    } else {
      const [x, y, z] = tracePoint(random());
      const cloud = 0.16 + Math.pow(random(), 2) * 0.5;
      trace[at] = x + gaussian() * cloud;
      trace[at + 1] = y + gaussian() * cloud;
      trace[at + 2] = z + gaussian() * cloud;
    }

    const loopRole = random();
    let around = -1;
    if (loopRole < 0.7) {
      around = random();
      const [x, y, z] = loopPoint(around);
      const [nx, ny, nz] = direction();
      const tube = loopRole < 0.56 ? 0.09 + gaussian() * 0.004 : random() * 0.03;
      loop[at] = x + nx * tube;
      loop[at + 1] = y + ny * tube;
      loop[at + 2] = z + nz * tube;
    } else {
      const [nx, ny, nz] = direction();
      const haze = 0.5 + Math.pow(random(), 2) * 1.5;
      loop[at] = nx * haze;
      loop[at + 1] = ny * haze;
      loop[at + 2] = nz * haze;
    }

    horizon[at] = ((slot % columns) / (columns - 1) - 0.5) * 9.4;
    horizon[at + 1] = -0.9;
    horizon[at + 2] = 1.5 - (Math.floor(slot / columns) / (rows - 1)) * 6.4;

    seeds[i * 4] = random();
    seeds[i * 4 + 1] = random();
    seeds[i * 4 + 2] = random();
    seeds[i * 4 + 3] = random();
    params[i * 2] = along;
    params[i * 2 + 1] = around;
  }

  return { count, orb, cube, trace, loop, horizon, seeds, params };
}
