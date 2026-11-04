import { ItemView, WorkspaceLeaf, Notice, TFile, Menu } from 'obsidian';
import { Activity } from '../models/Activity';
import { DataEngine } from '../core/DataEngine';
import { VitalsSettings } from '../settings/VitalsSettings';
import { HeatmapView } from './components/HeatmapView';
import { WeeklyProgressView, ProgressViewMode } from './components/WeeklyProgressView';
import { CategoryChartView } from './components/CategoryChartView';
import { TimeOfDayView } from './components/TimeOfDayView';

export const DASHBOARD_VIEW_TYPE = 'vitals-dashboard-view';
export const VIEW_TYPE_VITALS = DASHBOARD_VIEW_TYPE;

export type TimeRangeFilter = 'day' | '30d' | 'month' | 'year' | 'all';

export class DashboardView extends ItemView {
  private dataEngine: DataEngine;
  private settings: VitalsSettings;
  private currentRange: TimeRangeFilter = '30d';
  private rangeOffset: number = 0;
  private progressMode: ProgressViewMode = 'day';

  // Project Filtering State
  private selectedProject: string = 'all';

  // Activity Feed State
  private feedDayOffset: number | null = 0;
  private feedPageIndex: number = 0;
  private readonly FEED_PAGE_SIZE: number = 15;
  private feedCardEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, dataEngine: DataEngine, settings: VitalsSettings) {
    super(leaf);
    this.dataEngine = dataEngine;
    this.settings = settings;
  }

  public updateSettings(settings: VitalsSettings): void {
    this.settings = settings;
    this.render();
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

    // Dynamic theme preset classes with default fallback
    const activeTheme = this.settings?.themePreset || 'vitals-stealth';
    container.removeClass(
      'theme-vitals-stealth',
      'theme-github-dark',
      'theme-github-light',
      'theme-nord-frost',
      'theme-obsidian-native',
    );
    container.addClass(`theme-${activeTheme}`);

    const rawActivities = this.dataEngine.getActivities();

    // 1. Extract Unique Projects for the Selector
    const projectCounts: Record<string, number> = {};
    for (const a of rawActivities) {
      if (a.project) {
        projectCounts[a.project] = (projectCounts[a.project] || 0) + 1;
      }
    }
    const uniqueProjects = Object.keys(projectCounts).sort();

    // Filter activities by selected project across the entire dashboard
    const allActivities =
      this.selectedProject === 'all' ? rawActivities : rawActivities.filter((a) => a.project === this.selectedProject);

    // Top Header & Compact Controls
    const topBar = container.createEl('div', { cls: 'analytics-top-bar' });
    const titleArea = topBar.createEl('div', { cls: 'analytics-title-area' });
    titleArea.createEl('h2', { text: 'Vitals' });

    const filterContainer = topBar.createEl('div', { cls: 'analytics-top-controls' });

    // Native Obsidian Project Menu Popover
    if (uniqueProjects.length > 0) {
      const projectPill = filterContainer.createEl('button', {
        cls: `analytics-pill-btn project-pill-btn ${this.selectedProject !== 'all' ? 'is-active' : ''}`,
      });

      const currentLabel = this.selectedProject === 'all' ? 'All Projects' : `@${this.selectedProject}`;
      projectPill.createEl('span', { text: currentLabel });
      projectPill.createEl('span', { text: ' ▾', cls: 'project-pill-arrow' });

      projectPill.addEventListener('click', (evt: MouseEvent) => {
        const menu = new Menu();

        menu.addItem((item) => {
          item
            .setTitle('All Projects')
            .setChecked(this.selectedProject === 'all')
            .onClick(() => {
              this.selectedProject = 'all';
              this.feedPageIndex = 0;
              this.render();
            });
        });

        menu.addSeparator();

        for (const proj of uniqueProjects) {
          menu.addItem((item) => {
            item
              .setTitle(`@${proj} (${projectCounts[proj]})`)
              .setChecked(this.selectedProject === proj)
              .onClick(() => {
                this.selectedProject = proj;
                this.feedPageIndex = 0;
                this.render();
              });
          });
        }

        menu.showAtMouseEvent(evt);
      });
    }

    // Export Buttons: [ CSV | MD ]
    const exportGroup = filterContainer.createEl('div', { cls: 'analytics-pill-group' });
    const csvBtn = exportGroup.createEl('button', {
      text: 'CSV',
      cls: 'analytics-pill-btn',
      attr: { 'aria-label': 'Export visible data as CSV' },
    });
    csvBtn.addEventListener('click', () => {
      this.exportCSV(filteredActivities);
    });

    const mdBtn = exportGroup.createEl('button', {
      text: 'MD',
      cls: 'analytics-pill-btn',
      attr: { 'aria-label': 'Export visible summary as Markdown' },
    });
    mdBtn.addEventListener('click', () => {
      this.exportMarkdown(filteredActivities);
    });

    // Stepped Navigation (‹ Label ›) for Day, Month, and Year
    if (this.currentRange === 'day' || this.currentRange === 'month' || this.currentRange === 'year') {
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

    // Range Switcher: [ Day | 30D | Month | Year | All ]
    const pillGroup = filterContainer.createEl('div', { cls: 'analytics-pill-group' });
    const ranges: { key: TimeRangeFilter; label: string }[] = [
      { key: 'day', label: 'Day' },
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
    const prevActivities = this.getPreviousPeriodActivities(allActivities, this.currentRange, this.rangeOffset);

    // 1. Metric Cards with Comparison Deltas
    this.renderMetricCards(container, filteredActivities, prevActivities);

    // 2. Consistency Heatmap (with Year Selector)
    HeatmapView.render(container, allActivities, this.app);

    // 2.5 Time-of-Day Hourly Punch Card
    TimeOfDayView.render(container, filteredActivities);

    // 3. Lower Row: Trend & Donut/Bar
    const chartsRow = container.createEl('div', { cls: 'analytics-charts-row' });

    WeeklyProgressView.render(chartsRow, allActivities, this.progressMode, (newMode) => {
      this.progressMode = newMode;
      this.render();
    });

    CategoryChartView.render(chartsRow, filteredActivities, this.settings.categoryColors);

    // 4. Dynamic Activity Feed Table (In-Place Scroll Preservation)
    this.feedCardEl = container.createEl('div', { cls: 'analytics-card vitals-recent-card' });
    this.renderActivityFeedInPlace(allActivities);
  }

  /**
   * Metric summary cards with percentage comparison deltas
   */
  private renderMetricCards(container: HTMLElement, activities: Activity[], prevActivities: Activity[]): void {
    const grid = container.createEl('div', { cls: 'analytics-metrics-grid' });

    const totalMinutes = activities.reduce((sum, a) => sum + a.duration, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    const prevMinutes = prevActivities.reduce((sum, a) => sum + a.duration, 0);
    const timeDelta = this.calculateDelta(totalMinutes, prevMinutes);

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const loggedBadge = h > 0 ? `${h}h ${m}m logged` : `${m}m logged`;

    const activeDaysSet = new Set(activities.map((a) => a.date).filter(Boolean));
    const activeDays = activeDaysSet.size;
    const prevActiveDaysSet = new Set(prevActivities.map((a) => a.date).filter(Boolean));
    const daysDelta = this.calculateDelta(activeDays, prevActiveDaysSet.size);

    const uniqueCategories = new Set(activities.map((a) => a.type).filter(Boolean)).size;

    const avgMinutesPerDay = activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0;
    const avgHours = (avgMinutesPerDay / 60).toFixed(1);

    const metrics = [
      {
        label: 'Total Time',
        value: totalHours,
        unit: 'hrs',
        badge: loggedBadge,
        delta: timeDelta,
      },
      {
        label: 'Active Days',
        value: `${activeDays}`,
        unit: 'days',
        badge: 'consistency',
        delta: daysDelta,
      },
      {
        label: 'Categories',
        value: `${uniqueCategories}`,
        unit: 'types',
        badge: 'active',
        delta: null,
      },
      {
        label: 'Daily Avg',
        value: avgHours,
        unit: 'hrs/day',
        badge: 'pace',
        delta: null,
      },
    ];

    for (const m of metrics) {
      const card = grid.createEl('div', { cls: 'analytics-metric-card' });
      const topRow = card.createEl('div', { cls: 'analytics-metric-top-row' });
      topRow.createEl('div', { text: m.label, cls: 'analytics-metric-title' });

      if (m.delta && this.currentRange !== 'all') {
        const deltaEl = topRow.createEl('span', {
          text: m.delta.text,
          cls: `analytics-metric-delta ${m.delta.positive ? 'delta-up' : m.delta.neutral ? 'delta-neutral' : 'delta-down'}`,
        });
        deltaEl.setAttribute('aria-label', 'vs previous period');
      }

      const row = card.createEl('div', { cls: 'analytics-metric-value-row' });
      const val = row.createEl('div', { text: m.value, cls: 'analytics-metric-value' });
      val.createEl('span', { text: m.unit });
      card.createEl('div', { text: m.badge, cls: 'analytics-metric-badge' });
    }
  }

  /**
   * Re-renders strictly the Activity Feed element in-place to preserve view scroll position
   */
  private renderActivityFeedInPlace(allActivities: Activity[]): void {
    if (!this.feedCardEl) return;
    const card = this.feedCardEl;
    card.empty();

    const header = card.createEl('div', { cls: 'analytics-card-header' });
    const titleArea = header.createEl('div', { cls: 'analytics-title-area-compact' });
    titleArea.createEl('div', { text: 'Activity Feed', cls: 'analytics-card-title' });

    const todayIso = this.getDateISO(0);
    const todayActivities = allActivities.filter((a) => a.date === todayIso);

    let targetDateIso: string | null = null;
    let isFallbackMode = false;

    if (this.feedDayOffset === 0 && todayActivities.length === 0) {
      isFallbackMode = true;
    } else if (this.feedDayOffset !== null) {
      targetDateIso = this.getDateISO(this.feedDayOffset);
    }

    const controls = header.createEl('div', { cls: 'feed-header-controls' });
    const navGroup = controls.createEl('div', { cls: 'analytics-pill-group' });

    // Previous Day Button (‹)
    const prevDayBtn = navGroup.createEl('button', {
      text: '‹',
      cls: 'analytics-pill-btn',
      attr: { 'aria-label': 'Previous Day' },
    });
    prevDayBtn.addEventListener('click', () => {
      if (isFallbackMode) {
        this.feedDayOffset = 1;
      } else {
        this.feedDayOffset = (this.feedDayOffset ?? 0) + 1;
      }
      this.feedPageIndex = 0;
      this.renderActivityFeedInPlace(allActivities);
    });

    // Date / Context Badge
    let labelText = '';
    if (isFallbackMode) {
      labelText = 'Latest Activities';
    } else if (this.feedDayOffset === 0) {
      labelText = `Today (${targetDateIso})`;
    } else if (this.feedDayOffset === 1) {
      labelText = `Yesterday (${targetDateIso})`;
    } else {
      labelText = targetDateIso || '';
    }

    navGroup.createEl('span', {
      text: labelText,
      cls: 'trend-nav-current-label',
    });

    // Next Day Button (›) — disabled if we are at Today
    const isAtToday = this.feedDayOffset === 0;
    const nextDayBtn = navGroup.createEl('button', {
      text: '›',
      cls: `analytics-pill-btn ${isAtToday ? 'is-disabled' : ''}`,
      attr: { 'aria-label': 'Next Day' },
    });
    if (!isAtToday) {
      nextDayBtn.addEventListener('click', () => {
        if (this.feedDayOffset !== null && this.feedDayOffset > 0) {
          this.feedDayOffset -= 1;
          this.feedPageIndex = 0;
          this.renderActivityFeedInPlace(allActivities);
        }
      });
    }

    // Reset to "Today" Button
    const todayBtn = controls.createEl('button', {
      text: 'Today',
      cls: `analytics-pill-btn ${this.feedDayOffset === 0 && !isFallbackMode ? 'is-active' : ''}`,
    });
    todayBtn.addEventListener('click', () => {
      this.feedDayOffset = 0;
      this.feedPageIndex = 0;
      this.renderActivityFeedInPlace(allActivities);
    });

    // Resolve filtered list
    let feedList: Activity[] = [];
    if (isFallbackMode) {
      feedList = [...allActivities].filter((a) => a.date).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } else {
      feedList = allActivities.filter((a) => a.date === targetDateIso).sort((a, b) => b.duration - a.duration);
    }

    if (feedList.length === 0) {
      card.createEl('p', {
        text: `No activities logged for ${labelText}.`,
        cls: 'analytics-empty-message',
      });
      return;
    }

    // Pagination slice (15 items per page)
    const totalItems = feedList.length;
    const totalPages = Math.ceil(totalItems / this.FEED_PAGE_SIZE);
    const startIdx = this.feedPageIndex * this.FEED_PAGE_SIZE;
    const pagedList = feedList.slice(startIdx, startIdx + this.FEED_PAGE_SIZE);

    const tableWrapper = card.createEl('div', { cls: 'vitals-table-wrapper' });
    const table = tableWrapper.createEl('table', { cls: 'vitals-recent-table' });

    // Table Header
    const thead = table.createEl('thead');
    const hRow = thead.createEl('tr');
    hRow.createEl('th', { text: 'Date' });
    hRow.createEl('th', { text: 'Note / Session' });
    hRow.createEl('th', { text: 'Category' });
    hRow.createEl('th', { text: 'Duration' });
    hRow.createEl('th', { text: 'Project' });

    // Table Body
    const tbody = table.createEl('tbody');
    for (const act of pagedList) {
      const row = tbody.createEl('tr');

      // Date
      row.createEl('td', { text: act.date || '-', cls: 'vitals-td-date' });

      // Note Link
      const noteCell = row.createEl('td', { cls: 'vitals-td-note' });
      const link = noteCell.createEl('a', { text: act.title, cls: 'vitals-note-link' });
      link.addEventListener('click', async () => {
        const file = this.app.vault.getAbstractFileByPath(act.id);
        if (file instanceof TFile) {
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(file);
        }
      });

      // Category Badge
      const catCell = row.createEl('td');
      const badge = catCell.createEl('span', { text: act.type, cls: 'vitals-item-badge' });
      if (this.settings.categoryColors[act.type]) {
        badge.style.color = this.settings.categoryColors[act.type];
        badge.style.borderColor = this.settings.categoryColors[act.type];
        badge.style.backgroundColor = `${this.settings.categoryColors[act.type]}1a`;
      }

      // Duration
      const durHours = (act.duration / 60).toFixed(1);
      const durCell = row.createEl('td', { cls: 'vitals-td-dur' });
      durCell.createEl('span', { text: `${durHours}h ` });
      durCell.createEl('small', { text: `(${act.duration}m)` });

      // Project
      row.createEl('td', { text: act.project ? `@${act.project}` : '-', cls: 'vitals-td-proj' });
    }

    // Pagination Footer
    if (totalItems > this.FEED_PAGE_SIZE) {
      const footer = card.createEl('div', { cls: 'feed-pagination-footer' });

      const prevPageBtn = footer.createEl('button', {
        text: '‹ 15 Earlier',
        cls: `analytics-pill-btn ${this.feedPageIndex + 1 >= totalPages ? 'is-disabled' : ''}`,
      });
      prevPageBtn.addEventListener('click', () => {
        if (this.feedPageIndex + 1 < totalPages) {
          this.feedPageIndex += 1;
          this.renderActivityFeedInPlace(allActivities);
        }
      });

      footer.createEl('span', {
        text: `Showing ${startIdx + 1}–${Math.min(startIdx + this.FEED_PAGE_SIZE, totalItems)} of ${totalItems}`,
        cls: 'feed-page-indicator',
      });

      const nextPageBtn = footer.createEl('button', {
        text: '15 Later ›',
        cls: `analytics-pill-btn ${this.feedPageIndex === 0 ? 'is-disabled' : ''}`,
      });
      nextPageBtn.addEventListener('click', () => {
        if (this.feedPageIndex > 0) {
          this.feedPageIndex -= 1;
          this.renderActivityFeedInPlace(allActivities);
        }
      });
    }
  }

  private getDateISO(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    return this.formatDateISO(d);
  }

  private calculateDelta(current: number, previous: number): { text: string; positive: boolean; neutral: boolean } {
    if (previous === 0) {
      if (current === 0) return { text: '0%', positive: false, neutral: true };
      return { text: '+100%', positive: true, neutral: false };
    }
    const diff = current - previous;
    const percent = Math.round((diff / previous) * 100);
    if (percent === 0) return { text: '0%', positive: false, neutral: true };
    const text = percent > 0 ? `+${percent}%` : `${percent}%`;
    return { text, positive: percent > 0, neutral: false };
  }

  private getPreviousPeriodActivities(activities: Activity[], range: TimeRangeFilter, offset: number): Activity[] {
    const now = new Date();

    if (range === 'day') {
      const prevDate = new Date(now);
      prevDate.setDate(now.getDate() - (offset + 1));
      const prevIso = this.formatDateISO(prevDate);
      return activities.filter((a) => a.date === prevIso);
    }

    if (range === '30d') {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 30);
      const past60 = new Date(now);
      past60.setDate(now.getDate() - 60);

      return activities.filter((a) => {
        if (!a.date) return false;
        const d = new Date(a.date + 'T00:00:00');
        return d >= past60 && d < past30;
      });
    }

    if (range === 'month') {
      return this.filterActivities(activities, 'month', offset + 1);
    }

    if (range === 'year') {
      return this.filterActivities(activities, 'year', offset + 1);
    }

    return [];
  }

  private exportCSV(activities: Activity[]): void {
    if (activities.length === 0) {
      new Notice('No activities available to export.');
      return;
    }

    const headers = ['Title', 'Category', 'Date', 'Duration (Minutes)', 'Duration (Hours)', 'Project', 'File Path'];
    const rows = activities.map((a) => [
      `"${a.title.replace(/"/g, '""')}"`,
      `"${a.type.replace(/"/g, '""')}"`,
      `"${a.date || ''}"`,
      a.duration,
      (a.duration / 60).toFixed(2),
      `"${(a.project || '').replace(/"/g, '""')}"`,
      `"${a.id.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    this.downloadFile(csvContent, `vitals-export-${this.currentRange}.csv`, 'text/csv;charset=utf-8;');
    new Notice('Exported activities to CSV.');
  }

  private exportMarkdown(activities: Activity[]): void {
    if (activities.length === 0) {
      new Notice('No activities available to export.');
      return;
    }

    const totalMinutes = activities.reduce((sum, a) => sum + a.duration, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    let md = `# Vitals Activity Export (${this.currentRange.toUpperCase()})\n\n`;
    md += `**Total Logged Time:** ${totalHours} hrs (${totalMinutes} mins)  \n`;
    md += `**Total Notes:** ${activities.length}  \n\n`;
    md += `| Date | Title | Category | Duration | Project |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;

    for (const a of activities) {
      const dur = `${(a.duration / 60).toFixed(1)}h (${a.duration}m)`;
      md += `| ${a.date || 'N/A'} | [[${a.title}]] | ${a.type} | ${dur} | ${a.project || '-'} |\n`;
    }

    this.downloadFile(md, `vitals-summary-${this.currentRange}.md`, 'text/markdown;charset=utf-8;');
    new Notice('Exported activities to Markdown.');
  }

  private downloadFile(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private getRangePeriodLabel(): string {
    const now = new Date();
    if (this.currentRange === 'day') {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - this.rangeOffset);
      if (this.rangeOffset === 0) {
        return `Today (${this.formatDisplayDate(targetDate)})`;
      }
      return `${this.formatDisplayDate(targetDate)}`;
    } else if (this.currentRange === 'month') {
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

    if (range === 'day') {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - offset);
      const iso = this.formatDateISO(targetDate);
      return activities.filter((a) => a.date === iso);
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

  private formatDateISO(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatDisplayDate(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  public async onClose(): Promise<void> {
    WeeklyProgressView.destroy();
    CategoryChartView.destroy();
    this.feedCardEl = null;
  }
}
