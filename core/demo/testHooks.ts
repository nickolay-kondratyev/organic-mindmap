import type { MindmapApi } from 'organic-mindmap/react';

/** E2E tests find nodes through `window.mindmap.getNodeScreenBox`, since canvas content has no DOM. */
export function exposeMindmapApi(api: MindmapApi | null): void {
  (window as Window & { mindmap?: MindmapApi | null }).mindmap = api;
}
