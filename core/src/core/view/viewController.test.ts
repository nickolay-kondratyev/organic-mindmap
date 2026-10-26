import { fitView, type ContentBounds } from './fitView';
import { DEFAULT_VIEW, MAX_ZOOM, MIN_ZOOM, ViewController, ZOOM_STEP_FACTOR, type MindmapView } from './viewController';

const WIDTH = 800;
const HEIGHT = 600;
const CURSOR = { x: 650, y: 120 };
const ZOOM_IN_FACTOR = 2;
const WHEEL_UP_DELTA_Y = -300;
const PRECISION_DIGITS = 9;
const HUGE_FACTOR = 1000;
const PANNED_ZOOM = 1.5;
const SCENE_POINT = { x: 320, y: -140 };
/** Twice as wide as the viewport, so fitting it must zoom out. */
const WIDE_CONTENT: ContentBounds = { minX: -WIDTH, minY: -100, maxX: WIDTH, maxY: 100 };

describe('ViewController', () => {
  let changes: MindmapView[];
  let controller: ViewController;

  beforeEach(() => {
    changes = [];
    controller = new ViewController((view) => changes.push(view));
    controller.setViewportSize(WIDTH, HEIGHT);
    // GIVEN a view that is already panned and zoomed
    controller.setView({ offset: { x: 40, y: -25 }, zoom: PANNED_ZOOM });
  });

  it('WHEN zooming at the cursor THEN the scene point under the cursor stays put', () => {
    const before = controller.screenToScene(CURSOR);
    controller.zoomAt(CURSOR, ZOOM_IN_FACTOR);
    const after = controller.sceneToScreen(before);
    expect([after.x, after.y].map((v) => v.toFixed(PRECISION_DIGITS))).toEqual(
      [CURSOR.x, CURSOR.y].map((v) => v.toFixed(PRECISION_DIGITS)),
    );
  });

  it('WHEN zooming hits the maximum THEN the cursor anchor still holds', () => {
    const before = controller.screenToScene(CURSOR);
    controller.zoomAt(CURSOR, HUGE_FACTOR);
    const after = controller.sceneToScreen(before);
    expect([after.x, after.y].map((v) => v.toFixed(PRECISION_DIGITS))).toEqual(
      [CURSOR.x, CURSOR.y].map((v) => v.toFixed(PRECISION_DIGITS)),
    );
  });

  it('WHEN zooming far in THEN the zoom is clamped to the maximum', () => {
    controller.zoomAt(CURSOR, HUGE_FACTOR);
    expect(controller.view.zoom).toBe(MAX_ZOOM);
  });

  it('WHEN zooming far out THEN the zoom is clamped to the minimum', () => {
    controller.zoomAt(CURSOR, 1 / HUGE_FACTOR);
    expect(controller.view.zoom).toBe(MIN_ZOOM);
  });

  it('WHEN the wheel scrolls up THEN it zooms in', () => {
    controller.zoomByWheel(CURSOR, WHEEL_UP_DELTA_Y);
    expect(controller.view.zoom).toBeGreaterThan(PANNED_ZOOM);
  });

  it('WHEN panning THEN the offset moves by the delta', () => {
    controller.panBy({ x: 10, y: 5 });
    expect(controller.view.offset).toEqual({ x: 50, y: -20 });
  });

  it('WHEN zooming in via the API THEN the zoom grows by one step', () => {
    controller.zoomIn();
    expect(controller.view.zoom).toBeCloseTo(PANNED_ZOOM * ZOOM_STEP_FACTOR);
  });

  it('WHEN zooming out via the API THEN the zoom shrinks by one step', () => {
    controller.zoomOut();
    expect(controller.view.zoom).toBeCloseTo(PANNED_ZOOM / ZOOM_STEP_FACTOR);
  });

  it('WHEN zooming via the API THEN the viewport center stays put', () => {
    const center = { x: WIDTH / 2, y: HEIGHT / 2 };
    const before = controller.screenToScene(center);
    controller.zoomIn();
    expect(controller.sceneToScreen(before).x).toBeCloseTo(center.x);
  });

  it('WHEN resetting without content bounds THEN the default view is restored', () => {
    controller.reset();
    expect(controller.view).toEqual(DEFAULT_VIEW);
  });

  it('WHEN resetting with content bounds THEN the view is the fit of those bounds', () => {
    controller.setContentBounds(WIDE_CONTENT);
    controller.reset();
    expect(controller.view).toEqual(fitView(WIDE_CONTENT, { width: WIDTH, height: HEIGHT }));
  });

  it('WHEN the user pans THEN the change is reported', () => {
    controller.panBy({ x: 1, y: 1 });
    expect(changes).toHaveLength(1);
  });

  it('WHEN wheeling further at the zoom limit THEN no change is reported', () => {
    controller.zoomAt(CURSOR, HUGE_FACTOR);
    changes = [];
    controller.zoomByWheel(CURSOR, WHEEL_UP_DELTA_Y);
    expect(changes).toEqual([]);
  });

  it('WHEN the host sets the view THEN it is not echoed back as a change', () => {
    controller.setView(DEFAULT_VIEW);
    expect(changes).toEqual([]);
  });

  it('WHEN the host sets an out-of-range zoom THEN it is clamped', () => {
    controller.setView({ offset: { x: 0, y: 0 }, zoom: MAX_ZOOM * 2 });
    expect(controller.view.zoom).toBe(MAX_ZOOM);
  });

  it('WHEN centering on a scene point THEN that point maps to the viewport center', () => {
    controller.centerOn(SCENE_POINT);
    const screen = controller.sceneToScreen(SCENE_POINT);
    expect([screen.x, screen.y].map((v) => v.toFixed(PRECISION_DIGITS))).toEqual([WIDTH / 2, HEIGHT / 2].map((v) => v.toFixed(PRECISION_DIGITS)));
  });

  it('WHEN centering on a scene point THEN the zoom is kept', () => {
    controller.centerOn(SCENE_POINT);
    expect(controller.view.zoom).toBe(PANNED_ZOOM);
  });

  it('WHEN centering on a scene point THEN the change is reported', () => {
    controller.centerOn(SCENE_POINT);
    expect(changes).toEqual([controller.view]);
  });

  it('WHEN mapping the scene origin with the default view THEN it is the viewport center', () => {
    controller.setView(DEFAULT_VIEW);
    expect(controller.sceneToScreen({ x: 0, y: 0 })).toEqual({ x: WIDTH / 2, y: HEIGHT / 2 });
  });
});

