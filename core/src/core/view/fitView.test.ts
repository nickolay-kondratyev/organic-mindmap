import { contentBounds, FIT_MARGIN_PX, FIT_MAX_ZOOM, fitView, type ContentBounds } from './fitView';

describe('contentBounds', () => {
  it('GIVEN two positioned nodes WHEN bounding THEN the box spans both node boxes', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 100, y: -50 }],
    ]);
    const sizes = new Map([
      ['a', { width: 20, height: 10 }],
      ['b', { width: 40, height: 20 }],
    ]);
    expect(contentBounds(positions, sizes)).toEqual({ minX: -10, minY: -60, maxX: 120, maxY: 5 });
  });

  it('GIVEN no nodes WHEN bounding THEN there are no bounds', () => {
    expect(contentBounds(new Map(), new Map())).toBeNull();
  });
});

describe('fitView', () => {
  // GIVEN a map wider than the viewport, off-center to the right
  const wide: ContentBounds = { minX: -600, minY: -100, maxX: 1400, maxY: 100 };
  const viewport = { width: 1000, height: 800 };

  it('WHEN fitting a map wider than the viewport THEN the zoom leaves exactly the margin on the sides', () => {
    const { zoom } = fitView(wide, viewport);
    expect(zoom * (wide.maxX - wide.minX)).toBeCloseTo(viewport.width - 2 * FIT_MARGIN_PX);
  });

  it('WHEN fitting THEN the content center lands on the viewport center', () => {
    const { offset, zoom } = fitView(wide, viewport);
    const contentCenterX = (wide.minX + wide.maxX) / 2;
    // screen = viewportCenter + offset + zoom * scene; the fit is correct when the scene center maps to offset 0.
    expect(offset.x + zoom * contentCenterX).toBeCloseTo(0);
  });

  it('WHEN fitting a map taller than wide THEN the height is the limiting axis', () => {
    const tall: ContentBounds = { minX: -50, minY: -2000, maxX: 50, maxY: 2000 };
    const { zoom } = fitView(tall, viewport);
    expect(zoom * (tall.maxY - tall.minY)).toBeCloseTo(viewport.height - 2 * FIT_MARGIN_PX);
  });

  it('WHEN the map is smaller than the viewport THEN it is not enlarged past the fit zoom cap', () => {
    const small: ContentBounds = { minX: -10, minY: -10, maxX: 10, maxY: 10 };
    expect(fitView(small, viewport).zoom).toBe(FIT_MAX_ZOOM);
  });

  it('WHEN the viewport is smaller than the margins THEN the zoom is zero rather than negative', () => {
    expect(fitView(wide, { width: FIT_MARGIN_PX, height: FIT_MARGIN_PX }).zoom).toBe(0);
  });
});
