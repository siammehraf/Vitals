import { ItemView, WorkspaceLeaf } from 'obsidian';
import { DataEngine } from '../core/DataEngine';
import { StatisticsEngine, TimeRange } from '../core/StatisticsEngine';
import { HeatmapView } from './components/HeatmapView';
import { CategoryChartView } from './components/CategoryChartView';
import { WeeklyProgressView, ProgressViewMode } from './components/WeeklyProgressView';

export const VIEW_TYPE_VITALS = 'vitals-dashboard-view';

export class DashboardView extends ItemView {
  private dataEngine: DataEngine;
  private selectedRange: TimeRange = 'all';
  private selectedYear: number = new Date().getFullYear();
  private progressMode: ProgressViewMode = 'day';

  constructor(leaf: WorkspaceLeaf, dataEngine: DataEngine) {
    super(leaf);
    this.dataEngine = dataEngine;
  }

  getViewType(): string {
    return VIEW_TYPE_VITALS;
  }

  getDisplayText(): string {
    return 'Vitals';
  }

  getIcon(): string {
    return 'activity';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  public render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass('activity-analytics-container');

    const allActivities = this.dataEngine.getActivities();
    const filteredActivities = StatisticsEngine.filterActivities(allActivities, this.selectedRange);
    const stats = StatisticsEngine.calculateOverall(filteredActivities);

    // 1. Top Header with Time Filters
    const topBar = container.createEl('div', { cls: 'analytics-top-bar' });
    const titleArea = topBar.createEl('div', { cls: 'analytics-title-area' });
    titleArea.createEl('h2', { text: 'Vitals' });

    // Time Range Filters
    const filters = topBar.createEl('div', { cls: 'analytics-pill-group global-filters' });
    const ranges: { key: TimeRange; label: string }[] = [
      { key: '7d', label: '7 Days' },
      { key: '30d', label: '30 Days' },
      { key: 'month', label: 'This Month' },
      { key: 'prev_month', label: 'Prev Month' },
      { key: 'year', label: 'This Year' },
      { key: 'prev_year', label: 'Prev Year' },
      { key: 'all', label: 'All Time' },
    ];

    for (const r of ranges) {
      const btn = filters.createEl('button', {
        text: r.label,
        cls: `analytics-pill-btn ${this.selectedRange === r.key ? 'is-active' : ''}`,
      });
      btn.addEventListener('click', () => {
        this.selectedRange = r.key;
        this.render();
      });
    }

    // 2. Metrics Cards Row
    const metricsGrid = container.createEl('div', { cls: 'analytics-metrics-grid' });
    this.renderMetricCard(metricsGrid, 'Total Tracked', stats.totalHours, 'hrs', this.getRangeLabel());
    this.renderMetricCard(metricsGrid, 'Sessions', `${stats.totalSessions}`, 'sessions', 'filtered');
    this.renderMetricCard(metricsGrid, 'Active Days', `${stats.activeDaysCount}`, 'days', 'consistency');
    this.renderMetricCard(metricsGrid, 'Categories', `${stats.categories.length}`, 'types', 'active');

    // 3. GitHub Contribution Heatmap with Year Switcher
    HeatmapView.render(container, allActivities, this.selectedYear, (newYear) => {
      this.selectedYear = newYear;
      this.render();
    });

    // 4. Two-Column Chart Layout (Trend + Category Donut)
    const chartsRow = container.createEl('div', { cls: 'analytics-charts-row' });
    WeeklyProgressView.render(chartsRow, filteredActivities, this.progressMode, (newMode) => {
      this.progressMode = newMode;
      this.render();
    });
    CategoryChartView.render(chartsRow, stats.categories);
  }

  private getRangeLabel(): string {
    switch (this.selectedRange) {
      case '7d':
        return 'last 7 days';
      case '30d':
        return 'last 30 days';
      case 'month':
        return 'this month';
      case 'prev_month':
        return 'last month';
      case 'year':
        return 'this year';
      case 'prev_year':
        return 'last year';
      default:
        return 'all time';
    }
  }

  private renderMetricCard(parent: HTMLElement, title: string, value: string, unit: string, badgeText: string): void {
    const card = parent.createEl('div', { cls: 'analytics-metric-card' });
    card.createEl('div', { text: title, cls: 'analytics-metric-title' });

    const valRow = card.createEl('div', { cls: 'analytics-metric-value-row' });
    const valueEl = valRow.createEl('div', { cls: 'analytics-metric-value', text: value });
    valueEl.createEl('span', { text: unit });

    card.createEl('div', { text: badgeText, cls: 'analytics-metric-badge' });
  }

  async onClose(): Promise<void> {
    CategoryChartView.destroy();
    WeeklyProgressView.destroy();
  }
}
