import { describe, expect, it } from "vitest";
import { FramePacer } from "./pacing";

/** Feeds identical frames and reports how many times the pacer asked for less work. */
function feed(pacer: FramePacer, intervalMs: number, frames: number, budgetMs: number) {
  let requests = 0;
  for (let i = 0; i < frames; i++) {
    if (pacer.exceeds(intervalMs, budgetMs)) requests += 1;
  }
  return requests;
}

describe("frame pacing", () => {
  it("accepts a renderer that holds its budget and flags one that stays slow", () => {
    expect(feed(new FramePacer(), 16.7, 600, 30)).toBe(0);
    expect(feed(new FramePacer(), 24, 600, 30)).toBe(0);
    // 40 ms frames fill a window every 30 frames; two slow windows make one request.
    expect(feed(new FramePacer(), 40, 60, 30)).toBe(1);
    expect(feed(new FramePacer(), 40, 59, 30)).toBe(0);
  });

  it("ignores a slow stretch that recovers before the next window ends", () => {
    const pacer = new FramePacer();
    expect(feed(pacer, 40, 30, 30)).toBe(0);
    expect(feed(pacer, 16.7, 80, 30)).toBe(0);
    expect(feed(pacer, 40, 30, 30)).toBe(0);
    expect(feed(pacer, 40, 30, 30)).toBe(1);
  });

  it("notices a renderer that only manages a couple of frames a second", () => {
    expect(feed(new FramePacer(), 500, 5, 50)).toBe(0);
    expect(feed(new FramePacer(), 500, 6, 50)).toBe(1);
  });

  it("does not mistake a hidden tab or a sleeping machine for a slow renderer", () => {
    const pacer = new FramePacer();
    expect(feed(pacer, 40, 45, 30)).toBe(0);
    expect(pacer.exceeds(45_000, 30)).toBe(false);
    // The interruption discards the slow window counted before it.
    expect(feed(pacer, 40, 59, 30)).toBe(0);
    expect(feed(pacer, 40, 1, 30)).toBe(1);
  });
});
