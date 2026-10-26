import type { MindmapData, ModifierKeys, NodeClickEvent } from 'organic-mindmap';

/** Held modifier keys in the order keyboards usually name them. */
const MODIFIER_NAMES: readonly (readonly [keyof ModifierKeys, string])[] = [
  ['ctrlKey', 'Ctrl'],
  ['metaKey', 'Cmd'],
  ['altKey', 'Alt'],
  ['shiftKey', 'Shift'],
];

/** Runner readout of the last node click, e.g. "Hamlet (Ctrl+Shift)", so the click hook can be seen working. */
export function describeNodeClick(event: NodeClickEvent, data: MindmapData): string {
  const label = data.find((node) => node.id === event.nodeId)?.text ?? event.nodeId;
  const held = MODIFIER_NAMES.filter(([key]) => event[key]).map(([, name]) => name);
  return held.length === 0 ? label : `${label} (${held.join('+')})`;
}
