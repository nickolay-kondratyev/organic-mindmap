import { nextSettingsPanelState } from './settingsPanelDisclosure';

describe('GIVEN the settings panel is closed', () => {
  const open = false;

  it('WHEN the gear is clicked THEN the panel opens and focus stays where it is', () => {
    expect(nextSettingsPanelState(open, { kind: 'gearClick' })).toEqual({ open: true, focusGear: false });
  });

  it('WHEN Escape is pressed THEN the panel leaves the key alone', () => {
    expect(nextSettingsPanelState(open, { kind: 'escape' })).toBeNull();
  });

  it('WHEN the map is clicked THEN the panel leaves the click alone', () => {
    expect(nextSettingsPanelState(open, { kind: 'pointerDown', insideWidget: false })).toBeNull();
  });
});

describe('GIVEN the settings panel is open', () => {
  const open = true;

  it('WHEN the gear is clicked again THEN the panel closes and focus returns to the gear', () => {
    expect(nextSettingsPanelState(open, { kind: 'gearClick' })).toEqual({ open: false, focusGear: true });
  });

  it('WHEN Escape is pressed THEN the panel closes and focus returns to the gear', () => {
    expect(nextSettingsPanelState(open, { kind: 'escape' })).toEqual({ open: false, focusGear: true });
  });

  it('WHEN the map outside the panel is clicked THEN the panel closes and focus stays with the click', () => {
    expect(nextSettingsPanelState(open, { kind: 'pointerDown', insideWidget: false })).toEqual({ open: false, focusGear: false });
  });

  it('WHEN a control inside the panel is clicked THEN the panel stays open', () => {
    expect(nextSettingsPanelState(open, { kind: 'pointerDown', insideWidget: true })).toBeNull();
  });
});
