import { setIcon, setTooltip } from 'obsidian';
import { addLookSettingRows } from '../settings/lookSettingRows';
import type { MapSettings } from '../settings/mapSettings';
import { MAP_SETTINGS_LABEL, nextSettingsPanelState, type SettingsPanelEvent } from './settingsPanelDisclosure';

const GEAR_ICON = 'settings';
const SCOPE_HINT = 'Applies to every map.';
const RESET_ROW_SELECTOR = '.organic-mindmap-reset-look button';

/** Unique per panel so `aria-controls` points at this view's panel when several maps are open. */
let nextPanelNumber = 0;

/**
 * The gear in a map's top-right corner and the look panel it opens over the map (ticket nid_g8wymric04axnhd7lcoox7tkl_e):
 * the settings tab's rows (`addLookSettingRows`), so a person sees each change on the map while making it.
 * The rows are rebuilt on every open, so they always show the shared `MapSettings` values (the tab may have changed
 * them meanwhile). Open/close rules live in `nextSettingsPanelState` (unit-tested).
 * WHY-NOT a view header action + `Modal`: a modal dims and covers the map, hiding the change being made.
 * WHY no re-render while open on `MapSettings.onChange`: it would replace the control the person is using (and close
 * a native color picker mid-drag); this panel is the only writer while it is open and focused.
 */
export class MapSettingsPanel {
  private readonly widget: HTMLDivElement;
  private readonly gear: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private readonly rows: HTMLDivElement;
  private open = false;
  private readonly onDocumentPointerDown = (event: PointerEvent): void => {
    const insideWidget = event.target instanceof Node && this.widget.contains(event.target);
    this.handle({ kind: 'pointerDown', insideWidget });
  };

  constructor(
    hostEl: HTMLElement,
    private readonly settings: MapSettings,
  ) {
    const panelId = `organic-mindmap-settings-panel-${++nextPanelNumber}`;
    // Before the canvas: positioned, so still painted above it, but below the library's overlays (inline editor,
    // notice, reparent dialog), which go right after the canvas. WHY: a rename or notice must never hide under the gear.
    this.widget = hostEl.createDiv({ cls: 'organic-mindmap-settings-widget', prepend: true });
    this.gear = this.widget.createEl('button', {
      cls: ['clickable-icon', 'organic-mindmap-settings-gear'],
      attr: { 'aria-label': MAP_SETTINGS_LABEL, 'aria-expanded': 'false', 'aria-controls': panelId },
    });
    setIcon(this.gear, GEAR_ICON);
    setTooltip(this.gear, MAP_SETTINGS_LABEL, { placement: 'left' });
    this.panel = this.widget.createDiv({
      cls: 'organic-mindmap-settings-panel',
      attr: { id: panelId, role: 'dialog', 'aria-label': MAP_SETTINGS_LABEL, tabindex: '-1' },
    });
    this.panel.hidden = true;
    const header = this.panel.createDiv({ cls: 'organic-mindmap-settings-panel-header' });
    header.createDiv({ cls: 'organic-mindmap-settings-panel-title', text: MAP_SETTINGS_LABEL });
    header.createDiv({ cls: 'organic-mindmap-settings-panel-hint', text: SCOPE_HINT });
    this.rows = this.panel.createDiv({ cls: 'organic-mindmap-settings-panel-rows' });
    this.gear.addEventListener('click', () => this.handle({ kind: 'gearClick' }));
    this.widget.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.handle({ kind: 'escape' })) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  }

  /** Removes the gear and panel and stops listening outside them. */
  destroy(): void {
    this.setOpen(false);
    this.widget.remove();
  }

  /** Applies the panel's rule for `event`; `true` when the panel acted on it. */
  private handle(event: SettingsPanelEvent): boolean {
    const change = nextSettingsPanelState(this.open, event);
    if (change === null) return false;
    this.setOpen(change.open);
    if (change.focusGear) this.gear.focus();
    return true;
  }

  private setOpen(open: boolean): void {
    if (open === this.open) return;
    this.open = open;
    this.gear.setAttribute('aria-expanded', String(open));
    this.gear.toggleClass('is-active', open);
    this.panel.hidden = !open;
    // Capture: the map's own pointer handling must not hide the click from the panel.
    if (open) {
      this.renderRows();
      this.widget.doc.addEventListener('pointerdown', this.onDocumentPointerDown, true);
    } else {
      this.widget.doc.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    }
  }

  private renderRows(): void {
    this.rows.empty();
    addLookSettingRows(this.rows, this.settings, () => {
      this.renderRows();
      // The clicked reset button was just replaced: keep keyboard focus (and Escape) inside the panel.
      this.rows.querySelector<HTMLButtonElement>(RESET_ROW_SELECTOR)?.focus();
    });
  }
}
