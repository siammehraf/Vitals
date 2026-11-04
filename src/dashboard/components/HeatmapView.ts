import { Activity } from '../../models/Activity';

export class HeatmapView {
  public static render(container: HTMLElement, activities: Activity[]): void {
    const existing = container.querySelector('.heatmap-card');
    if (existing) existing.remove();

    const card = container.createEl('div', { cls: 'analytics-card heatmap-card' });

    // Header
    const header = card.createEl('div', { cls: 'heatmap-header' });
    header.createEl('div', { text: 'Consistency Heatmap', cls: 'heatmap-title' });

    // Floating tooltip container (appended once to the card)
    const tooltip = card.createEl('div', { cls: 'heatmap-floating-tooltip' });

    // Grid container
    const gridContainer = card.createEl('div', { cls: 'heatmap-grid-container' });
    const grid = gridContainer.createEl('div', { cls: 'heatmap-grid' });

    // Map activity minutes by ISO date string (YYYY-MM-DD)
    const minutesMap: Record<string, number> = {};
    for (const a of activities) {
      if (a.date) {
        minutesMap[a.date] = (minutesMap[a.date] || 0) + a.duration;
      }
    }

    // Generate grid for past 52 weeks (364 days ending today)
    const today = new Date();
    const daysToShow = 52 * 7;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (daysToShow - 1));

    for (let i = 0; i < daysToShow; i++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + i);

      const yyyy = cellDate.getFullYear();
      const mm = String(cellDate.getMonth() + 1).padStart(2, '0');
      const dd = String(cellDate.getDate()).padStart(2, '0');
      const iso = `${yyyy}-${mm}-${dd}`;

      const totalMins = minutesMap[iso] || 0;
      const level = HeatmapView.getIntensityLevel(totalMins);
      const displayHours = (totalMins / 60).toFixed(1);

      // Do NOT set native 'title' attribute to prevent browser system tooltip overlap
      const cell = grid.createEl('div', {
        cls: `heatmap-cell level-${level}`,
        attr: {
          'data-date': iso,
        },
      });

      // Smooth custom tooltip positioning
      cell.addEventListener('mouseenter', (e) => {
        const rect = cell.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();

        tooltip.textContent = `${iso}: ${displayHours} hrs (${totalMins}m)`;
        tooltip.addClass('is-visible');

        // Center tooltip directly above the cell
        const left = rect.left - cardRect.left + rect.width / 2;
        const top = rect.top - cardRect.top - 8;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      });

      cell.addEventListener('mouseleave', () => {
        tooltip.removeClass('is-visible');
      });
    }

    // Footer with legend
    const footer = card.createEl('div', { cls: 'heatmap-footer' });
    footer.createEl('span', { text: 'Less' });
    const legend = footer.createEl('div', { cls: 'heatmap-legend-scale' });
    for (let lvl = 0; lvl <= 4; lvl++) {
      legend.createEl('div', { cls: `heatmap-cell level-${lvl}` });
    }
    footer.createEl('span', { text: 'More' });
  }

  private static getIntensityLevel(minutes: number): number {
    if (minutes <= 0) return 0;
    if (minutes <= 45) return 1;
    if (minutes <= 120) return 2;
    if (minutes <= 240) return 3;
    return 4;
  }
}
