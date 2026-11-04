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
import { Activity } from '../../models/Activity';

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

    const header = card.createEl('div', { cls: 'analytics-card-header' });
    header.createEl('div', { text: 'Activity Trend', cls: 'analytics-card-title' });

    const toggleGroup = header.createEl('div', { cls: 'analytics-pill-group' });
    const dayBtn = toggleGroup.createEl('button', {
      text: 'Day',
      cls: `analytics-pill-btn ${mode === 'day' ? 'is-active' : ''}`,
    });
    dayBtn.addEventListener('click', () => onModeChange('day'));

    const weekBtn = toggleGroup.createEl('button', {
      text: 'Week',
      cls: `analytics-pill-btn ${mode === 'week' ? 'is-active' : ''}`,
    });
    weekBtn.addEventListener('click', () => onModeChange('week'));

    const labels: string[] = [];
    const hoursData: number[] = [];
    const today = new Date();

    if (mode === 'day') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(label);

        const mins = activities.filter((a) => a.date === iso).reduce((sum, a) => sum + a.duration, 0);
        hoursData.push(Number((mins / 60).toFixed(1)));
      }
    } else {
      for (let w = 5; w >= 0; w--) {
        const end = new Date();
        end.setDate(today.getDate() - w * 7);
        const start = new Date(end);
        start.setDate(end.getDate() - 6);

        labels.push(`W-${w === 0 ? 'Now' : w}`);

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

    const chartWrapper = card.createEl('div', { cls: 'weekly-chart-wrapper' });
    const canvas = chartWrapper.createEl('canvas');

    this.chartInstance = new Chart(canvas, {
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
            callbacks: {
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

  public static destroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }
}
