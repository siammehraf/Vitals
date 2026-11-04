import { Activity } from '../../models/Activity';

export class HeatmapView {
  public static render(
    container: HTMLElement,
    activities: Activity[],
    selectedYear: number,
    onYearChange: (year: number) => void,
  ): void {
    const availableYears = new Set<number>();
    const currentYear = new Date().getFullYear();
    availableYears.add(currentYear);
    availableYears.add(currentYear - 1);

    for (const act of activities) {
      if (act.date) {
        const y = parseInt(act.date.substring(0, 4), 10);
        if (!isNaN(y)) availableYears.add(y);
      }
    }

    const sortedYears = Array.from(availableYears).sort((a, b) => b - a);

    const dateMap = new Map<string, number>();
    let yearTotalSessions = 0;
    for (const act of activities) {
      if (act.date && act.date.startsWith(String(selectedYear))) {
        const current = dateMap.get(act.date) || 0;
        dateMap.set(act.date, current + act.duration);
        yearTotalSessions++;
      }
    }

    const card = container.createEl('div', { cls: 'analytics-card heatmap-card' });

    const header = card.createEl('div', { cls: 'heatmap-header' });
    header.createEl('div', {
      text: `${yearTotalSessions} activities in ${selectedYear}`,
      cls: 'heatmap-title',
    });

    const yearSelector = header.createEl('div', { cls: 'analytics-pill-group' });
    for (const yr of sortedYears) {
      const btn = yearSelector.createEl('button', {
        text: String(yr),
        cls: `analytics-pill-btn ${yr === selectedYear ? 'is-active' : ''}`,
      });
      btn.addEventListener('click', () => {
        onYearChange(yr);
      });
    }

    const gridWrapper = card.createEl('div', { cls: 'heatmap-grid-container' });

    const startDate = new Date(selectedYear, 0, 1);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const endDate = new Date(selectedYear, 11, 31);
    const endDayOfWeek = endDate.getDay();
    endDate.setDate(endDate.getDate() + (6 - endDayOfWeek));

    const grid = gridWrapper.createEl('div', { cls: 'heatmap-grid' });

    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      const isCurrentYear = cursor.getFullYear() === selectedYear;
      const minutes = isCurrentYear ? dateMap.get(dateStr) || 0 : 0;

      const level = isCurrentYear ? HeatmapView.getIntensityLevel(minutes) : 0;
      const cell = grid.createEl('div', {
        cls: `heatmap-cell level-${level} ${!isCurrentYear ? 'out-of-bounds' : ''}`,
      });

      if (isCurrentYear) {
        const hours = (minutes / 60).toFixed(1);
        cell.setAttribute('aria-label', `${dateStr}: ${hours}h (${minutes}m)`);
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    const footer = card.createEl('div', { cls: 'heatmap-footer' });
    footer.createEl('span', { text: 'Less', cls: 'heatmap-legend-label' });

    const legendScale = footer.createEl('div', { cls: 'heatmap-legend-scale' });
    for (let lvl = 0; lvl <= 4; lvl++) {
      legendScale.createEl('div', { cls: `heatmap-cell level-${lvl}` });
    }

    footer.createEl('span', { text: 'More', cls: 'heatmap-legend-label' });
  }

  private static getIntensityLevel(minutes: number): number {
    if (minutes <= 0) return 0;
    if (minutes < 30) return 1;
    if (minutes < 60) return 2;
    if (minutes < 120) return 3;
    return 4;
  }
}
