import { DEFAULT_THEME } from 'organic-mindmap';
import { MIN_WHITE_TEXT_CONTRAST, PALETTE_PRESETS, palettePreset, presetIdForPalette, whiteTextContrast } from './palettePresets';

describe('palette presets', () => {
  it("GIVEN the library's default palette THEN it shows as the default preset", () => {
    expect(presetIdForPalette(DEFAULT_THEME.color.palette)).toBe('warm');
  });

  it('GIVEN every preset THEN its palette maps back to its id (dropdown round trip)', () => {
    expect(PALETTE_PRESETS.map((preset) => presetIdForPalette(preset.palette))).toEqual(PALETTE_PRESETS.map((preset) => preset.id));
  });

  it('GIVEN a palette matching no preset THEN it maps to none (shown as custom)', () => {
    const custom = DEFAULT_THEME.color.palette.map((color, index) => (index === 0 ? { ...color, fill: '#123456' } : color));
    expect(presetIdForPalette(custom)).toBeNull();
  });

  it("GIVEN every preset THEN it has the default palette's length (else the library would not restore it)", () => {
    for (const preset of PALETTE_PRESETS) {
      expect(preset.palette, preset.id).toHaveLength(DEFAULT_THEME.color.palette.length);
    }
  });

  it('GIVEN every preset fill THEN white label text clears the legibility bar', () => {
    for (const preset of PALETTE_PRESETS) {
      for (const color of preset.palette) {
        expect(whiteTextContrast(color.fill), `${preset.id} ${color.fill}`).toBeGreaterThanOrEqual(MIN_WHITE_TEXT_CONTRAST);
      }
    }
  });

  it('GIVEN every preset entry THEN its outline is darker than its fill', () => {
    for (const preset of PALETTE_PRESETS) {
      for (const color of preset.palette) {
        expect(whiteTextContrast(color.outline), `${preset.id} ${color.fill}`).toBeGreaterThan(whiteTextContrast(color.fill));
      }
    }
  });

  it('GIVEN the vivid preset THEN its first fill is the preset red', () => {
    expect(palettePreset('vivid').palette[0]?.fill).toBe('#e63946');
  });
});

describe('whiteTextContrast', () => {
  it('GIVEN black THEN the ratio is 21 (the WCAG maximum)', () => {
    expect(whiteTextContrast('#000000')).toBeCloseTo(21, 5);
  });

  it('GIVEN white THEN the ratio is 1', () => {
    expect(whiteTextContrast('#ffffff')).toBeCloseTo(1, 5);
  });
});
