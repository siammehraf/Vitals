import { App, PluginSettingTab, Setting } from 'obsidian';
import type VitalsPlugin from '../main';

export type VitalsThemePreset = 'vitals-stealth' | 'github-dark' | 'github-light' | 'nord-frost' | 'obsidian-native';

export interface VitalsSettings {
  themePreset: VitalsThemePreset;
  includedFolders: string;
  excludedFolders: string;
  categoryColors: Record<string, string>;
}

export const DEFAULT_SETTINGS: VitalsSettings = {
  themePreset: 'vitals-stealth',
  includedFolders: '',
  excludedFolders: 'Templates, Archive',
  categoryColors: {
    Writing: '#10b981',
    Reading: '#38bdf8',
    Coding: '#818cf8',
    Research: '#f59e0b',
    Unknown: '#64748b',
  },
};

export class VitalsSettingTab extends PluginSettingTab {
  private plugin: VitalsPlugin;

  constructor(app: App, plugin: VitalsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Vitals Settings' });

    // 1. Theme Preset Selector
    new Setting(containerEl)
      .setName('Dashboard Theme')
      .setDesc('Choose the visual appearance and color profile of the dashboard.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('vitals-stealth', 'Vitals Stealth (Signature Dark)')
          .addOption('github-dark', 'GitHub Dark')
          .addOption('github-light', 'GitHub Light')
          .addOption('nord-frost', 'Nord Frost')
          .addOption('obsidian-native', 'Obsidian Native (Sync with Vault Theme)')
          .setValue(this.plugin.settings.themePreset)
          .onChange(async (val) => {
            this.plugin.settings.themePreset = val as VitalsThemePreset;
            await this.plugin.saveSettings();
          });
      });

    // 2. Vault Scope: Included Folders
    new Setting(containerEl)
      .setName('Included Folders')
      .setDesc("Scan only these folders (comma-separated, e.g., 'Logs, Daily'). Leave empty to scan the entire vault.")
      .addText((text) =>
        text
          .setPlaceholder('All folders')
          .setValue(this.plugin.settings.includedFolders)
          .onChange(async (val) => {
            this.plugin.settings.includedFolders = val;
            await this.plugin.saveSettings();
          }),
      );

    // 3. Vault Scope: Excluded Folders
    new Setting(containerEl)
      .setName('Excluded Folders')
      .setDesc("Never scan notes in these folders (comma-separated, e.g., 'Templates, Archive, Drafts').")
      .addText((text) =>
        text
          .setPlaceholder('Templates, Archive')
          .setValue(this.plugin.settings.excludedFolders)
          .onChange(async (val) => {
            this.plugin.settings.excludedFolders = val;
            await this.plugin.saveSettings();
          }),
      );

    // 4. Category Color Mapping
    containerEl.createEl('h3', { text: 'Category Colors' });
    containerEl.createEl('p', {
      text: 'Assign dedicated colors to ensure categories remain visually consistent across all timeframe views.',
      cls: 'setting-item-description',
    });

    const entries = Object.entries(this.plugin.settings.categoryColors);
    for (const [catName, colorVal] of entries) {
      new Setting(containerEl)
        .setName(catName)
        .addColorPicker((color) => {
          color.setValue(colorVal).onChange(async (newColor) => {
            this.plugin.settings.categoryColors[catName] = newColor;
            await this.plugin.saveSettings();
          });
        })
        .addButton((btn) => {
          btn
            .setButtonText('Remove')
            .setWarning()
            .onClick(async () => {
              delete this.plugin.settings.categoryColors[catName];
              await this.plugin.saveSettings();
              this.display();
            });
        });
    }

    let newCategoryName = '';
    let newCategoryColor = '#2dd4bf';

    new Setting(containerEl)
      .setName('Add Category Color')
      .setDesc('Map a new category name to a custom hex color.')
      .addText((text) =>
        text.setPlaceholder('e.g. DeepWork').onChange((val) => {
          newCategoryName = val.trim();
        }),
      )
      .addColorPicker((picker) =>
        picker.setValue(newCategoryColor).onChange((val) => {
          newCategoryColor = val;
        }),
      )
      .addButton((btn) =>
        btn
          .setButtonText('Add')
          .setCta()
          .onClick(async () => {
            if (!newCategoryName) return;
            this.plugin.settings.categoryColors[newCategoryName] = newCategoryColor;
            await this.plugin.saveSettings();
            this.display();
          }),
      );
  }
}
