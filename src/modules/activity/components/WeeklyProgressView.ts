import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Activity } from '../../../models/Activity';

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

export type ProgressViewMode = 'day' | 'week';

export class WeeklyProgressView {
  private static chartInstance: Chart | null = null;
  private static dayOffset: number = 0;
  private static weekOffset: number = 0;

  private static cardElement: HTMLElement | null = null;
  private static labelElement: HTMLElement | null = null;
  private static nextBtnElement: HTMLButtonElement | null = null;
  private static canvasElement: HTMLCanvasElement | null = null;

  public static render(
    container: HTMLElement,
    activities: Activity[],
    mode: ProgressViewMode,
    onModeChange: (mode: ProgressViewMode) => void,
  ): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const card = container.createEl('div', { cls: 'analytics-card weekly-chart-card' });
    this.cardElement = card;

    const header = card.createEl('div', { cls: 'analytics-card-header' });
    const titleArea = header.createEl('div', { cls: 'analytics-title-area-compact' });
    titleArea.createEl('div', { text: 'Activity Trend', cls: 'analytics-card-title' });

    const controls = header.createEl('div', { cls: 'trend-header-controls' });

    // [ ‹ Period Label › ]
    const navGroup = controls.createEl('div', { cls: 'analytics-pill-group trend-nav-group' });

    const prevBtn = navGroup.createEl('button', {
      text: '‹',
      cls: 'analytics-pill-btn trend-nav-arrow',
      attr: { 'aria-label': 'Previous' },
    });
    prevBtn.addEventListener('click', () => {
      if (mode === 'day') {
        this.dayOffset += 1;
      } else {
        this.weekOffset += 1;
      }
      this.updateViewInPlace(activities, mode);
    });

    this.labelElement = navGroup.createEl('span', {
      text: this.getActivePeriodLabel(mode),
      cls: 'trend-nav-current-label',
    });

    const isAtCurrent = mode === 'day' ? this.dayOffset === 0 : this.weekOffset === 0;

    const nextBtn = navGroup.createEl('button', {
      text: '›',
      cls: `analytics-pill-btn trend-nav-arrow ${isAtCurrent ? 'is-disabled' : ''}`,
      attr: { 'aria-label': 'Next' },
    }) as HTMLButtonElement;
    this.nextBtnElement = nextBtn;

    nextBtn.addEventListener('click', () => {
      const currentlyAtEnd = mode === 'day' ? this.dayOffset === 0 : this.weekOffset === 0;
      if (currentlyAtEnd) return;

      if (mode === 'day') {
        this.dayOffset = Math.max(0, this.dayOffset - 1);
      } else {
        this.weekOffset = Math.max(0, this.weekOffset - 1);
      }
      this.updateViewInPlace(activities, mode);
    });

    // Day / Week Switcher
    const toggleGroup = controls.createEl('div', { cls: 'analytics-pill-group' });
    const dayBtn = toggleGroup.createEl('button', {
      text: 'Day',
      cls: `analytics-pill-btn ${mode === 'day' ? 'is-active' : ''}`,
    });
    dayBtn.addEventListener('click', () => {
      this.dayOffset = 0;
      onModeChange('day');
    });

    const weekBtn = toggleGroup.createEl('button', {
      text: 'Week',
      cls: `analytics-pill-btn ${mode === 'week' ? 'is-active' : ''}`,
    });
    weekBtn.addEventListener('click', () => {
      this.weekOffset = 0;
      onModeChange('week');
    });

    const chartWrapper = card.createEl('div', { cls: 'weekly-chart-wrapper' });
    this.canvasElement = chartWrapper.createEl('canvas');

