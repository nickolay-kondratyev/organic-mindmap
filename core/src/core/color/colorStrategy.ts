import type { PaletteColor, ThemeConfig } from '../config/theme';
import type { NodeId } from '../model/node';
import type { MindmapTree } from '../model/tree';

export type NodeColor = PaletteColor;
export type NodeColorMap = ReadonlyMap<NodeId, NodeColor>;

/**
 * Color seam (spec R10/R11): decides every node's fill/outline. The default derives from the first-level
 * ancestor; future strategies (e.g. visitation-history blending) implement the same interface.
 */
export interface ColorStrategy {
  resolve(tree: MindmapTree, theme: ThemeConfig): NodeColorMap;
}

/** First-level node picks `colorIndex` (or its sibling position) from the palette; descendants inherit it. */
export const parentDerivedColorStrategy: ColorStrategy = {
  resolve(tree, theme) {
    const { palette, root } = theme.color;
    const colors = new Map<NodeId, NodeColor>();
    colors.set(tree.root.id, { fill: root.fill, outline: root.outline });
    tree.childrenOf(tree.root.id).forEach((firstLevel, index) => {
      const paletteIndex = (firstLevel.colorIndex ?? index) % palette.length;
      const color = palette[paletteIndex] as PaletteColor;
      assignSubtree(tree, firstLevel.id, color, colors);
    });
    return colors;
  },
};

function assignSubtree(tree: MindmapTree, id: NodeId, color: NodeColor, out: Map<NodeId, NodeColor>): void {
  out.set(id, color);
  for (const child of tree.childrenOf(id)) assignSubtree(tree, child.id, color, out);
}
