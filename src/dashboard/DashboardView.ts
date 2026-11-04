import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Activity } from '../models/Activity';
import { DataEngine } from '../core/DataEngine';
import { HeatmapView } from './components/HeatmapView';
import { WeeklyProgressView, ProgressViewMode } from './components/WeeklyProgressView';
import { CategoryChartView } from './components/CategoryChartView';

export const DASHBOARD_VIEW_TYPE = 'vitals-dashboard-view';
export const VIEW_TYPE_VITALS = DASHBOARD_VIEW_TYPE;

export type TimeRangeFilter = '30d' | 'month' | 'year' | 'all';

export class DashboardView extends ItemView {
  private dataEngine: DataEngine;
  private currentRange: TimeRangeFilter = '30d';
  private rangeOffset: number = 0;
  private progressMode: ProgressViewMode = 'day';

  constructor(leaf: WorkspaceLeaf, dataEngine: DataEngine) {
    super(leaf);
    this.dataEngine = dataEngine;
  }

  public getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  public getDisplayText(): string {
    return 'Vitals Dashboard';
  }

  public getIcon(): string {
    return 'activity';
  }

  public async onOpen(): Promise<void> {
    this.render();
  }

  public render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass('activity-analytics-container');

    const allActivities = this.dataEngine.getActivities();

    // Top Header & Compact Controls
    const topBar = container.createEl('div', { cls: 'analytics-top-bar' });
    const titleArea = topBar.createEl('div', { cls: 'analytics-title-area' });
    titleArea.createEl('h2', { text: 'Vitals' });

    const filterContainer = topBar.createEl('div', { cls: 'analytics-top-controls' });

    // Period Navigation (‹ Label ›) for Month and Year
    if (this.currentRange === 'month' || this.currentRange === 'year') {
      const navGroup = filterContainer.createEl('div', { cls: 'analytics-pill-group range-nav-group' });

      const prevBtn = navGroup.createEl('button', {
        text: '‹',
        cls: 'analytics-pill-btn range-nav-arrow',
        attr: { 'aria-label': 'Previous Period' },
      });
      prevBtn.addEventListener('click', () => {
        this.rangeOffset += 1;
        this.render();
      });

      navGroup.createEl('span', {
        text: this.getRangePeriodLabel(),
        cls: 'range-nav-current-label',
      });

      const isAtCurrent = this.rangeOffset === 0;
      const nextBtn = navGroup.createEl('button', {
        text: '›',
        cls: `analytics-pill-btn range-nav-arrow ${isAtCurrent ? 'is-disabled' : ''}`,
        attr: { 'aria-label': 'Next Period' },
      });
      if (!isAtCurrent) {
        nextBtn.addEventListener('click', () => {
          this.rangeOffset = Math.max(0, this.rangeOffset - 1);
          this.render();
        });
      }
    }

    // Range Mode Selector: [ 30D | Month | Year | All ]
    const pillGroup = filterContainer.createEl('div', { cls: 'analytics-pill-group' });
    const ranges: { key: TimeRangeFilter; label: string }[] = [
      { key: '30d', label: '30D' },
      { key: 'month', label: 'Month' },
      { key: 'year', label: 'Year' },
      { key: 'all', label: 'All' },
    ];

    for (const r of ranges) {
      const btn = pillGroup.createEl('button', {
        text: r.label,
        cls: `analytics-pill-btn ${this.currentRange === r.key ? 'is-active' : ''}`,
      });
      btn.addEventListener('click', () => {
        this.currentRange = r.key;
        this.rangeOffset = 0;
        this.render();
      });
    }

    const filteredActivities = this.filterActivities(allActivities, this.currentRange, this.rangeOffset);

    // 1. Metric Summary Cards
    this.renderMetricCards(container, filteredActivities);

    // 2. Heatmap
    HeatmapView.render(container, allActivities);

    // 3. Lower Row: Trend & Category Distribution
    const chartsRow = container.createEl('div', { cls: 'analytics-charts-row' });

    WeeklyProgressView.render(chartsRow, allActivities, this.progressMode, (newMode) => {
      this.progressMode = newMode;
      this.render();
    });

    CategoryChartView.render(chartsRow, filteredActivities);
  }

  private renderMetricCards(container: HTMLElement, activities: Activity[]): void {
    const grid = container.createEl('div', { cls: 'analytics-metrics-grid' });

    const totalMinutes = activities.reduce((sum, a) => sum + a.duration, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const loggedBadge = h > 0 ? `${h}h ${m}m logged` : `${m}m logged`;

    const activeDaysSet = new Set(activities.map((a) => a.date).filter(Boolean));
    const activeDays = activeDaysSet.size;

    const uniqueCategories = new Set(activities.map((a) => a.type).filter(Boolean)).size;

    const avgMinutesPerDay = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;
    const avgHours = (avgMinutesPerDay / 60).toFixed(1);

    const metrics = [
      { label: 'Total Time', value: totalHours, unit: 'hrs', badge: loggedBadge },
      { label: 'Active Days', value: `${activeDays}`, unit: 'days', badge: 'consistency' },
      { label: 'Categories', value: `${uniqueCategories}`, unit: 'types', badge: 'active' },
      { label: 'Daily Avg', value: avgHours, unit: 'hrs/day', badge: 'pace' },
    ];

    for (const m of metrics) {
      const card = grid.createEl('div', { cls: 'analytics-metric-card' });
      card.createEl('div', { text: m.label, cls: 'analytics-metric-title' });
      const row = card.createEl('div', { cls: 'analytics-metric-value-row' });
      const val = row.createEl('div', { text: m.value, cls: 'analytics-metric-value' });
      val.createEl('span', { text: m.unit });
      card.createEl('div', { text: m.badge, cls: 'analytics-metric-badge' });
    }
  }

  private getRangePeriodLabel(): string {
    const now = new Date();
    if (this.currentRange === 'month') {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - this.rangeOffset, 1);
      return targetDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else if (this.currentRange === 'year') {
      const targetYear = now.getFullYear() - this.rangeOffset;
      return `${targetYear}`;
    }
    return '';
  }

  private filterActivities(activities: Activity[], range: TimeRangeFilter, offset: number): Activity[] {
    const now = new Date();

    if (range === 'all') {
      return activities;
    }

    if (range === '30d') {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 30);
      return activities.filter((a) => {
        if (!a.date) return false;
        const d = new Date(a.date + 'T00:00:00');
        return d >= past30 && d <= now;
      });
    }

    if (range === 'month') {
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const start = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), 1);
      const end = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0, 23, 59, 59);

      return activities.filter((a) => {
        if (!a.date) return false;
        const d = new Date(a.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    }

    if (range === 'year') {
      const targetYear = now.getFullYear() - offset;
      const start = new Date(targetYear, 0, 1);
      const end = new Date(targetYear, 11, 31, 23, 59, 59);

      return activities.filter((a) => {
        if (!a.date) return false;
        const d = new Date(a.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    }

    return activities;
  }

  public async onClose(): Promise<void> {
    WeeklyProgressView.destroy();
    CategoryChartView.destroy();
  }
}
