import { App, Modal, TFile } from 'obsidian';
import { Activity } from '../../../models/Activity';

export class HeatmapDayModal extends Modal {
  private dateStr: string;
  private activities: Activity[];

  constructor(app: App, dateStr: string, activities: Activity[]) {
    super(app);
    this.dateStr = dateStr;
    this.activities = activities;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('vitals-day-modal');

    // Header Area
    const header = contentEl.createEl('div', { cls: 'vitals-modal-header' });
    const formattedDate = this.formatHeaderDate(this.dateStr);
    header.createEl('h2', { text: formattedDate, cls: 'vitals-modal-title' });

    const totalMinutes = this.activities.reduce((sum, a) => sum + a.duration, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const subtitle = header.createEl('div', { cls: 'vitals-modal-subtitle' });
    subtitle.createEl('span', {
      text: `${this.activities.length} session${this.activities.length === 1 ? '' : 's'} logged`,
      cls: 'vitals-modal-count',
    });
    subtitle.createEl('span', { text: '•', cls: 'vitals-modal-sep' });
    subtitle.createEl('span', {
      text: `${totalHours}h (${totalMinutes}m) total`,
      cls: 'vitals-modal-total',
    });

    // Content List Container
    const listContainer = contentEl.createEl('div', { cls: 'vitals-modal-list' });

    if (this.activities.length === 0) {
      listContainer.createEl('p', {
        text: 'No recorded activities on this day.',
        cls: 'vitals-modal-empty',
      });
      return;
    }

    // Sort longest to shortest
    const sorted = [...this.activities].sort((a, b) => b.duration - a.duration);

    for (const act of sorted) {
      const itemRow = listContainer.createEl('div', { cls: 'vitals-modal-item' });

      // Left Column: Title and Project
      const infoCol = itemRow.createEl('div', { cls: 'vitals-modal-info' });
      const link = infoCol.createEl('a', { text: act.title, cls: 'vitals-modal-link' });
      link.addEventListener('click', async () => {
        const file = this.app.vault.getAbstractFileByPath(act.id);
        if (file instanceof TFile) {
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(file);
          this.close();
        }
      });

      if (act.project) {
        infoCol.createEl('span', { text: `@${act.project}`, cls: 'vitals-modal-project' });
      }

      // Right Column: Category Badge + Duration
      const metaCol = itemRow.createEl('div', { cls: 'vitals-modal-meta' });

      if (act.type) {
        metaCol.createEl('span', { text: act.type, cls: 'vitals-item-badge' });
      }

      const durCol = metaCol.createEl('div', { cls: 'vitals-modal-dur' });
      const hours = (act.duration / 60).toFixed(1);
      durCol.createEl('span', { text: `${hours}h`, cls: 'vitals-modal-h' });
      durCol.createEl('small', { text: ` (${act.duration}m)`, cls: 'vitals-modal-m' });
    }
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  private formatHeaderDate(isoDate: string): string {
    try {
      const [year, month, day] = isoDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }
}
