import { App } from 'obsidian';
import { Activity } from '../models/Activity';

export class DataEngine {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  public getActivities(): Activity[] {
    const activities: Activity[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;

      if (frontmatter && frontmatter.type && frontmatter.duration !== undefined) {
        const rawDate = frontmatter.date ? String(frontmatter.date).trim() : '';
        const durationNum = Number(frontmatter.duration);

        if (!isNaN(durationNum) && durationNum > 0) {
          activities.push({
            filePath: file.path,
            type: String(frontmatter.type).trim(),
            date: rawDate,
            duration: durationNum,
            tags: Array.isArray(frontmatter.tags)
              ? frontmatter.tags
              : frontmatter.tags
                ? [String(frontmatter.tags)]
                : [],
            project: frontmatter.project ? String(frontmatter.project).trim() : undefined,
            notes: frontmatter.notes ? String(frontmatter.notes).trim() : undefined,
          });
        }
      }
    }

    return activities;
  }
}
