import { App } from 'obsidian';
import { Activity } from '../../../models/Activity';
import { HeatmapDayModal } from './HeatmapDayModal';

export type HeatmapScope = 'rolling' | number; // "rolling" (last 52w) or specific calendar year (e.g., 2026, 2025)

export class HeatmapView {
  private static currentScope: HeatmapScope = 'rolling';

  public static render(container: HTMLElement, activities: Activity[], app: App): void {
    // 1. Locate or create the card element
    let card = container.querySelector('.heatmap-card') as HTMLElement | null;
    if (!card) {
      card = container.createEl('div', { cls: 'analytics-card heatmap-card' });
    } else {
      // Clear contents in-place so DOM position remains unchanged
      card.empty();
    }

    // 2. Collect available calendar years from logged data
    const yearsSet = new Set<number>();
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);

    for (const a of activities) {
      if (a.date && a.date.length >= 4) {
        const y = parseInt(a.date.substring(0, 4), 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    }
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    // 3. Header & Scope Controls
    const header = card.createEl('div', { cls: 'heatmap-header' });
    const titleArea = header.createEl('div', { cls: 'analytics-title-area-compact' });
    titleArea.createEl('div', { text: 'Consistency Heatmap', cls: 'heatmap-title' });

    const controls = header.createEl('div', { cls: 'analytics-pill-group' });
    const rollingBtn = controls.createEl('button', {
      text: 'Last 52W',
      cls: `analytics-pill-btn ${this.currentScope === 'rolling' ? 'is-active' : ''}`,
    });
    rollingBtn.addEventListener('click', () => {
      if (this.currentScope === 'rolling') return;
      this.currentScope = 'rolling';
      HeatmapView.render(container, activities, app);
    });

    for (const yr of sortedYears) {
      const yrBtn = controls.createEl('button', {
        text: `${yr}`,
        cls: `analytics-pill-btn ${this.currentScope === yr ? 'is-active' : ''}`,
      });
      yrBtn.addEventListener('click', () => {
        if (this.currentScope === yr) return;
        this.currentScope = yr;
        HeatmapView.render(container, activities, app);
      });
    }

    const tooltip = card.createEl('div', { cls: 'heatmap-floating-tooltip' });

    const gridContainer = card.createEl('div', { cls: 'heatmap-grid-container' });
    const grid = gridContainer.createEl('div', { cls: 'heatmap-grid' });

    // 4. Map activities by date
    const dayActivitiesMap: Record<string, Activity[]> = {};
    for (const a of activities) {
      if (a.date) {
        if (!dayActivitiesMap[a.date]) dayActivitiesMap[a.date] = [];
        dayActivitiesMap[a.date].push(a);
      }
    }

    // 5. Calculate range depending on active scope
    let startDate: Date;
    let daysCount: number;

    if (this.currentScope === 'rolling') {
      const today = new Date();
      daysCount = 52 * 7;
      startDate = new Date(today);
      startDate.setDate(today.getDate() - (daysCount - 1));
    } else {
      const year = this.currentScope;
      startDate = new Date(year, 0, 1);
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      daysCount = isLeap ? 366 : 365;
    }

    for (let i = 0; i < daysCount; i++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + i);

      const yyyy = cellDate.getFullYear();
      const mm = String(cellDate.getMonth() + 1).padStart(2, '0');
      const dd = String(cellDate.getDate()).padStart(2, '0');
      const iso = `${yyyy}-${mm}-${dd}`;

      const dayActivities = dayActivitiesMap[iso] || [];
      const totalMins = dayActivities.reduce((sum, a) => sum + a.duration, 0);
      const level = HeatmapView.getIntensityLevel(totalMins);
      const displayHours = (totalMins / 60).toFixed(1);

      const cell = grid.createEl('div', {
        cls: `heatmap-cell level-${level}`,
        attr: { 'data-date': iso },
      });

      cell.addEventListener('mouseenter', () => {
        const rect = cell.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();

        tooltip.textContent = `${iso}: ${displayHours} hrs (${totalMins}m) · Click to view`;
        tooltip.addClass('is-visible');

        const left = rect.left - cardRect.left + rect.width / 2;
        const top = rect.top - cardRect.top - 8;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      });

      cell.addEventListener('mouseleave', () => {
        tooltip.removeClass('is-visible');
      });

      cell.addEventListener('click', () => {
        new HeatmapDayModal(app, iso, dayActivities).open();
      });
    }

    // 6. Footer Legend
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
