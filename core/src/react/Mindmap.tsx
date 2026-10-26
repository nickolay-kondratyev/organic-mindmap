import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties } from 'react';
import {
  DEFAULT_EDIT_HANDLER,
  mountMindmap,
  type EditHandler,
  type EditStatus,
  type FontFetcher,
  type LabelFontStatus,
  type MindmapData,
  type MindmapConfig,
  type MindmapExtensions,
  type MindmapHandle,
  type MindmapView,
  type NodeClickEvent,
  type NodeContextMenuEvent,
  type NodeOffsets,
  type NodeRepositionEvent,
  type PartialMindmapConfig,
} from '../core/index';

export interface MindmapProps {
  readonly data: MindmapData;
  readonly config?: PartialMindmapConfig;
  readonly extensions?: Partial<MindmapExtensions>;
  /** Read once at mount (see `MountOptions.fontFetcher`). */
  readonly fontFetcher?: FontFetcher;
  /** Font loading status (spec L6), e.g. to show a loading state. */
  readonly onFontStatusChange?: (status: LabelFontStatus) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
  /** Host side of the edit protocol (spec I5); defaults to the in-memory host that confirms immediately (I6). */
  readonly onEditRequest?: EditHandler;
  readonly onEditStatusChange?: (status: EditStatus) => void;
  /** Pan/zoom by the user or the library (incl. the initial fit-to-content); not fired for `ref.setView`. */
  readonly onViewChange?: (view: MindmapView) => void;
  readonly onNodeReposition?: (event: NodeRepositionEvent) => void;
  /**
   * Saved node positions (see `MountOptions.nodeOffsets`). A new object replaces the map's positions; leaving it
   * `undefined` keeps whatever the user dragged.
   */
  readonly nodeOffsets?: NodeOffsets;
  /** Every user-placed node after each user change (see `MountOptions.onNodeOffsetsChange`); save it as-is. */
  readonly onNodeOffsetsChange?: (offsets: NodeOffsets) => void;
  /** A click on a node with its modifier keys (see `MountOptions.onNodeClick`); a double-click fires twice. */
  readonly onNodeClick?: (event: NodeClickEvent) => void;
  /**
   * A right-click on a node (see `MountOptions.onNodeContextMenu`). Whether it is set is read once at mount (it decides
   * if nodes suppress the browser's menu); later renders only swap which function is called.
   */
  readonly onNodeContextMenu?: (event: NodeContextMenuEvent) => void;
  /** A setting the user changed inside the map (see `MountOptions.onConfigChange`); store it and pass it back as `config`. */
  readonly onConfigChange?: (config: MindmapConfig) => void;
}

/** Imperative API exposed through `ref`: zoom/reset buttons, reading/setting the view, highlight and centering, sending edits. */
export type MindmapApi = Pick<
  MindmapHandle,
  | 'requestEdit'
  | 'getEditStatus'
  | 'clearEditRejection'
  | 'getData'
  | 'getNodeScreenBox'
  | 'getView'
  | 'setView'
  | 'setHighlightedNode'
  | 'centerOnNode'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetView'
>;

type CallbackProp =
  | 'onEditRequest'
  | 'onEditStatusChange'
  | 'onViewChange'
  | 'onNodeReposition'
  | 'onNodeOffsetsChange'
  | 'onNodeClick'
  | 'onNodeContextMenu'
  | 'onFontStatusChange'
  | 'onConfigChange';
/** Every callback key present (possibly `undefined`), so the latest props can be copied in one assignment. */
type MindmapCallbacks = { readonly [K in CallbackProp]: MindmapProps[K] };

const FILL_PARENT: CSSProperties = { display: 'block', width: '100%', height: '100%' };

/**
 * Thin React binding (spec L1): mounts the core onto a canvas, forwards prop changes, and keeps the
 * canvas backing store in sync with its CSS size and device pixel ratio.
 */
