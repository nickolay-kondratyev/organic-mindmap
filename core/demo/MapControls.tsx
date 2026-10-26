import type { MindmapApi } from 'natural-mindmap/react';
import { PanelSection } from './PanelSection';

/** Size of the "big map" button's map: what `npm run bench` calls a long note, to feel how it pans, zooms and edits. */
export const LARGE_MAP_NODE_COUNT = 200;

interface MapControlsProps {
  readonly api: () => MindmapApi | null;
  readonly onResetMap: () => void;
  /** Shows a synthetic map of `LARGE_MAP_NODE_COUNT` nodes. */
  readonly onLoadLargeMap: () => void;
  /** Readout of the last node click (`onNodeClick`), `null` before the first. */
  readonly lastNodeClick: string | null;
}

/** View buttons (spec I1, via the public `MindmapApi`), "Reset map" (D6), a big map to check performance, how to edit on the canvas (D4), the last node click. */
export function MapControls({ api, onResetMap, onLoadLargeMap, lastNodeClick }: MapControlsProps) {
  return (
    <PanelSection title="Map">
      <ul className="hint-list">
        <li>Click a node to highlight it; the host is told which node and which keys were held.</li>
        <li>Hover a node, then click its <kbd>+</kbd> to add a child.</li>
        <li>Double-click a node to rename it.</li>
        <li>Drag a node onto another node to make it a child there (you are asked first); drop it on empty space to just reposition it.</li>
        <li>Drag the background to pan, scroll to zoom.</li>
      </ul>
      <div className="button-row">
        <button type="button" className="button" onClick={() => api()?.zoomOut()} aria-label="Zoom out">−</button>
        <button type="button" className="button" onClick={() => api()?.zoomIn()} aria-label="Zoom in">+</button>
        <button type="button" className="button" onClick={() => api()?.resetView()}>Fit to screen</button>
        <button type="button" className="button button--push-right" onClick={onResetMap} title="Back to the Shakespeare example; your edits and dragged positions are discarded.">
          Reset map
        </button>
      </div>
      <div className="button-row">
        <button type="button" className="button" onClick={onLoadLargeMap} title="A generated map to check performance; your edits and dragged positions are discarded.">
          Load {LARGE_MAP_NODE_COUNT}-node map
        </button>
      </div>
      <p className="node-click" role="status" data-testid="node-click">
        {lastNodeClick === null ? 'No node clicked yet.' : `Last clicked: ${lastNodeClick}`}
      </p>
    </PanelSection>
  );
}
