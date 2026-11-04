import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DashboardView, DASHBOARD_VIEW_TYPE, VIEW_TYPE_VITALS } from './dashboard/DashboardView';
import { DataEngine } from './core/DataEngine';
import { VitalsSettings, DEFAULT_SETTINGS, VitalsSettingTab } from './settings/VitalsSettings';

export default class VitalsPlugin extends Plugin {
  public settings: VitalsSettings = DEFAULT_SETTINGS;
  private dataEngine!: DataEngine;

  public async onload(): Promise<void> {
    await this.loadSettings();

    this.dataEngine = new DataEngine(this.app, this.settings);

    // Register View
    this.registerView(DASHBOARD_VIEW_TYPE, (leaf: WorkspaceLeaf) => {
      return new DashboardView(leaf, this.dataEngine, this.settings);
    });

    // Ribbon Icon
    this.addRibbonIcon('activity', 'Open Vitals Dashboard', () => {
      this.activateView();
    });

    // Command
    this.addCommand({
      id: 'open-vitals-dashboard',
      name: 'Open Dashboard',
      callback: () => {
        this.activateView();
      },
    });

    // Settings Tab
    this.addSettingTab(new VitalsSettingTab(this.app, this));
  }

  public async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.dataEngine.updateSettings(this.settings);

    // Refresh any open dashboard leaves
    const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof DashboardView) {
        leaf.view.updateSettings(this.settings);
      }
    }
  }

  public async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf(true);
      if (leaf) {
        await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  public onunload(): void {}
}
