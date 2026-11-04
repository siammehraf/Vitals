import { App, Modal, TFile } from 'obsidian';
import { Activity } from '../../models/Activity';

export class HeatmapDayModal extends Modal {
  private dateStr: string;
  private activities: Activity[];

  constructor(app: App, dateStr: string, activities: Activity[]) {
    super(app);
    this.dateStr = dateStr;
    this.activities = activities;
  }

  public onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('vitals-day-modal');

    const totalMinutes = this.activities.reduce((sum, a) => sum + a.duration, 0);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const durationFormatted = h > 0 ? `${h}h ${m}m` : `${m}m`;

    // Modal Header
    const header = contentEl.createEl('div', { cls: 'vitals-modal-header' });
    header.createEl('h2', { text: `Activities on ${this.dateStr}` });
    header.createEl('p', {
      text: `${this.activities.length} session(s) logged · Total: ${durationFormatted}`,
      cls: 'vitals-modal-subtitle',
    });

    if (this.activities.length === 0) {
      contentEl.createEl('p', { text: 'No activities recorded on this date.', cls: 'analytics-empty-message' });
      return;
    }

    // Activity List
    const list = contentEl.createEl('div', { cls: 'vitals-modal-list' });

    for (const act of this.activities) {
      const item = list.createEl('div', { cls: 'vitals-modal-item' });

      const infoCol = item.createEl('div', { cls: 'vitals-item-info' });
      const link = infoCol.createEl('a', { text: act.title, cls: 'vitals-item-title' });
      link.addEventListener('click', async () => {
        const file = this.app.vault.getAbstractFileByPath(act.id);
        if (file instanceof TFile) {
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(file);
          this.close();
        }
      });

      const catBadge = infoCol.createEl('span', { text: act.type, cls: 'vitals-item-badge' });
      if (act.project) {
        infoCol.createEl('span', { text: `@${act.project}`, cls: 'vitals-item-project' });
      }

      // Duration Column
      const durHours = (act.duration / 60).toFixed(1);
      const durationCol = item.createEl('div', { cls: 'vitals-item-duration' });
      durationCol.createEl('div', { text: `${durHours}h`, cls: 'vitals-item-dur-main' });
      durationCol.createEl('div', { text: `${act.duration}m`, cls: 'vitals-item-dur-sub' });
    }
  }

  public onClose(): void {
    this.contentEl.empty();
  }
}
