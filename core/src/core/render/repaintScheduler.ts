/** Minimal frame API so the scheduler is testable without a browser. */
export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

export const windowFrameScheduler: FrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

/** Coalesces any number of `request()` calls within one frame into a single paint (spec L8). */
export class RepaintScheduler {
  private pendingHandle: number | null = null;

  constructor(
    private readonly paint: () => void,
    private readonly frames: FrameScheduler,
  ) {}

  request(): void {
    if (this.pendingHandle !== null) return;
    this.pendingHandle = this.frames.request(() => {
      this.pendingHandle = null;
      this.paint();
    });
  }

  cancel(): void {
    if (this.pendingHandle === null) return;
    this.frames.cancel(this.pendingHandle);
    this.pendingHandle = null;
  }
}
