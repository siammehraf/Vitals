import { App, Modal } from 'obsidian';
import { SpotifyStreamRecord } from './SpotifyModels';
import { SpotifyDataEngine } from './SpotifyDataEngine';

export class SpotifyDayDetailModal extends Modal {
  private dateStr: string;
  private streams: SpotifyStreamRecord[];
  private dataEngine: SpotifyDataEngine;

  constructor(app: App, dateStr: string, streams: SpotifyStreamRecord[], dataEngine: SpotifyDataEngine) {
    super(app);
    this.dateStr = dateStr;
    this.streams = streams;
    this.dataEngine = dataEngine;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('vitals-spotify-modal-container');

    const totalMs = this.streams.reduce((acc, s) => acc + s.msPlayed, 0);
    const totalHours = (totalMs / (1000 * 60 * 60)).toFixed(2);
    const dateFormatted = new Date(this.dateStr).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const header = contentEl.createEl('div', { cls: 'spotify-modal-header' });
    header.createEl('h3', { text: dateFormatted, cls: 'spotify-modal-title' });

    const metaRow = header.createEl('div', { cls: 'spotify-modal-meta-row' });
    metaRow.createEl('span', {
      text: `${this.streams.length} Streams`,
      cls: 'spotify-np-badge live-green',
    });
    metaRow.createEl('span', {
      text: `${totalHours} Total Hours`,
      cls: 'spotify-np-badge',
    });

    const listWrapper = contentEl.createEl('div', { cls: 'spotify-modal-scroll' });

    if (this.streams.length === 0) {
      listWrapper.createEl('p', {
        text: 'No streams recorded for this day.',
        cls: 'vitals-modal-empty',
      });
      return;
    }

    this.streams.forEach((stream, index) => {
      const row = listWrapper.createEl('div', { cls: 'spotify-recent-row' });

      const artWrapper = row.createEl('div', { cls: 'spotify-recent-art-wrapper' });
      if (stream.albumArt) {
        const img = artWrapper.createEl('img', { cls: 'spotify-recent-art' });
        img.src = stream.albumArt;
      } else {
        const initials = stream.trackName
          .split(/\s+/)
          .slice(0, 2)
          .map((w: string) => w[0]?.toUpperCase() || '')
          .join('');
        const badge = artWrapper.createEl('div', { cls: 'vitals-cover-badge track' });
        badge.createEl('span', { text: initials || '♪' });

        this.dataEngine.resolveCoverArt(stream.trackName, stream.artistName, 'track').then((url: string | null) => {
          if (url) {
            artWrapper.empty();
            const img = artWrapper.createEl('img', { cls: 'spotify-recent-art' });
            img.src = url;
          }
        });
      }

      const info = row.createEl('div', { cls: 'spotify-recent-info' });
      info.createEl('div', { text: `${index + 1}. ${stream.trackName}`, cls: 'spotify-recent-title' });
      info.createEl('div', {
        text: `${stream.artistName} • ${stream.albumName}`,
        cls: 'spotify-recent-artist',
      });

      const meta = row.createEl('div', { cls: 'spotify-recent-meta' });
      const timeStr = new Date(stream.ts).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      meta.createEl('div', { text: timeStr, cls: 'spotify-recent-timestamp' });

      const playedMins = Math.floor(stream.msPlayed / 60000);
      const playedSecs = Math.floor((stream.msPlayed % 60000) / 1000);
      meta.createEl('div', {
        text: `${playedMins}m ${playedSecs}s`,
        cls: 'spotify-recent-dur',
      });
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
