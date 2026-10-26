import { around } from 'monkey-around';

/** The one method the routing wraps, as `WorkspaceLeaf.prototype` has it. */
export interface SetViewStateHost<ViewState> {
  setViewState(viewState: ViewState, eState?: unknown): Promise<void>;
}

/** Rewrites the view state a leaf was asked to show (same object when nothing changes). */
export type ViewStateRouter<Leaf, ViewState> = (leaf: Leaf, viewState: ViewState) => Promise<ViewState>;

/**
 * Wraps `prototype.setViewState` so every call goes through `route` first; returns the uninstaller.
 * WHY `monkey-around`: other plugins (Kanban, Excalidraw) wrap the same method. A hand-rolled "restore what we
 * saved" on unload would also strip any wrapper they installed after ours; `around` restores the original only
 * when ours is still the outermost, else leaves ours in place as a pass-through, and the chain survives.
 */
export function routeSetViewState<ViewState, Leaf extends SetViewStateHost<ViewState>>(
  prototype: Leaf,
  route: ViewStateRouter<Leaf, ViewState>,
): () => void {
  return around(prototype as SetViewStateHost<ViewState>, {
    setViewState(next) {
      return async function (this: Leaf, viewState, eState) {
        return next.call(this, await route(this, viewState), eState);
      };
    },
  });
}
