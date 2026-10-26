import { useCallback, useRef, useState } from 'react';
import { SettingsPersistence, type LabelFontStatus, type NodeClickEvent } from 'organic-mindmap';
import { Mindmap, type MindmapApi } from 'organic-mindmap/react';
import { FontStatusBadge } from './FontStatusBadge';
import { HostSimulationControls } from './host/HostSimulationControls';
import { useDemoHost } from './host/demoHost';
import { describeNodeClick } from './host/nodeClickReadout';
// WHY test-support: the same generator as `npm run bench`, so the demo's big map is the benched map.
import { syntheticTree } from '../test-support/syntheticTree';
import { LARGE_MAP_NODE_COUNT, MapControls } from './MapControls';
import { headingMapData } from './markdown/headingMap';
import { PasteMarkdownControls } from './markdown/PasteMarkdownControls';
import { LocalStorageSettings } from './settings/localStorageSettings';
import { SettingsPanel } from './settings/SettingsPanel';
import { usePersistedConfig } from './settings/usePersistedConfig';
import { exposeMindmapApi } from './testHooks';

/** Settings survive page reloads, the way a real host (e.g. Obsidian plugin data) would keep them. */
const SETTINGS_PERSISTENCE = new SettingsPersistence(new LocalStorageSettings(window.localStorage));

/** Demo runner (spec §6a). Talks to the library only through its public entry points (D1). */
export function App() {
  const host = useDemoHost();
  const { config, updateConfig } = usePersistedConfig(SETTINGS_PERSISTENCE);
  const [fontStatus, setFontStatus] = useState<LabelFontStatus | null>(null);
  const [lastNodeClick, setLastNodeClick] = useState<NodeClickEvent | null>(null);
  const apiRef = useRef<MindmapApi | null>(null);
  const attachApi = useCallback((api: MindmapApi | null) => {
    apiRef.current = api;
    exposeMindmapApi(api);
  }, []);

  // Stored settings load within a tick from localStorage; rendering nothing until then avoids a flash of defaults.
  if (config === null) return null;
  return (
    <div className="runner">
      <main className="runner__canvas">
        <Mindmap
          key={host.mapKey}
          ref={attachApi}
          data={host.data}
          config={config}
          onFontStatusChange={setFontStatus}
          onEditRequest={host.onEditRequest}
          onEditStatusChange={host.onEditStatusChange}
          onConfigChange={(next) => updateConfig(() => next)}
          onNodeClick={(event) => {
            setLastNodeClick(event);
            apiRef.current?.setHighlightedNode(event.nodeId);
          }}
        />
        <FontStatusBadge status={fontStatus} />
      </main>
      <aside className="runner__panel" aria-label="Demo controls">
        <header className="runner__header">
          <h1>Organic Mindmap</h1>
          <p>Demo runner</p>
        </header>
        <MapControls
          api={() => apiRef.current}
          onResetMap={host.resetMap}
          onLoadLargeMap={() => host.replaceMap(syntheticTree(LARGE_MAP_NODE_COUNT))}
          lastNodeClick={lastNodeClick === null ? null : describeNodeClick(lastNodeClick, host.data)}
        />
        <PasteMarkdownControls onShowHeadings={(markdown) => host.replaceMap(headingMapData(markdown))} />
        <HostSimulationControls settings={host.simulation} onChange={host.setSimulation} editStatus={host.editStatus} />
        <SettingsPanel config={config} onChange={updateConfig} />
      </aside>
    </div>
  );
}
