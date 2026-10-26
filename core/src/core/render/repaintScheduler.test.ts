import { RepaintScheduler, type FrameScheduler } from './repaintScheduler';

/** Manual frame clock: frames only advance when the test says so. */
class FakeFrames implements FrameScheduler {
  private callbacks = new Map<number, () => void>();
  private nextHandle = 1;
  request(callback: () => void): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }
  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }
  tick(): void {
    const due = [...this.callbacks.values()];
    this.callbacks.clear();
    due.forEach((cb) => cb());
  }
}

describe('RepaintScheduler', () => {
  it('GIVEN three requests in one frame WHEN the frame fires THEN paint runs once', () => {
    const frames = new FakeFrames();
    let paints = 0;
    const scheduler = new RepaintScheduler(() => paints++, frames);
    scheduler.request();
    scheduler.request();
    scheduler.request();
    frames.tick();
    expect(paints).toBe(1);
  });

  it('GIVEN a request after a frame fired WHEN the next frame fires THEN paint runs again', () => {
    const frames = new FakeFrames();
    let paints = 0;
    const scheduler = new RepaintScheduler(() => paints++, frames);
    scheduler.request();
    frames.tick();
    scheduler.request();
    frames.tick();
    expect(paints).toBe(2);
  });

  it('GIVEN a pending request WHEN cancelled before the frame THEN paint never runs', () => {
    const frames = new FakeFrames();
    let paints = 0;
    const scheduler = new RepaintScheduler(() => paints++, frames);
    scheduler.request();
    scheduler.cancel();
    frames.tick();
    expect(paints).toBe(0);
  });
});