    this.buildChart(activities, mode);
  }

  private static updateViewInPlace(activities: Activity[], mode: ProgressViewMode): void {
    if (this.labelElement) {
      this.labelElement.textContent = this.getActivePeriodLabel(mode);
    }

    if (this.nextBtnElement) {
      const isAtCurrent = mode === 'day' ? this.dayOffset === 0 : this.weekOffset === 0;
      if (isAtCurrent) {
        this.nextBtnElement.classList.add('is-disabled');
      } else {
        this.nextBtnElement.classList.remove('is-disabled');
      }
    }

    this.buildChart(activities, mode);
  }

  private static buildChart(activities: Activity[], mode: ProgressViewMode): void {
    if (!this.canvasElement) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const labels: string[] = [];
    const tooltipTitles: string[] = [];
    const hoursData: number[] = [];
    const baseNow = new Date();

    if (mode === 'day') {
      const anchorDate = new Date(baseNow);
      anchorDate.setDate(baseNow.getDate() - this.dayOffset);

      for (let i = 6; i >= 0; i--) {
        const d = new Date(anchorDate);
        d.setDate(anchorDate.getDate() - i);

        const iso = this.formatDateISO(d);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayFormatted = this.formatDisplayDate(d);

        labels.push(`${dayName} (${d.getDate()})`);
        tooltipTitles.push(`${dayFormatted} - ${d.toLocaleDateString('en-US', { weekday: 'long' })}`);

        const mins = activities.filter((a) => a.date === iso).reduce((sum, a) => sum + a.duration, 0);
        hoursData.push(Number((mins / 60).toFixed(1)));
      }
    } else {
      const anchorEndDate = new Date(baseNow);
      anchorEndDate.setDate(baseNow.getDate() - this.weekOffset * 7);

      for (let w = 5; w >= 0; w--) {
        const end = new Date(anchorEndDate);
        end.setDate(anchorEndDate.getDate() - w * 7);

        const start = new Date(end);
        start.setDate(end.getDate() - 6);

        const startLabel = `${this.padZero(start.getDate())}/${this.padZero(start.getMonth() + 1)}`;
        const endLabel = `${this.padZero(end.getDate())}/${this.padZero(end.getMonth() + 1)}`;
        labels.push(`${startLabel} - ${endLabel}`);
        tooltipTitles.push(`${startLabel} - ${endLabel}`);

        const mins = activities
          .filter((a) => {
            if (!a.date) return false;
            const d = new Date(a.date + 'T00:00:00');
            return d >= start && d <= end;
          })
          .reduce((sum, a) => sum + a.duration, 0);

        hoursData.push(Number((mins / 60).toFixed(1)));
      }
    }

    this.chartInstance = new Chart(this.canvasElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Trend',
            data: hoursData,
            borderColor: '#14b8a6',
            borderWidth: 2,
            pointBackgroundColor: '#2dd4bf',
            pointBorderColor: '#0f172a',
            pointBorderWidth: 2,
            pointRadius: 4,
            tension: 0.35,
            order: 1,
          },
          {
            type: 'bar',
            label: 'Hours',
            data: hoursData,
            backgroundColor: 'rgba(20, 184, 166, 0.75)',
            hoverBackgroundColor: '#2dd4bf',
            borderRadius: 6,
            borderSkipped: false,
            barThickness: mode === 'day' ? 28 : 34,
            order: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex ?? 0;
                return tooltipTitles[idx] || '';
              },
              label: (ctx) => ` ${ctx.parsed.y} hrs`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#94a3b8',
              font: {
                family: "'Geist Mono', ui-monospace, monospace",
                size: 11,
              },
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: {
              color: '#64748b',
              font: {
                family: "'Geist Mono', ui-monospace, monospace",
                size: 10,
              },
              callback: (value) => `${value}h`,
            },
          },
        },
      },
    });
  }

  private static getActivePeriodLabel(mode: ProgressViewMode): string {
    const d = new Date();
    if (mode === 'day') {
      d.setDate(d.getDate() - this.dayOffset);
      if (this.dayOffset === 0) {
        return `Today (${this.formatDisplayDate(d)})`;
      }
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      return `${this.formatDisplayDate(d)} - ${dayName}`;
    } else {
      if (this.weekOffset === 0) {
        return 'Current Week';
      }
      return `${this.weekOffset}w ago`;
    }
  }

  private static formatDisplayDate(date: Date): string {
    const dd = this.padZero(date.getDate());
    const mm = this.padZero(date.getMonth() + 1);
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private static formatDateISO(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = this.padZero(date.getMonth() + 1);
    const dd = this.padZero(date.getDate());
    return `${yyyy}-${mm}-${dd}`;
  }

  private static padZero(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
  }

  public static destroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
    this.cardElement = null;
    this.labelElement = null;
    this.nextBtnElement = null;
    this.canvasElement = null;
  }
}
