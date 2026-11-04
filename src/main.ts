import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DataEngine } from './core/DataEngine';
import { DashboardView, VIEW_TYPE_VITALS } from './dashboard/DashboardView';

export default class VitalsPlugin extends Plugin {
  public dataEngine!: DataEngine;

  async onload() {
    this.dataEngine = new DataEngine(this.app);

    // Register the custom Vitals dashboard view
    this.registerView(VIEW_TYPE_VITALS, (leaf: WorkspaceLeaf) => new DashboardView(leaf, this.dataEngine));

    // Add ribbon icon on the left bar
    this.addRibbonIcon('activity', 'Open Vitals', () => {
      this.activateView();
    });

    // Add command to Obsidian Command Palette (Ctrl+P)
    this.addCommand({
      id: 'open-vitals',
      name: 'Open Dashboard',
      callback: () => {
        this.activateView();
      },
    });

    console.log('Vitals loaded successfully!');
  }

  async onunload() {
    console.log('Vitals unloaded.');
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_VITALS);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({
        type: VIEW_TYPE_VITALS,
        active: true,
      });
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}
