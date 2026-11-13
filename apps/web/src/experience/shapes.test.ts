import { describe, expect, it } from "vitest";
import { createGeometry } from "./shapes";

describe("particle formations", () => {
  it("are repeatable, finite and stay inside the camera's working volume", () => {
    const geometry = createGeometry(3000);
    const again = createGeometry(3000);
    for (const name of ["orb", "cube", "trace", "loop", "horizon"] as const) {
      const target = geometry[name];
      expect(target).toHaveLength(9000);
      expect(target).toEqual(again[name]);
      expect(
        target.every((value) => Number.isFinite(value) && Math.abs(value) < 6),
      ).toBe(true);
    }
    expect(geometry.seeds.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(
      geometry.params.every((value) => value === -1 || (value >= 0 && value <= 1)),
    ).toBe(true);
  });
});
