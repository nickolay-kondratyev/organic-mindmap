import { PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';
import { FONT_CHOICES, fontIdForUrl, isFontId, type FontId } from './fontChoices';
import type { MapSettings } from './mapSettings';
import { isPaletteId, PALETTE_PRESETS, palettePreset, presetIdForPalette } from './palettePresets';

/** Dropdown value for a stored palette that matches no preset (hand-edited `data.json`); picking it keeps the palette. */
const CUSTOM_PALETTE_VALUE = 'custom';
const CUSTOM_PALETTE_LABEL = 'Custom (from your settings file)';
export const RESET_BUTTON_LABEL = 'Restore look defaults';

/**
 * The "Organic Mindmap" settings tab: the few look settings a person changes (ticket nid_3dc4tbkt1il822ulzdmloxna1_e).
 * Thin: every control reads the current value from `MapSettings` and writes through its setters; what each change
 * does to the config is unit-tested there. Obsidian guidelines: sentence case, no top-level heading, save on change.
 */
export class MapSettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly settings: MapSettings,
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    this.addPaletteSetting(containerEl);
    this.addFontSetting(containerEl, 'Node font', 'The font of the labels inside nodes.', fontIdForUrl(this.settings.config.text.node.url), (id) =>
      this.settings.setNodeFont(id),
    );
    this.addFontSetting(containerEl, 'Branch font', 'The font of the labels written along branches.', fontIdForUrl(this.settings.config.text.branch.url), (id) =>
      this.settings.setBranchFont(id),
    );
    this.addBackgroundSetting(containerEl);
    this.addResetSetting(containerEl);
  }

  private addPaletteSetting(containerEl: HTMLElement): void {
    const currentId = presetIdForPalette(this.settings.config.theme.color.palette);
    new Setting(containerEl)
      .setName('Branch colors')
      .setDesc('The colors of first-level branches and everything under them.')
      .addDropdown((dropdown) => {
        for (const preset of PALETTE_PRESETS) dropdown.addOption(preset.id, preset.name);
        if (currentId === null) dropdown.addOption(CUSTOM_PALETTE_VALUE, CUSTOM_PALETTE_LABEL);
        dropdown.setValue(currentId ?? CUSTOM_PALETTE_VALUE);
        dropdown.onChange((value) => {
          if (isPaletteId(value)) this.settings.setPalette(palettePreset(value).palette);
        });
      });
  }

  private addFontSetting(containerEl: HTMLElement, name: string, desc: string, currentId: FontId | null, apply: (id: FontId) => void): void {
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

  private addBackgroundSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Background color')
      .setDesc('Behind the map. Pick a dark one for the default white labels.')
      .addColorPicker((picker) =>
        picker.setValue(this.settings.config.theme.color.background).onChange((value) => this.settings.setBackground(value)),
      );
  }

  private addResetSetting(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName(RESET_BUTTON_LABEL)
      .setDesc('Branch colors, fonts and background color go back to how the plugin ships. Nothing else changes.')
      .addButton((button) =>
        button.setButtonText(RESET_BUTTON_LABEL).onClick(() => {
          this.settings.resetLook();
          // Re-render so every control shows the restored value.
          this.display();
        }),
      );
  }
}
