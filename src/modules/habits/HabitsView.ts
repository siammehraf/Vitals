import { App } from 'obsidian';
import { VitalsSettings } from '../../settings/VitalsSettings';
import { VitalsModuleView } from '../../models/ModuleView';

export class HabitsView implements VitalsModuleView {
  private app: App;
  private settings: VitalsSettings;

  constructor(app: App, settings: VitalsSettings) {
    this.app = app;
    this.settings = settings;
  }

  public render(container: HTMLElement): void {
    container.empty();
    const card = container.createEl('div', { cls: 'analytics-card vitals-placeholder-card' });
    card.createEl('h2', { text: 'Daily Habit Matrix' });
    card.createEl('p', {
      text: 'Streak momentum, recurring routines, and daily completion consistency.',
      cls: 'vitals-placeholder-desc',
    });
    const badge = card.createEl('div', { cls: 'vitals-coming-soon-badge' });
    badge.setText('Module Ready for Development');
  }

  public destroy(): void {}
}