describe('ViewController initial fit', () => {
  let changes: MindmapView[];
  let controller: ViewController;

  beforeEach(() => {
    changes = [];
    // GIVEN a fresh controller that has not been panned or zoomed
    controller = new ViewController((view) => changes.push(view));
  });

  it('WHEN the first content bounds arrive on a sized viewport THEN the view fits them', () => {
    controller.setViewportSize(WIDTH, HEIGHT);
    controller.setContentBounds(WIDE_CONTENT);
    expect(controller.view).toEqual(fitView(WIDE_CONTENT, { width: WIDTH, height: HEIGHT }));
  });

  it('WHEN the initial fit happens THEN it is reported as a view change', () => {
    controller.setViewportSize(WIDTH, HEIGHT);
    controller.setContentBounds(WIDE_CONTENT);
    expect(changes).toHaveLength(1);
  });

  it('WHEN content bounds arrive while the viewport is still 0x0 THEN the fit waits for a sized viewport', () => {
    controller.setContentBounds(WIDE_CONTENT);
    controller.setViewportSize(WIDTH, HEIGHT);
    controller.setContentBounds(WIDE_CONTENT);
    expect(controller.view).toEqual(fitView(WIDE_CONTENT, { width: WIDTH, height: HEIGHT }));
  });

  it('WHEN the host set a view before the first paint THEN the first content bounds do not fit over it', () => {
    const restored: MindmapView = { offset: { x: 5, y: 5 }, zoom: 2 };
    controller.setViewportSize(WIDTH, HEIGHT);
    controller.setView(restored);
    controller.setContentBounds(WIDE_CONTENT);
    expect(controller.view).toEqual(restored);
  });

  it('WHEN the user has panned and new content bounds arrive THEN the view is left alone', () => {
    controller.setViewportSize(WIDTH, HEIGHT);
    controller.setContentBounds(WIDE_CONTENT);
    controller.panBy({ x: 10, y: 0 });
    const panned = controller.view;
    controller.setContentBounds({ ...WIDE_CONTENT, maxX: WIDE_CONTENT.maxX * 2 });
    expect(controller.view).toEqual(panned);
  });
});
