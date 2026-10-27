/**
 * Host-owned mindmap data (spec L2): a flat list of nodes. The library never mutates it.
 */
export type NodeId = string;

export type Side = 'left' | 'right';

export interface NodeSize {
  readonly width: number;
  readonly height: number;
}

export interface MindmapNode {
  readonly id: NodeId;
  /** `null` marks the root. Exactly one root is expected. */
  readonly parentId: NodeId | null;
  readonly text: string;
  /** Only meaningful on first-level nodes; deeper nodes inherit their first-level ancestor's side. */
  readonly side?: Side;
  /** Index into `theme.color.palette`; defaults to the first-level node's position among its siblings. */
  readonly colorIndex?: number;
  /** Overrides the depth-based default from the node size resolver (spec R4). */
  readonly size?: NodeSize;
  /**
   * Drawn as a link (underlined, in `theme.color.link`, pointer cursor) so the user can tell the node opens
   * something when clicked. The host decides what a click opens (`onNodeClick`).
   */
  readonly link?: boolean;
}

export type MindmapData = readonly MindmapNode[];

export interface Point {
  readonly x: number;
  readonly y: number;
}
