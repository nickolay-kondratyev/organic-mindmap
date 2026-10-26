import { DEFAULT_CONFIG, resolveConfig } from '../config/config';
import { DEFAULT_EXTENSIONS, resolveExtensions } from '../extensions';
import type { PositionOverrides } from '../layout/positionOverrides';
import { REFERENCE_DATA } from '../model/referenceData';
import { cachedSceneBuilder } from './sceneCache';

describe('GIVEN a cached scene builder that painted the reference data once', () => {
  const overrides: PositionOverrides = new Map();
  let build: ReturnType<typeof cachedSceneBuilder>;
  let painted: ReturnType<typeof build>;
  beforeEach(() => {
    build = cachedSceneBuilder();
    painted = build(REFERENCE_DATA, DEFAULT_CONFIG, DEFAULT_EXTENSIONS, overrides);
  });

  it('WHEN painted again with the same inputs (hover, pan, zoom, busy frame) THEN the scene is not rebuilt', () => {
    expect(build(REFERENCE_DATA, DEFAULT_CONFIG, DEFAULT_EXTENSIONS, overrides)).toBe(painted);
  });

  it('WHEN the data is a new object THEN the scene is rebuilt', () => {
    expect(build([...REFERENCE_DATA], DEFAULT_CONFIG, DEFAULT_EXTENSIONS, overrides)).not.toBe(painted);
  });

  it('WHEN the config is a new object THEN the scene is rebuilt', () => {
    expect(build(REFERENCE_DATA, resolveConfig({}), DEFAULT_EXTENSIONS, overrides)).not.toBe(painted);
  });

  it('WHEN the extensions are a new object THEN the scene is rebuilt', () => {
    expect(build(REFERENCE_DATA, DEFAULT_CONFIG, resolveExtensions({}), overrides)).not.toBe(painted);
  });

  it('WHEN the position overrides are a new map THEN the scene is rebuilt', () => {
    expect(build(REFERENCE_DATA, DEFAULT_CONFIG, DEFAULT_EXTENSIONS, new Map())).not.toBe(painted);
  });
});
