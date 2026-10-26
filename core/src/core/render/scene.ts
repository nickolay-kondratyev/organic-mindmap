import type { MindmapConfig } from '../config/config';
import type { MindmapExtensions } from '../extensions';
import { layoutStagesFor } from '../extensions';
import type { NodeColorMap } from '../color/colorStrategy';
import type { Branch } from '../geometry/branchPath';
import { buildBranches } from '../geometry/branchGeometry';
import { runLayoutPipeline } from '../layout/pipeline';
import type { NodePositions } from '../layout/layoutTypes';
import { applyPositionOverrides, NO_POSITION_OVERRIDES, type PositionOverrides } from '../layout/positionOverrides';
import type { MindmapData } from '../model/node';
import { buildTree, type MindmapTree } from '../model/tree';
import { resolveNodeSizes, type NodeSizeMap } from '../size/nodeSizeResolver';

/** Everything the renderer needs, fully resolved from host data + config + extensions. */
export interface Scene {
  readonly tree: MindmapTree;
  readonly sizes: NodeSizeMap;
  readonly positions: NodePositions;
  /** Centres before the push-apart; user offsets are measured from a parent's centre here (see `applyPositionOverrides`). */
  readonly placedPositions: NodePositions;
  readonly colors: NodeColorMap;
  readonly branches: readonly Branch[];
}

/** `overrides` are user-dragged node offsets from their parents (spec I2), applied after the layout pipeline. */
export function buildScene(
  data: MindmapData,
  config: MindmapConfig,
  extensions: MindmapExtensions,
  overrides: PositionOverrides = NO_POSITION_OVERRIDES,
): Scene {
  const tree = buildTree(data, config.layout.sideOrder);
  const sizes = resolveNodeSizes(tree, config.node);
  const laidOut = runLayoutPipeline(
    { tree, sizes, config: config.layout, bowCurve: extensions.bowCurve },
    layoutStagesFor(extensions, config.layout),
  );
  const { placed: placedPositions, positions } = applyPositionOverrides(laidOut, {
    tree,
    sizes,
    padding: config.layout.collisionPadding,
    overrides,
  });
  const colors = extensions.colorStrategy.resolve(tree, config.theme);
  const branches = buildBranches({ tree, positions, sizes, config: config.branch });
  return { tree, sizes, positions, placedPositions, colors, branches };
}
