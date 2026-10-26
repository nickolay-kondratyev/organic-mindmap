import type { NodeId, Point } from '../model/node';
import type { MindmapTree } from '../model/tree';
import type { NodeSizeMap } from '../size/nodeSizeResolver';
import type { LayoutConfig } from './layoutConfig';
import type { BowCurve } from './bowCurve';

export type NodePositions = ReadonlyMap<NodeId, Point>;

/** Everything a stage may read. Stages must not mutate it (spec L7: pure data in -> positioned data out). */
export interface LayoutContext {
  readonly tree: MindmapTree;
  readonly sizes: NodeSizeMap;
  readonly config: LayoutConfig;
  readonly bowCurve: BowCurve;
}

/**
 * One step of the layout pipeline (spec L5). The first stage usually creates positions from an empty map;
 * later stages transform them. Returning a new map keeps stages pure and testable in isolation.
 */
export interface LayoutStage {
  readonly name: string;
  run(positions: NodePositions, context: LayoutContext): NodePositions;
}
