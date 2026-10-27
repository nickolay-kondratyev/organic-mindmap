import { Setting } from 'obsidian';
import { FONT_CHOICES, fontIdForUrl, isFontId, type FontId } from './fontChoices';
import type { MapSettings } from './mapSettings';
import { isPaletteId, PALETTE_PRESETS, palettePreset, presetIdForPalette } from './palettePresets';

/** Dropdown value for a stored palette that matches no preset (hand-edited `data.json`); picking it keeps the palette. */
const CUSTOM_PALETTE_VALUE = 'custom';
const CUSTOM_PALETTE_LABEL = 'Custom (from your settings file)';
export const RESET_BUTTON_LABEL = 'Restore look defaults';

/**
 * The look rows (branch colors, fonts, background, reset) as native Obsidian `Setting` rows in `containerEl`: the one
 * source for every surface that shows them, so wording, choices and wiring never drift between surfaces.
 * Thin: every control reads the current value from `MapSettings` and writes through its setters; what each change
 * does to the config is unit-tested there. Obsidian guidelines: sentence case, save on change.
 * `afterReset` re-renders the caller's rows so every control shows the restored value.
 */
export function addLookSettingRows(containerEl: HTMLElement, settings: MapSettings, afterReset: () => void): void {
  addPaletteSetting(containerEl, settings);
  addFontSetting(containerEl, 'Node font', 'The font of the labels inside nodes.', fontIdForUrl(settings.config.text.node.url), (id) =>
    settings.setNodeFont(id),
  );
  addFontSetting(containerEl, 'Branch font', 'The font of the labels written along branches.', fontIdForUrl(settings.config.text.branch.url), (id) =>
    settings.setBranchFont(id),
  );
  addBackgroundSetting(containerEl, settings);
  addResetSetting(containerEl, settings, afterReset);
}

function addPaletteSetting(containerEl: HTMLElement, settings: MapSettings): void {
  const currentId = presetIdForPalette(settings.config.theme.color.palette);
  new Setting(containerEl)
    .setName('Branch colors')
    .setDesc('The colors of first-level branches and everything under them.')
    .addDropdown((dropdown) => {
      for (const preset of PALETTE_PRESETS) dropdown.addOption(preset.id, preset.name);
      if (currentId === null) dropdown.addOption(CUSTOM_PALETTE_VALUE, CUSTOM_PALETTE_LABEL);
      dropdown.setValue(currentId ?? CUSTOM_PALETTE_VALUE);
      dropdown.onChange((value) => {
        if (isPaletteId(value)) settings.setPalette(palettePreset(value).palette);
      });
    });
}

function addFontSetting(containerEl: HTMLElement, name: string, desc: string, currentId: FontId | null, apply: (id: FontId) => void): void {
  new Setting(containerEl)
    .setName(name)
    .setDesc(desc)
    .addDropdown((dropdown) => {
      for (const choice of FONT_CHOICES) dropdown.addOption(choice.id, choice.name);
      // `MapSettings.load` already replaced any unbundled font, so the current URL always names a choice.
      if (currentId !== null) dropdown.setValue(currentId);
      dropdown.onChange((value) => {
        if (isFontId(value)) apply(value);
      });
    });
}

function addBackgroundSetting(containerEl: HTMLElement, settings: MapSettings): void {
  new Setting(containerEl)
    .setName('Background color')
    .setDesc('Behind the map. Pick a dark one for the default white labels.')
    .addColorPicker((picker) => picker.setValue(settings.config.theme.color.background).onChange((value) => settings.setBackground(value)));
}

function addResetSetting(containerEl: HTMLElement, settings: MapSettings, afterReset: () => void): void {
  new Setting(containerEl)
    .setName(RESET_BUTTON_LABEL)
    // Lets a compact surface (the map's panel) drop the row name that only repeats the button.
    .setClass('organic-mindmap-reset-look')
    .setDesc('Branch colors, fonts and background color go back to how the plugin ships. Nothing else changes.')
    .addButton((button) =>
      button.setButtonText(RESET_BUTTON_LABEL).onClick(() => {
        settings.resetLook();
        afterReset();
      }),
    );
}
