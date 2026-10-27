/** The gear's tooltip / accessible name and the panel's title. */
export const MAP_SETTINGS_LABEL = 'Map settings';

/** What happened around the map's settings panel. `pointerDown.insideWidget`: on the gear or the panel itself. */
export type SettingsPanelEvent =
  | { readonly kind: 'gearClick' }
  | { readonly kind: 'escape' }
  | { readonly kind: 'pointerDown'; readonly insideWidget: boolean };

/** The panel's next state; `focusGear` hands focus back to the gear (keyboard users keep their place). */
export interface SettingsPanelChange {
  readonly open: boolean;
  readonly focusGear: boolean;
}

/**
 * The open/close rules of the map's settings panel; `null` means the event is not the panel's (leave it alone, e.g. an
 * Escape while closed belongs to whatever else listens). Pure, so the rules are unit-tested without a DOM.
 * WHY no focus on an outside click: the person clicked somewhere on purpose (the map), focus belongs there.
 */
export function nextSettingsPanelState(open: boolean, event: SettingsPanelEvent): SettingsPanelChange | null {
  switch (event.kind) {
    case 'gearClick':
      return { open: !open, focusGear: open };
    case 'escape':
      return open ? { open: false, focusGear: true } : null;
    case 'pointerDown':
      return open && !event.insideWidget ? { open: false, focusGear: false } : null;
  }
}
