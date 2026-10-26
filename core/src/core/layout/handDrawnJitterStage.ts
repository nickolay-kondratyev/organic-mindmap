import type { NodeId, Point } from '../model/node';
import type { LayoutContext, LayoutStage, NodePositions } from './layoutTypes';

/** Distinct salts so a node's x and y offsets are independent rather than always equal. */
const X_AXIS_SALT = '#x';
const Y_AXIS_SALT = '#y';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const UINT32_RANGE = 2 ** 32;

/**
 * Stage 3 (spec R22): small hand-drawn irregularity. Each non-root node gets an offset in
 * [-jitterAmplitude, +jitterAmplitude] per axis, derived only from its id, so the same data always yields
 * the same picture and an edit elsewhere never makes a node "twitch". The root never moves.
 *
 * WHY-NOT `Math.random`: non-deterministic across renders. WHY-NOT a seeded sequential PRNG over the node list:
 * inserting one node would shift every later node's offset.
 */
export const handDrawnJitterStage: LayoutStage = {
  name: 'hand-drawn-jitter',
  run(positions: NodePositions, context: LayoutContext): NodePositions {
    const amplitude = context.config.jitterAmplitude;
    const result = new Map<NodeId, Point>();
    for (const [id, point] of positions) {
      if (id === context.tree.root.id || amplitude === 0) {
        result.set(id, point);
        continue;
      }
      result.set(id, {
        x: point.x + signedUnit(hashString(`${id}${X_AXIS_SALT}`)) * amplitude,
        y: point.y + signedUnit(hashString(`${id}${Y_AXIS_SALT}`)) * amplitude,
      });
    }
    return result;
  },
};

/** 32-bit FNV-1a: tiny, fast, well-spread for short strings such as ids. */
function hashString(value: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** Maps an unsigned 32-bit hash to [-1, 1). */
function signedUnit(hash: number): number {
  return (hash / UINT32_RANGE) * 2 - 1;
}
