import type { MindmapData, MindmapNode } from '../src/core/model/node';

/** Fan-out of a vault-like tree: a folder of ~8 entries, each heading with ~8 sub-headings. */
export const VAULT_LIKE_FAN_OUT = 8;

/**
 * A deterministic breadth-first tree of exactly `nodeCount` nodes with `fanOut` children per node (last level
 * partial), so benchmarks, tests and the demo's big map size a map by node count alone. Labels vary in length like real headings.
 */
export function syntheticTree(nodeCount: number, fanOut = VAULT_LIKE_FAN_OUT): MindmapData {
  if (nodeCount < 1) throw new Error(`nodeCount=[${nodeCount}] must be at least 1`);
  const nodes: MindmapNode[] = [{ id: 'n0', parentId: null, text: 'Root' }];
  for (let i = 1; i < nodeCount; i += 1) {
    const parentIndex = Math.floor((i - 1) / fanOut);
    nodes.push({ id: `n${i}`, parentId: `n${parentIndex}`, text: `Heading ${i}${' detail'.repeat(i % 3)}` });
  }
  return nodes;
}
