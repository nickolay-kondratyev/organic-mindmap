import type { InteractionConfig } from '../config/config';
import type { NodeId } from '../model/node';
import { nodeHandles, type HitScene, type NodeHandle } from './hitTest';

/** What decides whether the hovered node's buttons show. */
export interface HandleVisibility {
  readonly hoveredNodeId: NodeId | null;
  /** A drag (or a drop waiting for the user's answer) or a pending edit: further edits are blocked (spec I5.2). */
  readonly busy: boolean;
  readonly interaction: InteractionConfig;
}

/** Hover buttons to show (and hit-test) now; a button whose edit is switched off in config never shows. */
export function shownHandles(scene: HitScene, state: HandleVisibility): readonly NodeHandle[] {
  if (state.hoveredNodeId === null || state.busy) return [];
  return nodeHandles(scene, state.hoveredNodeId).filter((handle) => handleAllowed(handle, state.interaction));
}

/** Whether the map may open its inline editor for this edit; move (drag onto a node) is never switched off. */
export function editorAllowed(interaction: InteractionConfig, edit: 'add' | 'rename'): boolean {
  switch (edit) {
    case 'add':
      return interaction.allowAdd;
    case 'rename':
      return interaction.allowRename;
  }
}

function handleAllowed(handle: NodeHandle, interaction: InteractionConfig): boolean {
  switch (handle.kind) {
    case 'add-child':
      return editorAllowed(interaction, 'add');
  }
}
