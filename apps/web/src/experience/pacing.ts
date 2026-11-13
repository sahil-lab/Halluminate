const WINDOW_MS = 1200;
const MIN_FRAMES = 3;
const SLOW_WINDOWS = 2;
const INTERRUPTION_MS = 1000;

/**
 * Decides when a renderer is persistently too slow. Real frame intervals are averaged
 * over short windows, and only consecutive slow windows count, so a hitch from loading,
 * garbage collection or a busy machine does not cost the page its quality.
 */
export class FramePacer {
  private elapsed = 0;
  private frames = 0;
  private slow = 0;

  /** Returns true once consecutive windows have averaged slower than the budget. */
  exceeds(intervalMs: number, budgetMs: number): boolean {
    // A long gap means the tab was hidden or the machine slept, not a slow renderer.
    if (intervalMs > INTERRUPTION_MS) {
      this.reset();
      return false;
    }
    this.elapsed += intervalMs;
    this.frames += 1;
    if (this.elapsed < WINDOW_MS || this.frames < MIN_FRAMES) return false;
    const average = this.elapsed / this.frames;
    this.elapsed = 0;
    this.frames = 0;
    this.slow = average > budgetMs ? this.slow + 1 : 0;
    if (this.slow < SLOW_WINDOWS) return false;
    this.slow = 0;
    return true;
  }

  reset(): void {
    this.elapsed = 0;
    this.frames = 0;
    this.slow = 0;
  }
}
