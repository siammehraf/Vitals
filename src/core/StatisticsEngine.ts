import { Activity } from '../models/Activity';

export type TimeRange = '7d' | '30d' | 'month' | 'prev_month' | 'year' | 'prev_year' | 'all';

export interface CategorySummary {
  category: string;
  totalMinutes: number;
  totalHours: string;
  sessionCount: number;
  percentage: number;
}

export interface OverallStatistics {
  totalMinutes: number;
  totalHours: string;
  totalSessions: number;
  activeDaysCount: number;
  categories: CategorySummary[];
}

export class StatisticsEngine {
  public static filterActivities(activities: Activity[], range: TimeRange): Activity[] {
    if (range === 'all') return activities;

    const now = new Date();

    return activities.filter((act) => {
      if (!act.date) return false;
      const actDate = new Date(act.date + 'T00:00:00');
      if (isNaN(actDate.getTime())) return false;

      switch (range) {
        case '7d': {
          const limit = new Date(now);
          limit.setDate(limit.getDate() - 7);
          return actDate >= limit;
        }
        case '30d': {
          const limit = new Date(now);
          limit.setDate(limit.getDate() - 30);
          return actDate >= limit;
        }
        case 'month': {
          return actDate.getFullYear() === now.getFullYear() && actDate.getMonth() === now.getMonth();
        }
        case 'prev_month': {
          const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return (
            actDate.getFullYear() === prevMonthDate.getFullYear() && actDate.getMonth() === prevMonthDate.getMonth()
          );
        }
        case 'year': {
          return actDate.getFullYear() === now.getFullYear();
        }
        case 'prev_year': {
          return actDate.getFullYear() === now.getFullYear() - 1;
        }
        default:
          return true;
      }
    });
  }

  public static calculateOverall(activities: Activity[]): OverallStatistics {
    let totalMinutes = 0;
    const uniqueDays = new Set<string>();
    const categoryMap = new Map<string, { minutes: number; count: number }>();

    for (const act of activities) {
      totalMinutes += act.duration;

      if (act.date) {
        uniqueDays.add(act.date);
      }

      const cat = act.type || 'Uncategorized';
      const current = categoryMap.get(cat) || { minutes: 0, count: 0 };
      current.minutes += act.duration;
      current.count += 1;
      categoryMap.set(cat, current);
    }

    const categories: CategorySummary[] = [];
    for (const [category, data] of categoryMap.entries()) {
      const percentage = totalMinutes > 0 ? (data.minutes / totalMinutes) * 100 : 0;
      categories.push({
        category,
        totalMinutes: data.minutes,
        totalHours: (data.minutes / 60).toFixed(1),
        sessionCount: data.count,
        percentage: Number(percentage.toFixed(1)),
      });
    }

    categories.sort((a, b) => b.totalMinutes - a.totalMinutes);

    return {
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(1),
      totalSessions: activities.length,
      activeDaysCount: uniqueDays.size,
      categories,
    };
  }

  public static getActivitiesByCategory(activities: Activity[], category: string): Activity[] {
    return activities.filter((act) => act.type.toLowerCase() === category.toLowerCase());
  }
}
