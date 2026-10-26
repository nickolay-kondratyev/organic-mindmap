import { rememberLast } from '../memo/rememberLast';
import { buildScene } from './scene';

/**
 * `buildScene` that hands back the previous `Scene` while data, config, extensions and overrides are the same
 * objects as last time. Hover, pan, zoom and the busy animation repaint with unchanged inputs, so they pay
 * nothing for the scene; any visible change arrives as a new object (host data, resolved config, the preview's
 * data, the overrides map) and rebuilds. One instance per mount.
 */
export function cachedSceneBuilder(): typeof buildScene {
  return rememberLast(buildScene);
}
