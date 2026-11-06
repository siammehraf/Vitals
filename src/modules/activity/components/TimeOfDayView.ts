import { Activity } from '../../../models/Activity';

export class TimeOfDayView {
  public static render(container: HTMLElement, activities: Activity[]): void {
    const existing = container.querySelector('.punchcard-card');
    if (existing) existing.remove();

    const card = container.createEl('div', { cls: 'analytics-card punchcard-card' });

    // Header
    const header = card.createEl('div', { cls: 'analytics-card-header' });
    header.createEl('div', { text: 'Productivity by Time of Day', cls: 'analytics-card-title' });
    header.createEl('div', { text: '24-Hour Distribution', cls: 'punchcard-subtitle' });

    // 7 days (0=Sun..6=Sat) x 24 hours (0..23)
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    let maxMinutesInCell = 0;
    for (const a of activities) {
      if (!a.date) continue;
      const d = new Date(a.date + 'T00:00:00');
      const dayIndex = d.getDay();
      const hourIndex = a.hour !== undefined ? a.hour : 12;

      matrix[dayIndex][hourIndex] += a.duration;
      if (matrix[dayIndex][hourIndex] > maxMinutesInCell) {
        maxMinutesInCell = matrix[dayIndex][hourIndex];
      }
    }

    const daysLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const tooltip = card.createEl('div', { cls: 'heatmap-floating-tooltip' });

    const wrapper = card.createEl('div', { cls: 'punchcard-wrapper' });
    const grid = wrapper.createEl('div', { cls: 'punchcard-grid' });

    // Empty top-left corner
    grid.createEl('div', { cls: 'punchcard-corner' });

    // 24 Hour Header Ticks
    for (let h = 0; h < 24; h++) {
      const headerTick = grid.createEl('div', { cls: 'punchcard-hour-header' });
      if (h % 3 === 0) {
        headerTick.setText(`${h}:00`);
      }
    }

    // 7 Rows of Days + 24 Cells each
    for (let day = 0; day < 7; day++) {
      grid.createEl('div', { text: daysLabels[day], cls: 'punchcard-day-label' });

      for (let hr = 0; hr < 24; hr++) {
        const mins = matrix[day][hr];
        const ratio = maxMinutesInCell > 0 ? mins / maxMinutesInCell : 0;
        const level = this.getIntensityLevel(ratio, mins);

        const cell = grid.createEl('div', {
          cls: `punchcard-dot level-${level}`,
        });

        cell.addEventListener('mouseenter', () => {
          const rect = cell.getBoundingClientRect();
          const cardRect = card.getBoundingClientRect();
          const hrsText = (mins / 60).toFixed(1);

          tooltip.textContent = `${daysLabels[day]} @ ${hr}:00 — ${hrsText} hrs (${mins}m)`;
          tooltip.addClass('is-visible');

          const left = rect.left - cardRect.left + rect.width / 2;
          const top = rect.top - cardRect.top - 8;

          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;
        });

        cell.addEventListener('mouseleave', () => {
          tooltip.removeClass('is-visible');
        });
      }
    }
  }

  private static getIntensityLevel(ratio: number, mins: number): number {
    if (mins <= 0) return 0;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }
}
