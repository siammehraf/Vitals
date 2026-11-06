import { App } from 'obsidian';
import { VitalsSettings } from '../../settings/VitalsSettings';
import { VitalsModuleView } from '../../models/ModuleView';

export class BooksView implements VitalsModuleView {
  private app: App;
  private settings: VitalsSettings;

  constructor(app: App, settings: VitalsSettings) {
    this.app = app;
    this.settings = settings;
  }

  public render(container: HTMLElement): void {
    container.empty();
    const card = container.createEl('div', { cls: 'analytics-card vitals-placeholder-card' });
    card.createEl('h2', { text: 'Library & Book Highlights' });
    card.createEl('p', {
      text: 'Analyze reading sessions, pages read, active literature, and highlight quotes.',
      cls: 'vitals-placeholder-desc',
    });
    const badge = card.createEl('div', { cls: 'vitals-coming-soon-badge' });
    badge.setText('Module Ready for Development');
  }

  public destroy(): void {}
}
