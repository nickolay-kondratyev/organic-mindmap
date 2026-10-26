import type { ColorStrategy } from './color/colorStrategy';
import { parentDerivedColorStrategy } from './color/colorStrategy';
import type { LayoutStage } from './layout/layoutTypes';
import type { BowCurve } from './layout/bowCurve';
import { goldenRatioBowCurve } from './layout/bowCurve';
import type { NodeShape } from './shape/nodeShape';
import { ellipseShape } from './shape/nodeShape';
import type { LayoutConfig } from './layout/layoutConfig';
import { defaultLayoutStages } from './layout/pipeline';

/**
 * Code-level extension points (spec L5), composed in by the host. Kept apart from `MindmapConfig` so
 * config stays plain data (serializable, settings-panel friendly) while these hold functions.
 */
export interface MindmapExtensions {
  /** Ordered layout stages; `null` means "use the defaults for the configured layout type". */
  readonly layoutStages: readonly LayoutStage[] | null;
  readonly bowCurve: BowCurve;
  readonly nodeShape: NodeShape;
  readonly colorStrategy: ColorStrategy;
}

export const DEFAULT_EXTENSIONS: MindmapExtensions = {
  layoutStages: null,
  bowCurve: goldenRatioBowCurve,
  nodeShape: ellipseShape,
  colorStrategy: parentDerivedColorStrategy,
};

export function resolveExtensions(partial: Partial<MindmapExtensions> | undefined): MindmapExtensions {
  return { ...DEFAULT_EXTENSIONS, ...partial };
}

export function layoutStagesFor(extensions: MindmapExtensions, layout: LayoutConfig): readonly LayoutStage[] {
  return extensions.layoutStages ?? defaultLayoutStages(layout);
}
