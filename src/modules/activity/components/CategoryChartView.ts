import {
  Chart,
  DoughnutController,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Activity } from '../../../models/Activity';

Chart.register(DoughnutController, ArcElement, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export type CategoryViewType = 'ring' | 'bar';

export class CategoryChartView {
  private static chartInstance: Chart | null = null;
  private static currentViewType: CategoryViewType = 'ring';

  public static render(
    container: HTMLElement,
    activities: Activity[],
    customColors: Record<string, string> = {},
  ): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const card = container.createEl('div', { cls: 'analytics-card donut-card' });
    const header = card.createEl('div', { cls: 'analytics-card-header' });
    header.createEl('div', { text: 'Category Distribution', cls: 'analytics-card-title' });

    // Mode Switcher: [ Ring | Bar ]
    const toggleGroup = header.createEl('div', { cls: 'analytics-pill-group' });
    const ringBtn = toggleGroup.createEl('button', {
      text: 'Ring',
      cls: `analytics-pill-btn ${this.currentViewType === 'ring' ? 'is-active' : ''}`,
    });
    const barBtn = toggleGroup.createEl('button', {
      text: 'Bar',
      cls: `analytics-pill-btn ${this.currentViewType === 'bar' ? 'is-active' : ''}`,
    });

    ringBtn.addEventListener('click', () => {
      if (this.currentViewType === 'ring') return;
      this.currentViewType = 'ring';
      ringBtn.addClass('is-active');
      barBtn.removeClass('is-active');
      this.rebuildChart(chartWrapper, activities, customColors);
    });

    barBtn.addEventListener('click', () => {
      if (this.currentViewType === 'bar') return;
      this.currentViewType = 'bar';
      barBtn.addClass('is-active');
      ringBtn.removeClass('is-active');
      this.rebuildChart(chartWrapper, activities, customColors);
    });

    const chartWrapper = card.createEl('div', { cls: 'donut-chart-wrapper' });
    this.rebuildChart(chartWrapper, activities, customColors);
  }

  private static rebuildChart(
    wrapper: HTMLElement,
    activities: Activity[],
    customColors: Record<string, string>,
  ): void {
    wrapper.empty();

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const categoryTotals: Record<string, number> = {};
    for (const a of activities) {
      const cat = a.type || 'Unknown';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + a.duration;
    }

    const sortedEntries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const labels = sortedEntries.map(([name]) => name);
    const dataValues = sortedEntries.map(([, mins]) => Number((mins / 60).toFixed(1)));

    if (labels.length === 0 || dataValues.every((v) => v === 0)) {
      wrapper.createEl('p', {
        text: 'No activity recorded for this period.',
        cls: 'analytics-empty-message',
      });
      return;
    }

    const canvas = wrapper.createEl('canvas');

    const fallbackPalette = [
      '#14b8a6', // teal
      '#38bdf8', // bright sky blue
      '#818cf8', // indigo
      '#f43f5e', // rose
      '#fbbf24', // amber
      '#a855f7', // purple
      '#34d399', // emerald
    ];

    const sliceColors = labels.map((label, idx) => {
      return customColors[label] || fallbackPalette[idx % fallbackPalette.length];
    });

    if (this.currentViewType === 'ring') {
      this.chartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [
            {
              data: dataValues,
              backgroundColor: sliceColors,
              borderColor: '#11141a',
              borderWidth: 2,
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
          cutout: '72%',
          layout: {
            padding: { top: 6, bottom: 8 },
          },
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                color: '#e2e8f0',
                usePointStyle: true,
                pointStyle: 'rectRounded',
                boxWidth: 8,
                boxHeight: 8,
                padding: 14,
                font: {
                  family: "'Geist Mono', ui-monospace, SFMono-Regular, monospace",
                  size: 11,
                  weight: 'bold',
                },
              },
            },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              titleColor: '#f8fafc',
              bodyColor: '#e2e8f0',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              titleFont: {
                family: "'Geist Mono', monospace",
                size: 12,
                weight: 'bold',
              },
              bodyFont: {
                family: "'Geist Mono', monospace",
                size: 11,
              },
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.parsed} hrs`,
              },
            },
          },
        },
      });
    } else {
      // Horizontal bar configuration without 'axis' property inside dataset
      this.chartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              data: dataValues,
              backgroundColor: sliceColors,
              borderRadius: 5,
              borderSkipped: false,
              barThickness: 16,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              titleColor: '#f8fafc',
              bodyColor: '#e2e8f0',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              titleFont: {
                family: "'Geist Mono', monospace",
                size: 12,
                weight: 'bold',
              },
              bodyFont: {
                family: "'Geist Mono', monospace",
                size: 11,
              },
              callbacks: {
                label: (ctx) => ` ${ctx.parsed.x} hrs`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(148, 163, 184, 0.08)' },
              ticks: {
                color: '#64748b',
                font: {
                  family: "'Geist Mono', monospace",
                  size: 10,
                },
                callback: (v) => `${v}h`,
              },
            },
            y: {
              grid: { display: false },
              ticks: {
                color: '#e2e8f0',
                font: {
                  family: "'Geist Mono', monospace",
                  size: 11,
                  weight: 'bold',
                },
              },
            },
          },
        },
      });
    }
  }

  public static destroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }
}