export const Mindmap = forwardRef<MindmapApi, MindmapProps>(function Mindmap(
  {
    data,
    config,
    extensions,
    fontFetcher,
    className,
    style,
    onEditRequest,
    onEditStatusChange,
    onViewChange,
    nodeOffsets,
    onNodeReposition,
    onNodeOffsetsChange,
    onNodeClick,
    onNodeContextMenu,
    onFontStatusChange,
    onConfigChange,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<MindmapHandle | null>(null);
  // The core is mounted once, so it reads callbacks through this ref to always call the latest props.
  const callbacks: MindmapCallbacks = {
    onEditRequest,
    onEditStatusChange,
    onViewChange,
    onNodeReposition,
    onNodeOffsetsChange,
    onNodeClick,
    onNodeContextMenu,
    onFontStatusChange,
    onConfigChange,
  };
  const callbacksRef = useRef(callbacks);
  useLayoutEffect(() => {
    callbacksRef.current = callbacks;
  });
  // A layout effect declared before `useImperativeHandle`: React runs both in declaration order in the same commit,
  // so the ref is attached only once the core is mounted. WHY-NOT a passive `useEffect`: it runs after the ref is
  // attached (after paint), leaving a window where the ref exists but every call throws "not mounted".
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const handle = mountMindmap(canvas, {
      data,
      config: config ?? {},
      extensions: extensions ?? {},
      ...(fontFetcher === undefined ? {} : { fontFetcher }),
      ...(nodeOffsets === undefined ? {} : { nodeOffsets }),
      onEditRequest: (request, currentData) => (callbacksRef.current.onEditRequest ?? DEFAULT_EDIT_HANDLER)(request, currentData),
      onEditStatusChange: (status) => callbacksRef.current.onEditStatusChange?.(status),
      onViewChange: (view) => callbacksRef.current.onViewChange?.(view),
      onNodeReposition: (event) => callbacksRef.current.onNodeReposition?.(event),
      onNodeOffsetsChange: (offsets) => callbacksRef.current.onNodeOffsetsChange?.(offsets),
      onNodeClick: (event) => callbacksRef.current.onNodeClick?.(event),
      ...(onNodeContextMenu === undefined
        ? {}
        : { onNodeContextMenu: (event: NodeContextMenuEvent) => callbacksRef.current.onNodeContextMenu?.(event) }),
      onFontStatusChange: (status) => callbacksRef.current.onFontStatusChange?.(status),
      onConfigChange: (next) => callbacksRef.current.onConfigChange?.(next),
    });
    handleRef.current = handle;
    const syncSize = () => handle.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      handle.destroy();
      handleRef.current = null;
    };
    // Mount once; prop updates are forwarded by the effects below so the canvas is not torn down per change.
  }, []);
  useImperativeHandle(ref, () => apiDelegatingTo(handleRef), []);

  useEffect(() => {
    handleRef.current?.setData(data);
  }, [data]);
  useEffect(() => {
    handleRef.current?.setConfig(config);
  }, [config]);
  useEffect(() => {
    handleRef.current?.setExtensions(extensions);
  }, [extensions]);
  useEffect(() => {
    if (nodeOffsets !== undefined) handleRef.current?.setNodeOffsets(nodeOffsets);
  }, [nodeOffsets]);

  return <canvas ref={canvasRef} className={className} style={{ ...FILL_PARENT, ...style }} data-testid="mindmap-canvas" />;
});

/** Delegates at call time because the core handle only exists between mount and unmount. */
function apiDelegatingTo(handleRef: { readonly current: MindmapHandle | null }): MindmapApi {
  const handle = (): MindmapHandle => {
    if (handleRef.current === null) throw new Error('The mindmap is not mounted yet (or was unmounted).');
    return handleRef.current;
  };
  return {
    requestEdit: (request) => handle().requestEdit(request),
    getEditStatus: () => handle().getEditStatus(),
    clearEditRejection: () => handle().clearEditRejection(),
    getData: () => handle().getData(),
    getNodeScreenBox: (nodeId) => handle().getNodeScreenBox(nodeId),
    getView: () => handle().getView(),
    setView: (view) => handle().setView(view),
    setHighlightedNode: (nodeId) => handle().setHighlightedNode(nodeId),
    centerOnNode: (nodeId) => handle().centerOnNode(nodeId),
    zoomIn: () => handle().zoomIn(),
    zoomOut: () => handle().zoomOut(),
    resetView: () => handle().resetView(),
  };
}
