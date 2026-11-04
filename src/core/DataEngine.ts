import { App, TFile } from 'obsidian';
import { Activity } from '../models/Activity';

export class DataEngine {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  public getActivities(): Activity[] {
    const files = this.app.vault.getMarkdownFiles();
    const activities: Activity[] = [];

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) continue;

      const fm = cache.frontmatter;

      // 1. Duration check across case variants and keys
      const rawDuration = this.findFrontmatterValue(fm, [
        'duration',
        'Duration',
        'DURATION',
        'time',
        'Time',
        'TIME',
        'spent',
        'Spent',
      ]);

      if (rawDuration === undefined || rawDuration === null) continue;

      const parsedMinutes = this.parseDurationToMinutes(rawDuration);
      if (parsedMinutes <= 0) continue;

      // 2. Type/Category: property value or folder fallback
      const rawType = this.findFrontmatterValue(fm, [
        'type',
        'Type',
        'TYPE',
        'category',
        'Category',
        'CATEGORY',
        'tag',
        'tags',
      ]);
      const normalizedType = this.resolveType(rawType, file);

      // 3. Date: ISO format or file creation time fallback
      const rawDate = this.findFrontmatterValue(fm, ['date', 'Date', 'DATE', 'created', 'Created']);
      const normalizedDate = this.resolveDate(rawDate, file);

      // 4. Project: optional property
      const rawProject = this.findFrontmatterValue(fm, ['project', 'Project', 'PROJECT']);

      activities.push({
        id: file.path,
        title: file.basename,
        type: normalizedType,
        date: normalizedDate,
        duration: parsedMinutes,
        project: rawProject ? String(rawProject).trim() : undefined,
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

  private resolveType(rawType: any, file: TFile): string {
    if (rawType) {
      if (Array.isArray(rawType) && rawType.length > 0) {
        return String(rawType[0]).replace(/^#/, '').trim();
      }
      const str = String(rawType).trim();
      if (str.length > 0) {
        return str.replace(/^#/, '');
      }
    }

    if (file.parent && file.parent.name && file.parent.name !== '/' && file.parent.name !== '') {
      return file.parent.name;
    }

    return 'General';
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

      // Hours: 2H, 2h, 01.08H, 1.5 hrs, 2 hours
      const hourRegex = /(\d+(?:\.\d+)?)\s*(?:h\b|hr\b|hrs\b|hours?\b|[hH])/gi;
      let hourMatch: RegExpExecArray | null;
      while ((hourMatch = hourRegex.exec(text)) !== null) {
        const hours = parseFloat(hourMatch[1]);
        if (!isNaN(hours)) {
          totalMinutes += hours * 60;
          matchedAny = true;
        }
      }

      // Minutes: 80m, 80M, 45min, 15 minutes
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

      // Plain numbers without unit default to minutes
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
