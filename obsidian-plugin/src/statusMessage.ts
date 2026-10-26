import type { MindmapData } from 'organic-mindmap';

/** The "Show plugin status" notice text: proves the plugin version and the bundled library are wired up. */
export function statusMessage(pluginVersion: string, referenceData: MindmapData): string {
  return `Organic Mindmap ${pluginVersion}: library ready (reference map has ${referenceData.length} nodes)`;
}
