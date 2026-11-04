import { Chart, DoughnutController, ArcElement, Tooltip } from 'chart.js';
import { Activity } from '../../models/Activity';

Chart.register(DoughnutController, ArcElement, Tooltip);

export class CategoryChartView {
  private static chartInstance: Chart | null = null;

  public static render(container: HTMLElement, activities: Activity[]): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const card = container.createEl('div', { cls: 'analytics-card donut-card' });
    const header = card.createEl('div', { cls: 'analytics-card-header' });
    header.createEl('div', { text: 'Category Distribution', cls: 'analytics-card-title' });

    // Aggregate durations by category
    const categoryTotals: Record<string, number> = {};
    for (const a of activities) {
      const cat = a.type || 'General';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + a.duration;
    }

    const labels = Object.keys(categoryTotals);
    const dataValues = labels.map((cat) => Number((categoryTotals[cat] / 60).toFixed(1)));

    if (labels.length === 0 || dataValues.every((v) => v === 0)) {
      card.createEl('p', { text: 'No activity recorded for this period.', cls: 'analytics-empty-message' });
      return;
    }

    const chartWrapper = card.createEl('div', { cls: 'donut-chart-wrapper' });
    const canvas = chartWrapper.createEl('canvas');

    const palette = [
      '#14b8a6', // teal
      '#38bdf8', // bright sky blue
      '#818cf8', // indigo
      '#f43f5e', // rose
      '#fbbf24', // amber
      '#a855f7', // purple
      '#34d399', // emerald
    ];

    const sliceColors = palette.slice(0, labels.length);

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
            borderAlign: 'inner',
            spacing: 0,
            hoverOffset: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
        cutout: '72%',
        layout: {
          padding: 6,
        },
        plugins: {
          legend: {
            display: false,
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
        elements: {
          arc: {
            borderJoinStyle: 'round',
          },
        },
      },
      plugins: [
        {
          id: 'enforceMinArc',
          beforeUpdate(chart) {
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || meta.data.length <= 1) return;

            const minRadians = 0.09;
            const total = (meta.controller as any)._getDataset().data.reduce((a: number, b: number) => a + b, 0);
            if (total === 0) return;

            meta.data.forEach((element: any, i: number) => {
              const val = Number((chart.data.datasets[0].data as number[])[i]);
              if (val > 0 && element.circumference !== undefined && element.circumference < minRadians) {
                element.circumference = minRadians;
              }
            });
          },
        },
      ],
    });

    // Native HTML legend
    const legendContainer = card.createEl('div', { cls: 'donut-html-legend' });
    labels.forEach((label, idx) => {
      const item = legendContainer.createEl('div', { cls: 'donut-legend-item' });
      const dot = item.createEl('span', { cls: 'donut-legend-dot' });
      dot.style.backgroundColor = sliceColors[idx];
      item.createEl('span', { text: label });
    });
  }

  public static destroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }
}
