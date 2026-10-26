// Public framework-free API. Everything a host (or the React wrapper) needs; nothing else is public.
export type { MindmapData, MindmapNode, NodeId, NodeSize, Point, Side } from './model/node';
export { buildTree, DEFAULT_SIDE_ORDER, InvalidMindmapDataError, isSideOrder, SIDE_ORDERS, type MindmapTree, type SideOrder } from './model/tree';
export { REFERENCE_DATA } from './model/referenceData';

export {
  DEFAULT_CONFIG,
  resolveConfig,
  type BranchConfig,
  type BranchTextFitConfig,
  type NodeTextFitConfig,
  type DeepPartial,
  type FontConfig,
  type InteractionConfig,
  type MindmapConfig,
  type NodeSizeConfig,
  type PartialMindmapConfig,
  type TextConfig,
} from './config/config';
export { restoreConfig } from './config/restoreConfig';
export { SettingsPersistence, type SettingsStorage } from './config/settingsPersistence';
export { DEFAULT_THEME, type PaletteColor, type RootColor, type ThemeColorConfig, type ThemeConfig } from './config/theme';

export { DEFAULT_EXTENSIONS, resolveExtensions, type MindmapExtensions } from './extensions';

export { DEFAULT_LAYOUT_CONFIG, isLayoutType, LAYOUT_TYPES, type BilateralLayoutConfig, type LayoutConfig } from './layout/layoutConfig';
export type { LayoutContext, LayoutStage, NodePositions } from './layout/layoutTypes';
export { goldenRatioBowCurve, type BowCurve } from './layout/bowCurve';
export { defaultLayoutStages, runLayoutPipeline } from './layout/pipeline';
export { tidyTreeStage } from './layout/tidyTreeStage';
export { rootBowStage } from './layout/rootBowStage';
export { handDrawnJitterStage } from './layout/handDrawnJitterStage';
export { collisionStage, resolveCollisions, type CollisionInput } from './layout/collisionStage';
export { layoutMindmap, type LayoutMindmapOptions } from './layout/layoutMindmap';

export { resolveNodeSizes, defaultSizeAtDepth, type NodeSizeMap } from './size/nodeSizeResolver';
export { StraightPath, type Branch, type BranchPath, type BranchWidth, type PathSample } from './geometry/branchPath';
export { CubicBezierPath, type CubicControlPoints } from './geometry/cubicBezierPath';
export { buildBranches, widthAtDepth, type BranchGeometryInput } from './geometry/branchGeometry';
export { taperedOutline, type BranchOutline } from './geometry/taperedOutline';
export { ellipseShape, type NodeBox, type NodeFillStyle, type NodeShape } from './shape/nodeShape';
export { parentDerivedColorStrategy, type ColorStrategy, type NodeColor, type NodeColorMap } from './color/colorStrategy';

export { buildScene, type Scene } from './render/scene';
export { drawScene, type Viewport } from './render/canvasRenderer';
export { RepaintScheduler, windowFrameScheduler, type FrameScheduler } from './render/repaintScheduler';
export { fetchFontBytes, FontFetchError, type FontFetcher, type FontStatus } from './text/fontStore';
export type { LabelFontStatus } from './text/labelFontLoader';
export { mountMindmap, type MindmapHandle, type MountOptions } from './mount';

export type { AddEditRequest, DeleteEditRequest, EditHandler, EditRequest, MoveEditRequest, RenameEditRequest } from './edit/editRequest';
export { applyEdit } from './edit/applyEdit';
export { EDIT_PROBLEM, findEditProblem } from './edit/editValidation';
export {
  DEFAULT_REJECTION_REASON,
  EDIT_BLOCKED_REASON,
  PENDING_NODE_ID,
  type EditPreview,
  type EditStatus,
  type EditSubmitResult,
} from './edit/editSession';
export { CONFIRM_IMMEDIATELY, DEFAULT_EDIT_HANDLER, InMemoryHost, type HostSimulation } from './edit/inMemoryHost';
export type { NodeRepositionEvent } from './interaction/repositionEvent';
export type { NodeOffset, NodeOffsets } from './layout/positionOverrides';
export type { ModifierKeys, NodeClickEvent } from './interaction/nodeClickEvent';
export { HANDLE_GAP, HANDLE_RADIUS } from './interaction/hitTest';
export { LABEL_EDITOR_ACCESSIBLE_NAME } from './interaction/inlineLabelEditor';
export { REPARENT_DIALOG_LABELS } from './interaction/reparentDialog';
export { DEFAULT_VIEW, MAX_ZOOM, MIN_ZOOM, type MindmapView } from './view/viewController';
