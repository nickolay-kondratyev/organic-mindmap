import { resolveConfig, type PartialMindmapConfig } from '../config/config';
import { layoutStagesFor, resolveExtensions, type MindmapExtensions } from '../extensions';
import type { MindmapData } from '../model/node';
import { buildTree } from '../model/tree';
import { resolveNodeSizes } from '../size/nodeSizeResolver';
import type { NodePositions } from './layoutTypes';
import { runLayoutPipeline } from './pipeline';

export interface LayoutMindmapOptions {
  readonly config?: PartialMindmapConfig;
  readonly extensions?: Partial<MindmapExtensions>;
}

/**
 * Spec L7: data in -> positions out, without rendering, using the same config/extension resolution as
 * `mountMindmap`. Lets hosts lay out, persist or animate on their own.
 */
export function layoutMindmap(data: MindmapData, options: LayoutMindmapOptions = {}): NodePositions {
  const config = resolveConfig(options.config);
  const extensions = resolveExtensions(options.extensions);
  const tree = buildTree(data, config.layout.sideOrder);
  return runLayoutPipeline(
    { tree, sizes: resolveNodeSizes(tree, config.node), config: config.layout, bowCurve: extensions.bowCurve },
    layoutStagesFor(extensions, config.layout),
  );
}
