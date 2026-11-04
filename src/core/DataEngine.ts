import { App, TFile } from 'obsidian';
import { Activity } from '../models/Activity';
import { VitalsSettings } from '../settings/VitalsSettings';

export class DataEngine {
  private app: App;
  private settings: VitalsSettings;

  constructor(app: App, settings: VitalsSettings) {
    this.app = app;
    this.settings = settings;
  }

  public updateSettings(settings: VitalsSettings): void {
    this.settings = settings;
  }

  public getActivities(): Activity[] {
    const files = this.app.vault.getMarkdownFiles();
    const activities: Activity[] = [];

    const includedList = this.settings.includedFolders
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const excludedList = this.settings.excludedFolders
      .split(',')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    for (const file of files) {
      // 1. Folder Whitelist Check
      if (includedList.length > 0) {
        const isIncluded = includedList.some((inc) => file.path.startsWith(inc + '/') || file.path === inc);
        if (!isIncluded) continue;
      }

      // 2. Folder Blacklist Check
      if (excludedList.length > 0) {
        const isExcluded = excludedList.some((exc) => file.path.startsWith(exc + '/') || file.path === exc);
        if (isExcluded) continue;
      }

      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) continue;

      const fm = cache.frontmatter;

      // 3. Duration check: only process notes with a duration property
      const rawDuration = this.findFrontmatterValue(fm, [
        'duration',
        'Duration',
        'DURATION',
        'spent',
        'Spent',
        'SPENT',
      ]);

      if (rawDuration === undefined || rawDuration === null) continue;

      const parsedMinutes = this.parseDurationToMinutes(rawDuration);
      if (parsedMinutes <= 0) continue;

      // 4. Type / Category check (Defaults to "Unknown" if missing)
      const rawType = this.findFrontmatterValue(fm, ['type', 'Type', 'TYPE', 'category', 'Category', 'CATEGORY']);
      const normalizedType = this.cleanType(rawType) || 'Unknown';

      // 5. Date check
      const rawDate = this.findFrontmatterValue(fm, ['date', 'Date', 'DATE', 'created', 'Created']);
      const normalizedDate = this.resolveDate(rawDate, file);

      // 6. Hour extraction (for Time-of-Day Punch Card)
      const rawTime = this.findFrontmatterValue(fm, ['time', 'Time', 'start', 'Start', 'start_time', 'startTime']);
      const parsedHour = this.resolveHour(rawTime, rawDate, file);

      // 7. Project check (optional)
      const rawProject = this.findFrontmatterValue(fm, ['project', 'Project', 'PROJECT']);

      activities.push({
        id: file.path,
        title: file.basename,
        type: normalizedType,
        date: normalizedDate,
        duration: parsedMinutes,
        project: rawProject ? String(rawProject).trim() : undefined,
        hour: parsedHour,
      });
    }

    return activities;
  }

  private findFrontmatterValue(frontmatter: Record<string, any>, candidates: string[]): any {
    const keys = Object.keys(frontmatter);
    for (const candidate of candidates) {
      const matchedKey = keys.find((k) => k.trim().toLowerCase() === candidate.trim().toLowerCase());
      if (matchedKey !== undefined && frontmatter[matchedKey] !== undefined && frontmatter[matchedKey] !== null) {
        return frontmatter[matchedKey];
      }
    }
    return undefined;
  }

  private cleanType(rawType: any): string | null {
    if (Array.isArray(rawType) && rawType.length > 0) {
      const str = String(rawType[0]).replace(/^#/, '').trim();
      return str.length > 0 ? str : null;
    }

    if (typeof rawType === 'string') {
      const str = rawType.replace(/^#/, '').trim();
      return str.length > 0 ? str : null;
    }

    return null;
  }

  private resolveDate(rawDate: any, file: TFile): string {
    if (rawDate) {
      if (typeof rawDate === 'string') {
        const trimmed = rawDate.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return trimmed;
        }
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } else if (rawDate instanceof Date) {
        return rawDate.toISOString().split('T')[0];
      }
    }

    const fallbackDate = new Date(file.stat.ctime);
    return fallbackDate.toISOString().split('T')[0];
  }

  private resolveHour(rawTime: any, rawDate: any, file: TFile): number {
    if (typeof rawTime === 'string') {
      const match = rawTime.trim().match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        const h = parseInt(match[1], 10);
        if (h >= 0 && h <= 23) return h;
      }
    } else if (typeof rawTime === 'number' && rawTime >= 0 && rawTime <= 23) {
      return Math.floor(rawTime);
    }

    if (typeof rawDate === 'string' && rawDate.includes('T')) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) return d.getHours();
    }

    return new Date(file.stat.ctime).getHours();
  }

  public parseDurationToMinutes(val: any): number {
    if (typeof val === 'number') {
      return !isNaN(val) && val > 0 ? Math.round(val) : 0;
    }

    if (Array.isArray(val)) {
      let total = 0;
      for (const item of val) {
        total += this.parseDurationToMinutes(item);
      }
      return Math.round(total);
    }

    if (typeof val === 'string') {
      const text = val.trim();
      if (!text) return 0;

      let totalMinutes = 0;
      let matchedAny = false;

      const hourRegex = /(\d+(?:\.\d+)?)\s*(?:h\b|hr\b|hrs\b|hours?\b|[hH])/gi;
      let hourMatch: RegExpExecArray | null;
      while ((hourMatch = hourRegex.exec(text)) !== null) {
        const hours = parseFloat(hourMatch[1]);
        if (!isNaN(hours)) {
          totalMinutes += hours * 60;
          matchedAny = true;
        }
      }

      const minRegex = /(\d+(?:\.\d+)?)\s*(?:m\b|min\b|mins\b|minutes?\b|[mM])/gi;
      let minMatch: RegExpExecArray | null;
      while ((minMatch = minRegex.exec(text)) !== null) {
        const mins = parseFloat(minMatch[1]);
        if (!isNaN(mins)) {
          totalMinutes += mins;
          matchedAny = true;
        }
      }

      if (matchedAny) {
        return Math.round(totalMinutes);
      }

      const bareNumberMatch = text.match(/\b\d+(?:\.\d+)?\b/);
      if (bareNumberMatch) {
        const num = parseFloat(bareNumberMatch[0]);
        if (!isNaN(num) && num > 0) {
          return Math.round(num);
        }
      }
    }

    return 0;
  }
}
