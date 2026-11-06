import { App, PluginSettingTab, Setting } from 'obsidian';
import VitalsPlugin from '../main';
import { SpotifyAuthService } from '../modules/spotify/SpotifyAuthService';

// Built-in public Client ID for 1-click connect
export const DEFAULT_SPOTIFY_CLIENT_ID = 'f83cda7c12094a609ece5d9d0c7c3bdd';

export interface VitalsSettings {
  themePreset: string;
  customFontFamily: string;
  includedFolders: string;
  excludedFolders: string;
  categoryColors: Record<string, string>;
  spotifyClientId: string;
  spotifyRefreshToken: string;
  spotifyAutoSync: boolean;
}

export const DEFAULT_SETTINGS: VitalsSettings = {
  themePreset: 'vitals-stealth',
  customFontFamily: 'Geist Mono',
  includedFolders: '',
  excludedFolders: 'Templates, Archive',
  categoryColors: {},
  spotifyClientId: DEFAULT_SPOTIFY_CLIENT_ID,
  spotifyRefreshToken: '',
  spotifyAutoSync: true,
};

export class VitalsSettingTab extends PluginSettingTab {
  plugin: VitalsPlugin;

  constructor(app: App, plugin: VitalsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Vitals Settings' });

    // 1. Theme Preset
    new Setting(containerEl)
      .setName('Theme Preset')
      .setDesc('Choose the visual theme for your Vitals dashboard.')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('vitals-stealth', 'Vitals Stealth (Default)')
          .addOption('github-dark', 'GitHub Dark')
          .addOption('github-light', 'GitHub Light')
          .addOption('nord-frost', 'Nord Frost')
          .addOption('obsidian-native', 'Obsidian Native')
          .setValue(this.plugin.settings.themePreset)
          .onChange(async (value) => {
            this.plugin.settings.themePreset = value;
            await this.plugin.saveSettings();
          });
      });

    // 2. Custom Font Family
    new Setting(containerEl)
      .setName('Dashboard Font Family')
      .setDesc('Enter any font installed on your computer or available on Google Fonts.')
      .addText((text) => {
        text
          .setPlaceholder('Geist Mono')
          .setValue(this.plugin.settings.customFontFamily)
          .onChange(async (value) => {
            this.plugin.settings.customFontFamily = value.trim() || 'Geist Mono';
            await this.plugin.saveSettings();
          });
      });

    // 3. Spotify Connection (PKCE Flow)
    containerEl.createEl('h3', { text: 'Spotify Integration' });

    // Ensure the ID is populated if previously blank
    if (!this.plugin.settings.spotifyClientId) {
      this.plugin.settings.spotifyClientId = DEFAULT_SPOTIFY_CLIENT_ID;
    }

    const isConnected = Boolean(this.plugin.settings.spotifyRefreshToken);

    new Setting(containerEl)
      .setName('Account Status')
      .setDesc(
        isConnected
          ? 'Connected! Auto-sync is actively logging your streams.'
          : 'Connect your Spotify account with 1-click authorization.',
      )
      .addButton((btn) => {
        if (isConnected) {
          btn
            .setButtonText('Disconnect')
            .setWarning()
            .onClick(async () => {
              this.plugin.settings.spotifyRefreshToken = '';
              await this.plugin.saveSettings();
              this.display();
            });
        } else {
          btn
            .setButtonText('Connect Spotify')
            .setCta()
            .onClick(async () => {
              await SpotifyAuthService.loginWithSpotify(this.plugin.settings, async () => {
                await this.plugin.saveSettings();
                this.display();
              });
            });
        }
      });

    new Setting(containerEl)
      .setName('Custom Client ID (Optional)')
      .setDesc('Use your own Spotify Developer App Client ID instead of the default.')
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SPOTIFY_CLIENT_ID)
          .setValue(this.plugin.settings.spotifyClientId)
          .onChange(async (val) => {
            this.plugin.settings.spotifyClientId = val.trim() || DEFAULT_SPOTIFY_CLIENT_ID;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Background Auto-Sync')
      .setDesc('Automatically fetch your latest played tracks every 15 minutes.')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.spotifyAutoSync).onChange(async (val) => {
          this.plugin.settings.spotifyAutoSync = val;
          await this.plugin.saveSettings();
        });
      });

    // 4. Vault Filters
    containerEl.createEl('h3', { text: 'Vault Filters' });

    new Setting(containerEl)
      .setName('Included Folders')
      .setDesc('Comma-separated folder paths to track.')
      .addText((text) => {
        text
          .setPlaceholder('e.g. Work, Journal')
          .setValue(this.plugin.settings.includedFolders)
          .onChange(async (value) => {
            this.plugin.settings.includedFolders = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Excluded Folders')
      .setDesc('Comma-separated folder paths to ignore.')
      .addText((text) => {
        text
          .setPlaceholder('e.g. Templates, Archive')
          .setValue(this.plugin.settings.excludedFolders)
          .onChange(async (value) => {
            this.plugin.settings.excludedFolders = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
