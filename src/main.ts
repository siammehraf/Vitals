/* ==========================================================================
   Imports & Dependencies
   ========================================================================== */

import { Plugin, WorkspaceLeaf, Platform, debounce, addIcon } from 'obsidian';
import { DataEngine } from './core/DataEngine';
import { SpotifyDataEngine } from './modules/spotify/SpotifyDataEngine';
import { VitalsSettings, DEFAULT_SETTINGS, VitalsSettingTab } from './settings/VitalsSettings';
import { VitalsAppShell, DASHBOARD_VIEW_TYPE } from './shell/VitalsAppShell';

/* ==========================================================================
   Custom Vector SVG Icon Definitions
   ========================================================================== */

/**
 * Registers custom high-quality SVG icons into Obsidian's internal icon registry.
 * Once registered, these IDs can be used anywhere in addRibbonIcon, setIcon, or getIcon.
 */
function registerVitalsIcons(): void {
  // 1. Vitals Ribbon Bolt (Lightning Wave)
  addIcon(
    'vitals-bolt',
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>`,
  );

  // 2. Activity (Metric Bar Chart)
  addIcon(
    'vitals-activity',
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      <path d="M9 17V9"></path>
      <path d="M13 17V5"></path>
      <path d="M17 17v-4"></path>
    </svg>`,
  );

  // 3. Official Spotify Waveform Icon
  addIcon(
    'vitals-spotify',
    `<svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.495 17.306c-.215.352-.676.463-1.028.248-2.817-1.722-6.362-2.111-10.538-1.157-.402.092-.801-.16-.893-.562-.092-.403.16-.802.562-.894 4.571-1.045 8.492-.596 11.649 1.336.352.216.464.677.248 1.029zm1.467-3.262c-.27.44-.848.579-1.288.31-3.225-1.982-8.141-2.557-11.956-1.399-.499.151-1.03-.134-1.181-.633-.151-.499.134-1.03.633-1.181 4.364-1.325 9.774-.683 13.482 1.595.44.269.58.848.31 1.288zm.126-3.41c-3.867-2.296-10.248-2.508-13.941-1.387-.593.18-1.22-.16-1.4-.753-.18-.593.16-1.22.753-1.4 4.246-1.289 11.294-1.04 15.753 1.607.533.316.708 1.009.392 1.542-.316.533-1.009.708-1.542.392z"></path>
    </svg>`,
  );

  // 4. Books (Library Shelf Icon)
  addIcon(
    'vitals-books',
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      <line x1="8" y1="6" x2="16" y2="6"></line>
      <line x1="8" y1="10" x2="16" y2="10"></line>
    </svg>`,
  );

  // 5. Habits (Target Bullseye Icon)
  addIcon(
    'vitals-habits',
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <circle cx="12" cy="12" r="6"></circle>
      <circle cx="12" cy="12" r="2"></circle>
    </svg>`,
  );
}

/* ==========================================================================
   VitalsPlugin Core Implementation
   ========================================================================== */

export default class VitalsPlugin extends Plugin {
  public settings!: VitalsSettings;
  public dataEngine!: DataEngine;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Register all custom vector SVG icons
    registerVitalsIcons();

    this.dataEngine = new DataEngine(this.app, this.settings);

    // Register View using App Shell
    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new VitalsAppShell(leaf, this.dataEngine, this.settings),
    );

    // Ribbon Icon (Mobile Drawer & Desktop Left Ribbon) using high-quality SVG
    this.addRibbonIcon('vitals-bolt', 'Open Vitals', () => {
      this.activateView();
    });

    // Command Palette
    this.addCommand({
      id: 'open-vitals-dashboard',
      name: 'Open Dashboard',
      callback: () => {
        this.activateView();
      },
    });

    this.addSettingTab(new VitalsSettingTab(this.app, this));

    // Real-Time Vault Watchers
    this.registerRealtimeListeners();

    // Auto-sync recently played Spotify tracks every 15 minutes
    this.registerInterval(
      window.setInterval(
        async () => {
          if (this.settings.spotifyRefreshToken && this.settings.spotifyAutoSync) {
            const spotifyEngine = new SpotifyDataEngine(this.app, this.settings);
            await spotifyEngine.syncRecentlyPlayed();
          }
        },
        15 * 60 * 1000,
      ),
    );
  }

  /* ==========================================================================
     Real-Time Vault Watchers
     ========================================================================== */

  /**
   * Listens for file & metadata changes in the vault and automatically refreshes Vitals
   */
  private registerRealtimeListeners(): void {
    const debouncedRefresh = debounce(
      () => {
        const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
        for (const leaf of leaves) {
          if (leaf.view instanceof VitalsAppShell) {
            leaf.view.render();
          }
        }
      },
      400,
      true,
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', () => {
        debouncedRefresh();
      }),
    );

    this.registerEvent(
      this.app.vault.on('create', () => {
        debouncedRefresh();
      }),
    );
    this.registerEvent(
      this.app.vault.on('delete', () => {
        debouncedRefresh();
      }),
    );
    this.registerEvent(
      this.app.vault.on('rename', () => {
        debouncedRefresh();
      }),
    );
  }

  /* ==========================================================================
     Settings Persistence & View Synchronization
     ========================================================================== */

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.dataEngine.updateSettings(this.settings);

    const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof VitalsAppShell) {
        leaf.view.updateSettings(this.settings);
      }
    }
  }

  /* ==========================================================================
     Workspace Leaf Activation
     ========================================================================== */

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];

    if (!leaf) {
      leaf = Platform.isMobile ? workspace.getLeaf(false) : workspace.getLeaf(true);

      if (leaf) {
        await leaf.setViewState({
          type: DASHBOARD_VIEW_TYPE,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  /* ==========================================================================
     Plugin Teardown
     ========================================================================== */

  onunload(): void {
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
  }
}
