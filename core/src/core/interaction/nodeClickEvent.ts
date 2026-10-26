import type { NodeId } from '../model/node';

/**
 * Reported when the user clicks a node (press and release without a drag), e.g. so a host can jump to what the
 * node stands for. Modifier keys use the DOM names: `metaKey` is Cmd on macOS, so "Ctrl/Cmd" is `ctrlKey || metaKey`.
 */
export interface NodeClickEvent {
  readonly nodeId: NodeId;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

export type ModifierKeys = Pick<NodeClickEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

/** Copies only the modifiers, so the event is plain data (no live DOM event kept around). */
export function nodeClickEvent(nodeId: NodeId, keys: ModifierKeys): NodeClickEvent {
  return { nodeId, ctrlKey: keys.ctrlKey, metaKey: keys.metaKey, shiftKey: keys.shiftKey, altKey: keys.altKey };
}
