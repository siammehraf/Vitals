import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
import { CategorySummary } from '../../core/StatisticsEngine';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

export class CategoryChartView {
  private static chartInstance: Chart | null = null;

  public static render(container: HTMLElement, categories: CategorySummary[]): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const card = container.createEl('div', { cls: 'analytics-card category-chart-card' });

    const header = card.createEl('div', { cls: 'analytics-card-header' });
    header.createEl('div', { text: 'Category Analysis', cls: 'analytics-card-title' });

    if (categories.length === 0) {
      card.createEl('p', {
        text: 'No categorized activities in this period.',
        cls: 'analytics-empty-message',
      });
      return;
    }

    const chartWrapper = card.createEl('div', { cls: 'donut-chart-wrapper' });
    const canvas = chartWrapper.createEl('canvas');

    const labels = categories.map((c) => c.category);
    const dataValues = categories.map((c) => c.totalMinutes);

    const colors = ['#ef4444', '#84cc16', '#06b6d4', '#8b5cf6', '#3b82f6', '#f59e0b', '#10b981', '#ec4899'];

    this.chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: dataValues,
            backgroundColor: colors.slice(0, categories.length),
            borderColor: '#11141a',
            borderWidth: 3,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              font: {
                family: "'Geist Mono', ui-monospace, monospace",
                size: 11,
              },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (item) => {
                const totalMins = Number(item.raw);
                const hours = (totalMins / 60).toFixed(1);
                return ` ${hours} hrs (${totalMins} min)`;
              },
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
