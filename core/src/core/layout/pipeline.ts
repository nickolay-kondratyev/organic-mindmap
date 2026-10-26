import type { LayoutConfig } from './layoutConfig';
import type { LayoutContext, LayoutStage, NodePositions } from './layoutTypes';
import { tidyTreeStage } from './tidyTreeStage';
import { rootBowStage } from './rootBowStage';
import { handDrawnJitterStage } from './handDrawnJitterStage';
import { collisionStage } from './collisionStage';

/**
 * Default stage list per layout `type` (spec L5 order: tree -> root-branch bow -> hand-drawn variation ->
 * collision). Hosts reorder/remove/add by passing their own list, e.g. built from this one.
 * Exhaustive: a new `LayoutConfig` variant must be handled here.
 */
export function defaultLayoutStages(config: LayoutConfig): readonly LayoutStage[] {
  switch (config.type) {
    case 'bilateral':
      return [tidyTreeStage, rootBowStage, handDrawnJitterStage, collisionStage];
    default:
      return assertNever(config.type);
  }
}

/** Pure layout entry point (spec L7): runs the stages in order, starting from an empty position map. */
export function runLayoutPipeline(context: LayoutContext, stages: readonly LayoutStage[]): NodePositions {
  return stages.reduce<NodePositions>((positions, stage) => stage.run(positions, context), new Map());
}

function assertNever(value: never): never {
  throw new Error(`Unhandled layout type [${String(value)}]`);
}
