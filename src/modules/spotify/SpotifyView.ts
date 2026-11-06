/* ==========================================================================
   Imports & Dependencies
   ========================================================================== */

import { App, Notice } from 'obsidian';
import { VitalsSettings } from '../../settings/VitalsSettings';
import { VitalsModuleView } from '../../models/ModuleView';
import { SpotifyDataEngine } from './SpotifyDataEngine';
import { SpotifyDayDetailModal } from './SpotifyDayDetailModal';
import {
  SpotifyFilterConfig,
  SpotifyFilterMode,
  SpotifyStatsTab,
  SpotifyTrack,
  SpotifyArtist,
  SpotifyAlbum,
  SpotifyNowPlaying,
} from './SpotifyModels';

/* ==========================================================================
   Constants & Vector Icon Registry
   ========================================================================== */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ART_GRADIENTS = [
  'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #38bdf8 100%)',
  'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
];

const TAB_ICONS: Record<SpotifyStatsTab, string> = {
  recently_played: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  listening_hours: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  diurnal_clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/></svg>`,
  skip_analytics: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>`,
  genres: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  time_machine: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>`,
  tracks: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  artists: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  albums: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`,
  stream_history: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
};

/* ==========================================================================
   SpotifyView Class Definition
   ========================================================================== */

export class SpotifyView implements VitalsModuleView {
  private app: App;
  private settings: VitalsSettings;
  private dataEngine: SpotifyDataEngine;

  private filterConfig: SpotifyFilterConfig;
  private activeSubTab: SpotifyStatsTab = 'recently_played';
  private currentNowPlaying: SpotifyNowPlaying | null = null;
  private isSyncing: boolean = false;

  private pollTimer: number | null = null;
  private tickTimer: number | null = null;

  private rootContainer: HTMLElement | null = null;
  private npArtImg: HTMLImageElement | null = null;
  private npBadgeEl: HTMLElement | null = null;
  private npTitleEl: HTMLElement | null = null;
  private npArtistEl: HTMLElement | null = null;
  private npProgressFill: HTMLElement | null = null;
  private npCurrentTimeEl: HTMLElement | null = null;
  private npTotalTimeEl: HTMLElement | null = null;
  private npEqualizerEl: HTMLElement | null = null;
  private stageEl: HTMLElement | null = null;

  constructor(app: App, settings: VitalsSettings) {
    this.app = app;
    this.settings = settings;
    this.dataEngine = new SpotifyDataEngine(app, settings);

    const refDate = this.dataEngine.getLatestStreamDate();
    this.filterConfig = {
      mode: 'lifetime',
      customDay: refDate.toISOString().slice(0, 10),
      startYear: refDate.getFullYear(),
      startMonth: 0,
      endYear: refDate.getFullYear(),
      endMonth: refDate.getMonth(),
      selectedYear: refDate.getFullYear(),
    };
  }

  public updateSettings(settings: VitalsSettings): void {
    this.settings = settings;
    this.dataEngine.updateSettings(settings);
  }

  /* ==========================================================================
     Main Render Loop
     ========================================================================== */

  public async render(container: HTMLElement): Promise<void> {
    this.stopLiveLoops();
    this.rootContainer = container;
    container.empty();
    container.addClass('vitals-spotify-container');

    if (this.settings.spotifyRefreshToken) {
      await this.dataEngine.syncRecentlyPlayed();
    }

    const totalStreams = this.dataEngine.getStreamCount();

    // 1. Top Header Bar & Sync Action
    this.renderHeader(container, totalStreams);

    // 2. Real-Time Now Playing Card
    this.currentNowPlaying = await this.dataEngine.fetchNowPlaying();
    this.renderNowPlayingCard(container, this.currentNowPlaying);

    this.startLiveLoops();

    if (totalStreams === 0) {
      this.renderUploadPrompt(container);
      return;
    }

    // 3. Sub-bar for custom dates / years
    this.renderFilterSubBar(container);

    // 4. Top Metrics Cards Grid
    const filteredStreams = this.dataEngine.getFilteredStreams(this.filterConfig);
    const topTracks = this.dataEngine.getTopTracks(this.filterConfig);
    const topArtists = this.dataEngine.getTopArtists(this.filterConfig);
    const topAlbums = this.dataEngine.getTopAlbums(this.filterConfig);
    this.renderMetricsGrid(container, filteredStreams, topTracks, topArtists, topAlbums);

    // 5. 10-Item Navigation Grid
    this.renderSubTabs(container);

    // 6. Active Stage Container
    this.stageEl = container.createEl('div', { cls: 'spotify-tab-stage' });
    this.renderActiveStage();
  }

  /* ==========================================================================
     Stage Dispatcher
     ========================================================================== */

  private renderActiveStage(): void {
    if (!this.stageEl) return;
    this.stageEl.empty();

    try {
      switch (this.activeSubTab) {
        case 'recently_played':
          this.renderRecentlyPlayed(this.stageEl);
          break;
        case 'listening_hours':
          this.renderListeningHours(this.stageEl);
          break;
        case 'diurnal_clock':
          this.renderDiurnalClock(this.stageEl);
          break;
        case 'skip_analytics':
          this.renderSkipAnalytics(this.stageEl);
          break;
        case 'genres':
          this.renderGenreBreakdown(this.stageEl);
          break;
        case 'time_machine':
          this.renderTimeMachine(this.stageEl);
          break;
        case 'tracks': {
          const topTracks = this.dataEngine.getTopTracks(this.filterConfig);
          this.renderTracksList(this.stageEl, topTracks.slice(0, 50));
          break;
        }
        case 'artists': {
          const topArtists = this.dataEngine.getTopArtists(this.filterConfig);
          this.renderArtistsGrid(this.stageEl, topArtists.slice(0, 50));
          break;
        }
        case 'albums': {
          const topAlbums = this.dataEngine.getTopAlbums(this.filterConfig);
          this.renderAlbumsGrid(this.stageEl, topAlbums.slice(0, 50));
          break;
        }
        case 'stream_history':
        default:
          this.renderUploadPrompt(this.stageEl);
          break;
      }
    } catch (err) {
      console.error(`Error rendering active tab: ${this.activeSubTab}`, err);
      this.stageEl.createEl('p', {
        text: 'Error rendering view. Please check console for details.',
        cls: 'vitals-modal-empty',
      });
    }
  }

  /* ==========================================================================
     Real-Time Filter Updater (In-Place, No Full View Refresh)
     ========================================================================== */

  private updateFilterView(): void {
    if (!this.rootContainer) return;

    // 1. Update or toggle the secondary filter subbar
    const oldSubBar = this.rootContainer.querySelector('.spotify-filter-subbar');
    if (oldSubBar) {
      oldSubBar.remove();
    }

    const { mode } = this.filterConfig;
    if (mode === 'custom_day' || mode === 'specific_year') {
      const grid = this.rootContainer.querySelector('.analytics-metrics-grid');
      if (grid && grid.parentElement) {
        const subBarWrapper = document.createElement('div');
        grid.parentElement.insertBefore(subBarWrapper, grid);
        this.renderFilterSubBar(subBarWrapper);
      }
    }

    // 2. Refresh Metrics Grid in place
    const filteredStreams = this.dataEngine.getFilteredStreams(this.filterConfig);
    const topTracks = this.dataEngine.getTopTracks(this.filterConfig);
    const topArtists = this.dataEngine.getTopArtists(this.filterConfig);
    const topAlbums = this.dataEngine.getTopAlbums(this.filterConfig);

    const oldGrid = this.rootContainer.querySelector('.analytics-metrics-grid');
    if (oldGrid && oldGrid.parentElement) {
      const tempWrapper = document.createElement('div');
      this.renderMetricsGrid(tempWrapper, filteredStreams, topTracks, topArtists, topAlbums);
      const newGrid = tempWrapper.firstElementChild;
      if (newGrid) {
        oldGrid.replaceWith(newGrid);
      }
    }

    // 3. Render active tab stage
    this.renderActiveStage();
  }

  /* ==========================================================================
     Now Playing Live Component
     ========================================================================== */

  private renderNowPlayingCard(container: HTMLElement, np: SpotifyNowPlaying | null): void {
    const card = container.createEl('div', { cls: 'analytics-card spotify-now-playing-card' });
    const inner = card.createEl('div', { cls: 'spotify-np-wrapper' });

    const artWrapper = inner.createEl('div', { cls: 'spotify-np-art-wrapper' });
    this.npArtImg = artWrapper.createEl('img', { cls: 'spotify-np-art' });
    this.npArtImg.src = np?.albumArt || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&q=80';

    const details = inner.createEl('div', { cls: 'spotify-np-details' });

    const statusRow = details.createEl('div', { cls: 'spotify-np-status-row' });
    this.npEqualizerEl = statusRow.createEl('div', { cls: 'spotify-equalizer' });
    this.npEqualizerEl.createEl('span', { cls: 'eq-bar eq-1' });
    this.npEqualizerEl.createEl('span', { cls: 'eq-bar eq-2' });
    this.npEqualizerEl.createEl('span', { cls: 'eq-bar eq-3' });

    this.npBadgeEl = statusRow.createEl('span', {
      text: np?.isPlaying ? 'NOW STREAMING ON SPOTIFY' : 'PAUSED ON SPOTIFY',
      cls: 'spotify-np-badge',
    });

    this.npTitleEl = details.createEl('div', {
      cls: 'spotify-np-title',
      text: np?.trackName || 'Not Playing',
    });

    this.npArtistEl = details.createEl('div', {
      cls: 'spotify-np-artist',
      text: np ? `${np.artistName} — ${np.albumName}` : 'Idle',
    });

    const progressWrapper = details.createEl('div', { cls: 'spotify-progress-wrapper' });
    const progressBar = progressWrapper.createEl('div', { cls: 'spotify-progress-bar' });
    this.npProgressFill = progressBar.createEl('div', { cls: 'spotify-progress-fill' });

    const progress = np?.progressMs || 0;
    const duration = np?.durationMs || 1;
    const pct = Math.min(100, Math.round((progress / duration) * 100));
    this.npProgressFill.style.width = `${pct}%`;

    const timeRow = progressWrapper.createEl('div', { cls: 'spotify-time-row' });
    this.npCurrentTimeEl = timeRow.createEl('span', { text: this.formatMs(progress) });
    this.npTotalTimeEl = timeRow.createEl('span', { text: this.formatMs(duration) });

    if (!np?.isPlaying && this.npEqualizerEl) {
      this.npEqualizerEl.style.display = 'none';
    }
  }

  /* ==========================================================================
     Live Background Polling & Progress Timers
     ========================================================================== */

  private startLiveLoops(): void {
    this.tickTimer = window.setInterval(() => {
      if (!this.currentNowPlaying || !this.currentNowPlaying.isPlaying) return;

      this.currentNowPlaying.progressMs += 1000;
      if (this.currentNowPlaying.progressMs > this.currentNowPlaying.durationMs) {
        this.currentNowPlaying.progressMs = this.currentNowPlaying.durationMs;
      }

      const pct = Math.min(100, (this.currentNowPlaying.progressMs / (this.currentNowPlaying.durationMs || 1)) * 100);

      if (this.npProgressFill) this.npProgressFill.style.width = `${pct}%`;
      if (this.npCurrentTimeEl) {
        this.npCurrentTimeEl.setText(this.formatMs(this.currentNowPlaying.progressMs));
      }
    }, 1000);

    this.pollTimer = window.setInterval(async () => {
      const fresh = await this.dataEngine.fetchNowPlaying();
      if (!fresh) return;

      const trackChanged = Boolean(
        this.currentNowPlaying &&
        this.currentNowPlaying.trackName &&
        fresh.trackName &&
        fresh.trackName !== this.currentNowPlaying.trackName,
      );

      // CAPTURE TODAY'S SKIPS IN REAL TIME:
      // If the song changed while progress was under 30 seconds, record it immediately as a skip!
      if (trackChanged && this.currentNowPlaying) {
        if (this.currentNowPlaying.progressMs < 30000) {
          this.dataEngine.recordLocalSkip({
            trackName: this.currentNowPlaying.trackName,
            artistName: this.currentNowPlaying.artistName,
            albumName: this.currentNowPlaying.albumName,
            albumArt: this.currentNowPlaying.albumArt,
            msPlayed: this.currentNowPlaying.progressMs,
            durationMs: this.currentNowPlaying.durationMs,
          });

          // If the user is currently viewing Skip Analytics, update it on the fly
          if (this.activeSubTab === 'skip_analytics') {
            this.updateFilterView();
          }
        }
      }

      this.currentNowPlaying = fresh;

      if (this.npTitleEl) this.npTitleEl.setText(fresh.trackName);
      if (this.npArtistEl) this.npArtistEl.setText(`${fresh.artistName} — ${fresh.albumName}`);
      if (this.npTotalTimeEl) this.npTotalTimeEl.setText(this.formatMs(fresh.durationMs));
      if (this.npArtImg && fresh.albumArt && this.npArtImg.src !== fresh.albumArt) {
        this.npArtImg.src = fresh.albumArt;
      }

      if (this.npBadgeEl) {
        this.npBadgeEl.setText(fresh.isPlaying ? 'NOW STREAMING ON SPOTIFY' : 'PAUSED ON SPOTIFY');
      }

      if (this.npEqualizerEl) {
        this.npEqualizerEl.style.display = fresh.isPlaying ? 'flex' : 'none';
      }

      if (trackChanged && this.settings.spotifyRefreshToken) {
        const added = await this.dataEngine.syncRecentlyPlayed();
        if (added > 0 && this.activeSubTab === 'recently_played') {
          this.renderActiveStage();
        }
      }
    }, 4000);
  }

  private stopLiveLoops(): void {
    if (this.tickTimer !== null) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /* ==========================================================================
     Top Filter Bar & Sync Action
     ========================================================================== */

  private renderHeader(container: HTMLElement, streamCount: number): void {
    const topBar = container.createEl('div', { cls: 'analytics-top-bar' });
    const titleArea = topBar.createEl('div', { cls: 'analytics-title-area' });
    titleArea.createEl('h2', { text: 'Spotify Analytics' });

    const controls = topBar.createEl('div', { cls: 'analytics-top-controls' });

    const syncGroup = controls.createEl('div', { cls: 'analytics-pill-group' });
    const syncBtn = syncGroup.createEl('button', {
      text: this.isSyncing ? 'Syncing...' : '⚡ Sync',
      cls: `analytics-pill-btn ${this.isSyncing ? 'is-disabled' : ''}`,
    });
    syncBtn.addEventListener('click', async () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      syncBtn.setText('Syncing...');
      const count = await this.dataEngine.syncRecentlyPlayed();
      this.isSyncing = false;
      syncBtn.setText('⚡ Sync');
      if (count > 0) {
        new Notice(`Added ${count} newly played streams!`);
        this.updateFilterView();
      } else {
        new Notice('Already up to date.');
      }
    });

    if (streamCount > 0) {
      const pillGroup = controls.createEl('div', { cls: 'analytics-pill-group' });
      const modes: { key: SpotifyFilterMode; label: string }[] = [
        { key: 'today', label: 'Today' },
        { key: 'custom_day', label: 'Specific Day' },
        { key: '4w', label: '4 Weeks' },
        { key: '1m', label: '1 Month' },
        { key: '3m', label: '3 Months' },
        { key: '6m', label: '6 Months' },
        { key: '1y', label: '1 Year' },
        { key: 'specific_year', label: 'Year' },
        { key: 'lifetime', label: 'Lifetime' },
      ];

      for (const m of modes) {
        const btn = pillGroup.createEl('button', {
          text: m.label,
          cls: `analytics-pill-btn ${this.filterConfig.mode === m.key ? 'is-active' : ''}`,
        });
        btn.addEventListener('click', () => {
          if (this.filterConfig.mode === m.key) return;
          this.filterConfig.mode = m.key;
          this.adjustDefaultRangeForMode(m.key);

          // Update active state in UI
          pillGroup.querySelectorAll('.analytics-pill-btn').forEach((el) => {
            el.classList.remove('is-active');
          });
          btn.classList.add('is-active');

          // Update view in place without full page reload
          this.updateFilterView();
        });
      }
    }
  }

  private adjustDefaultRangeForMode(mode: SpotifyFilterMode): void {
    const now = new Date();
    this.filterConfig.endYear = now.getFullYear();
    this.filterConfig.endMonth = now.getMonth();

    if (mode === '4w' || mode === '1m') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      this.filterConfig.startYear = d.getFullYear();
      this.filterConfig.startMonth = d.getMonth();
    } else if (mode === '3m') {
      const d = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      this.filterConfig.startYear = d.getFullYear();
      this.filterConfig.startMonth = d.getMonth();
    } else if (mode === '6m') {
      const d = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      this.filterConfig.startYear = d.getFullYear();
      this.filterConfig.startMonth = d.getMonth();
    } else if (mode === '1y') {
      this.filterConfig.startYear = now.getFullYear() - 1;
      this.filterConfig.startMonth = now.getMonth();
    }
  }

  /* ==========================================================================
     Secondary Filter Sub-Bar (Date & Year Pickers)
     ========================================================================== */

  private renderFilterSubBar(container: HTMLElement): void {
    const { mode } = this.filterConfig;
    if (mode === 'lifetime' || mode === 'today') return;

    const subBar = container.createEl('div', { cls: 'spotify-filter-subbar' });
    const availableYears = this.dataEngine.getAvailableYears();

    if (mode === 'custom_day') {
      subBar.createEl('span', { text: 'Select Day:', cls: 'filter-subbar-label' });
      const dayInput = subBar.createEl('input', {
        type: 'date',
        cls: 'spotify-filter-date-input',
      });
      dayInput.value = this.filterConfig.customDay || new Date().toISOString().slice(0, 10);
      dayInput.addEventListener('change', () => {
        this.filterConfig.customDay = dayInput.value;
        this.updateFilterView();
      });
      return;
    }

    if (mode === 'specific_year') {
      subBar.createEl('span', { text: 'Select Year:', cls: 'filter-subbar-label' });
      const yearSelect = subBar.createEl('select', { cls: 'spotify-filter-select' });
      for (const yr of availableYears) {
        const opt = yearSelect.createEl('option', { text: `${yr}`, value: `${yr}` });
        if (yr === this.filterConfig.selectedYear) opt.selected = true;
      }
      yearSelect.addEventListener('change', () => {
        this.filterConfig.selectedYear = parseInt(yearSelect.value, 10);
        this.updateFilterView();
      });
      return;
    }

    subBar.createEl('span', { text: 'From:', cls: 'filter-subbar-label' });
    const startMonthSelect = subBar.createEl('select', { cls: 'spotify-filter-select' });
    MONTH_NAMES.forEach((m, idx) => {
      const opt = startMonthSelect.createEl('option', { text: m, value: `${idx}` });
      if (idx === this.filterConfig.startMonth) opt.selected = true;
    });

    const startYearSelect = subBar.createEl('select', { cls: 'spotify-filter-select' });
    availableYears.forEach((yr) => {
      const opt = startYearSelect.createEl('option', { text: `${yr}`, value: `${yr}` });
      if (yr === this.filterConfig.startYear) opt.selected = true;
    });

    subBar.createEl('span', { text: 'To:', cls: 'filter-subbar-label' });
    const endMonthSelect = subBar.createEl('select', { cls: 'spotify-filter-select' });
    MONTH_NAMES.forEach((m, idx) => {
      const opt = endMonthSelect.createEl('option', { text: m, value: `${idx}` });
      if (idx === this.filterConfig.endMonth) opt.selected = true;
    });

    const endYearSelect = subBar.createEl('select', { cls: 'spotify-filter-select' });
    availableYears.forEach((yr) => {
      const opt = endYearSelect.createEl('option', { text: `${yr}`, value: `${yr}` });
      if (yr === this.filterConfig.endYear) opt.selected = true;
    });

    const applyChange = () => {
      this.filterConfig.startMonth = parseInt(startMonthSelect.value, 10);
      this.filterConfig.startYear = parseInt(startYearSelect.value, 10);
      this.filterConfig.endMonth = parseInt(endMonthSelect.value, 10);
      this.filterConfig.endYear = parseInt(endYearSelect.value, 10);
      this.updateFilterView();
    };

    startMonthSelect.addEventListener('change', applyChange);
    startYearSelect.addEventListener('change', applyChange);
    endMonthSelect.addEventListener('change', applyChange);
    endYearSelect.addEventListener('change', applyChange);
  }

  /* ==========================================================================
     Top Metrics Cards Grid
     ========================================================================== */

  private renderMetricsGrid(
    container: HTMLElement,
    streams: any[],
    tracks: SpotifyTrack[],
    artists: SpotifyArtist[],
    albums: SpotifyAlbum[],
  ): void {
    const grid = container.createEl('div', { cls: 'analytics-metrics-grid' });
    const totalMs = streams.reduce((acc, s) => acc + s.msPlayed, 0);
    const totalHours = (totalMs / (1000 * 60 * 60)).toFixed(1);

    const metrics = [
      { label: 'Stream Time', value: totalHours, unit: 'hrs', badge: 'timeframe' },
      { label: 'Total Plays', value: `${streams.length}`, unit: 'streams', badge: 'logged' },
      { label: 'Unique Tracks', value: `${tracks.length}`, unit: 'songs', badge: 'repertoire' },
      { label: 'Unique Albums', value: `${albums.length}`, unit: 'albums', badge: 'records' },
    ];

    for (const m of metrics) {
      const card = grid.createEl('div', { cls: 'analytics-metric-card' });
      const topRow = card.createEl('div', { cls: 'analytics-metric-top-row' });
      topRow.createEl('div', { text: m.label, cls: 'analytics-metric-title' });

      const row = card.createEl('div', { cls: 'analytics-metric-value-row' });
      const val = row.createEl('div', { text: m.value, cls: 'analytics-metric-value' });
      if (m.unit) val.createEl('span', { text: m.unit });
      card.createEl('div', { text: m.badge, cls: 'analytics-metric-badge' });
    }
  }

  /* ==========================================================================
     10-Item Navigation Grid (2 Rows of 5)
     ========================================================================== */

  private renderSubTabs(container: HTMLElement): void {
    const navGrid = container.createEl('div', { cls: 'spotify-subnav-grid' });

    const tabs: { key: SpotifyStatsTab; label: string }[] = [
      { key: 'recently_played', label: 'Recently Played' },
      { key: 'listening_hours', label: 'Heatmap' },
      { key: 'diurnal_clock', label: '24h Clock' },
      { key: 'skip_analytics', label: 'Skip Analytics' },
      { key: 'genres', label: 'Genres' },
      { key: 'time_machine', label: 'Time Machine' },
      { key: 'tracks', label: 'Top Tracks' },
      { key: 'artists', label: 'Top Artists' },
      { key: 'albums', label: 'Top Albums' },
      { key: 'stream_history', label: 'Import / Manage' },
    ];

    for (const t of tabs) {
      const btn = navGrid.createEl('button', {
        cls: `spotify-subnav-btn ${this.activeSubTab === t.key ? 'is-active' : ''}`,
      });

      const iconSpan = btn.createEl('span', { cls: 'spotify-subnav-btn-icon' });
      iconSpan.innerHTML = TAB_ICONS[t.key] || '';

      btn.createEl('span', { text: t.label, cls: 'spotify-subnav-btn-text' });

      btn.addEventListener('click', async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (this.activeSubTab === t.key) return;
        this.activeSubTab = t.key;

        if (t.key === 'recently_played' && this.settings.spotifyRefreshToken) {
          await this.dataEngine.syncRecentlyPlayed();
        }

        navGrid.querySelectorAll('.spotify-subnav-btn').forEach((el) => {
          el.classList.remove('is-active');
        });
        btn.classList.add('is-active');

        this.renderActiveStage();
      });
    }
  }

  /* ==========================================================================
     View: Recently Played Feed
     ========================================================================== */

  private renderRecentlyPlayed(container: HTMLElement): void {
    const recentStreams = this.dataEngine.getRecentStreams(60);
    const card = container.createEl('div', { cls: 'analytics-card' });

    const headerRow = card.createEl('div', { cls: 'spotify-recent-header-row' });
    headerRow.createEl('div', {
      text: `Recently Played (${recentStreams.length} tracks)`,
      cls: 'analytics-card-title',
    });

    const isLive = Boolean(this.settings.spotifyRefreshToken);
    headerRow.createEl('span', {
      text: isLive ? '● LIVE SYNC ACTIVE' : 'FILE ARCHIVE ONLY',
      cls: `spotify-np-badge ${isLive ? 'live-green' : 'archive-gray'}`,
    });

    const list = card.createEl('div', { cls: 'spotify-recent-list' });

    if (recentStreams.length === 0) {
      list.createEl('p', {
        text: "No streams recorded yet. Play a song on Spotify and click '⚡ Sync' above.",
        cls: 'vitals-modal-empty',
      });
      return;
    }

    recentStreams.forEach((stream) => {
      const row = list.createEl('div', { cls: 'spotify-recent-row' });

      const artWrapper = row.createEl('div', { cls: 'spotify-recent-art-wrapper' });
      if (stream.albumArt) {
        const img = artWrapper.createEl('img', { cls: 'spotify-recent-art' });
        img.src = stream.albumArt;
      } else {
        this.renderInitialsBadge(artWrapper, stream.trackName || 'Track', 'track');
        this.dataEngine.resolveCoverArt(stream.trackName || '', stream.artistName || '', 'track').then((url) => {
          if (url) {
            artWrapper.empty();
            const img = artWrapper.createEl('img', { cls: 'spotify-recent-art' });
            img.src = url;
          }
        });
      }

      const info = row.createEl('div', { cls: 'spotify-recent-info' });
      info.createEl('div', { text: stream.trackName || 'Unknown Track', cls: 'spotify-recent-title' });
      info.createEl('div', {
        text: `${stream.artistName || 'Unknown Artist'} • ${stream.albumName || 'Unknown Album'}`,
        cls: 'spotify-recent-artist',
      });

      const meta = row.createEl('div', { cls: 'spotify-recent-meta' });
      meta.createEl('div', {
        text: this.formatRelativeTime(stream.ts),
        cls: 'spotify-recent-timestamp',
      });
      const playedMins = Math.floor(stream.msPlayed / 60000);
      const playedSecs = Math.floor((stream.msPlayed % 60000) / 1000);
      meta.createEl('div', {
        text: `${playedMins}m ${playedSecs}s played`,
        cls: 'spotify-recent-dur',
      });
    });
  }

  /* ==========================================================================
     View: Listening Hours (Heatmap)
     ========================================================================== */

  private renderListeningHours(container: HTMLElement): void {
    const data = this.dataEngine.getHeatmapData(this.filterConfig);
    const card = container.createEl('div', { cls: 'analytics-card spotify-heatmap-card' });

    const statsRow = card.createEl('div', { cls: 'spotify-heatmap-stats' });
    const statItems = [
      { label: 'Total Stream Time', val: `${data.totalHours} hrs` },
      { label: 'Active Days', val: `${data.activeDays} days` },
      { label: 'Peak Day', val: `${data.maxHours} hrs` },
      { label: 'Longest Streak', val: `${data.longestStreak} days` },
    ];
    for (const item of statItems) {
      const box = statsRow.createEl('div', { cls: 'spotify-heatmap-stat-box' });
      box.createEl('span', { text: item.label, cls: 'heatmap-stat-label' });
      box.createEl('span', { text: item.val, cls: 'heatmap-stat-val' });
    }

    if (data.days.length === 0) {
      card.createEl('p', {
        text: 'No listening activity found for this timeframe.',
        cls: 'vitals-modal-empty',
      });
      return;
    }

    const heatmapScroll = card.createEl('div', { cls: 'spotify-heatmap-scroll' });
    const gridContainer = heatmapScroll.createEl('div', { cls: 'spotify-heatmap-grid' });

    const dayLabels = gridContainer.createEl('div', { cls: 'spotify-heatmap-days-col' });
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((label, idx) => {
      const span = dayLabels.createEl('span', { cls: 'heatmap-day-label' });
      span.setText(idx % 2 === 1 ? label : '');
    });

    const weeksWrapper = gridContainer.createEl('div', { cls: 'spotify-heatmap-weeks' });

    let currentWeekEl = weeksWrapper.createEl('div', { cls: 'spotify-heatmap-week' });
    const firstDayIndex = new Date(data.days[0].date).getDay();
    for (let p = 0; p < firstDayIndex; p++) {
      currentWeekEl.createEl('div', { cls: 'spotify-heatmap-cell is-empty' });
    }

    for (const day of data.days) {
      const d = new Date(day.date);
      if (d.getDay() === 0 && currentWeekEl.children.length > 0) {
        currentWeekEl = weeksWrapper.createEl('div', { cls: 'spotify-heatmap-week' });
      }

      const cell = currentWeekEl.createEl('div', {
        cls: `spotify-heatmap-cell level-${day.level}`,
      });

      const tooltip = `${day.date}: ${day.hours} hrs (${day.streamCount} streams)`;
      cell.setAttribute('title', tooltip);

      cell.addEventListener('click', () => {
        const dayStreams = this.dataEngine.getStreamsForDay(day.date);
        new SpotifyDayDetailModal(this.app, day.date, dayStreams, this.dataEngine).open();
      });
    }

    const legendRow = card.createEl('div', { cls: 'spotify-heatmap-legend' });
    legendRow.createEl('span', { text: 'Less', cls: 'heatmap-legend-label' });
    [0, 1, 2, 3, 4].forEach((lvl) => {
      legendRow.createEl('span', { cls: `spotify-heatmap-cell level-${lvl}` });
    });
    legendRow.createEl('span', { text: 'More', cls: 'heatmap-legend-label' });
  }

  /* ==========================================================================
     View: 24-Hour Diurnal Clock
     ========================================================================== */

  private renderDiurnalClock(container: HTMLElement): void {
    const hours = this.dataEngine.getDiurnalDistribution(this.filterConfig);
    const card = container.createEl('div', { cls: 'analytics-card spotify-diurnal-card' });

    card.createEl('div', {
      text: '24-Hour Listening Distribution',
      cls: 'analytics-card-title',
    });

    const maxStreams = Math.max(...hours.map((h) => h.streamCount), 1);
    const chartWrapper = card.createEl('div', { cls: 'spotify-diurnal-chart' });

    hours.forEach((h) => {
      const col = chartWrapper.createEl('div', { cls: 'spotify-diurnal-col' });

      const barWrapper = col.createEl('div', { cls: 'spotify-diurnal-bar-wrapper' });
      const barFill = barWrapper.createEl('div', { cls: 'spotify-diurnal-bar-fill' });
      const heightPct = Math.round((h.streamCount / maxStreams) * 100);
      barFill.style.height = `${heightPct}%`;

      const tooltip = `${h.label}: ${h.streamCount} streams (${h.hours} hrs, ${h.percentage}%)`;
      barWrapper.setAttribute('title', tooltip);

      const label = col.createEl('span', { cls: 'spotify-diurnal-label' });
      label.setText(h.hour % 3 === 0 ? `${h.hour}h` : '');
    });

    const peak = [...hours].sort((a, b) => b.streamCount - a.streamCount)[0];
    const footer = card.createEl('div', { cls: 'spotify-diurnal-footer' });
    footer.createEl('span', {
      text: peak
        ? `Peak Listening Window: ${peak.label} (${peak.streamCount} streams, ${peak.percentage}% of selected timeframe)`
        : 'No streams logged',
      cls: 'spotify-np-badge live-green',
    });
  }

  /* ==========================================================================
     View: Skip Rate & Retention Analytics
     ========================================================================== */

  private renderSkipAnalytics(container: HTMLElement): void {
    const data = this.dataEngine.getSkipAnalytics(this.filterConfig);
    const card = container.createEl('div', { cls: 'analytics-card' });

    card.createEl('div', { text: 'Skip Rate & Track Retention Analytics', cls: 'analytics-card-title' });

    const statsGrid = card.createEl('div', { cls: 'spotify-skip-stats-grid' });

    const items = [
      { label: 'Completion Rate', val: `${data.completionRate}%`, badge: `${data.completedStreams} finished` },
      { label: 'Skip Rate (<30s)', val: `${data.skipRate}%`, badge: `${data.skippedStreams} skipped` },
      { label: 'Partial Listens', val: `${data.partialStreams}`, badge: 'between 30s-3m' },
      { label: 'Total Evaluations', val: `${data.totalStreams}`, badge: 'streams processed' },
    ];

    for (const item of items) {
      const box = statsGrid.createEl('div', { cls: 'analytics-metric-card' });
      box.createEl('div', { text: item.label, cls: 'analytics-metric-title' });
      const valRow = box.createEl('div', { cls: 'analytics-metric-value-row' });
      valRow.createEl('div', { text: item.val, cls: 'analytics-metric-value' });
      box.createEl('div', { text: item.badge, cls: 'analytics-metric-badge' });
    }

    const dualCol = card.createEl('div', { cls: 'spotify-skip-dual-col' });

    // Column 1: Most Skipped
    const col1 = dualCol.createEl('div', { cls: 'spotify-skip-subcol' });
    col1.createEl('h4', { text: 'Most Skipped Tracks (<30s)', cls: 'spotify-skip-subtitle' });
    const list1 = col1.createEl('div', { cls: 'spotify-ranked-list' });
    if (!data.topSkippedTracks || data.topSkippedTracks.length === 0) {
      list1.createEl('p', { text: 'No skipped tracks logged.', cls: 'vitals-modal-empty' });
    } else {
      data.topSkippedTracks.forEach((t, i) => {
        const row = list1.createEl('div', { cls: 'spotify-track-row' });
        row.createEl('div', { text: `${i + 1}`, cls: 'spotify-rank-num' });
        const info = row.createEl('div', { cls: 'spotify-track-info' });
        info.createEl('div', { text: t.trackName || 'Track', cls: 'spotify-track-name' });
        info.createEl('div', { text: t.artistName || 'Artist', cls: 'spotify-track-sub' });
        const meta = row.createEl('div', { cls: 'spotify-track-meta' });
        meta.createEl('div', { text: `${t.skipCount} skips`, cls: 'spotify-stream-count text-danger' });
        meta.createEl('div', { text: `of ${t.playCount} total`, cls: 'spotify-track-dur' });
      });
    }

    // Column 2: Highest Retention
    const col2 = dualCol.createEl('div', { cls: 'spotify-skip-subcol' });
    col2.createEl('h4', { text: 'Highest Retention Tracks (>3m)', cls: 'spotify-skip-subtitle' });
    const list2 = col2.createEl('div', { cls: 'spotify-ranked-list' });
    if (!data.mostCompletedTracks || data.mostCompletedTracks.length === 0) {
      list2.createEl('p', { text: 'No finished tracks logged.', cls: 'vitals-modal-empty' });
    } else {
      data.mostCompletedTracks.forEach((t, i) => {
        const row = list2.createEl('div', { cls: 'spotify-track-row' });
        row.createEl('div', { text: `${i + 1}`, cls: 'spotify-rank-num top-1' });
        const info = row.createEl('div', { cls: 'spotify-track-info' });
        info.createEl('div', { text: t.trackName || 'Track', cls: 'spotify-track-name' });
        info.createEl('div', { text: t.artistName || 'Artist', cls: 'spotify-track-sub' });
        const meta = row.createEl('div', { cls: 'spotify-track-meta' });
        meta.createEl('div', { text: `${t.completionCount} full`, cls: 'spotify-stream-count' });
        meta.createEl('div', { text: `of ${t.playCount} total`, cls: 'spotify-track-dur' });
      });
    }
  }

  /* ==========================================================================
     View: Genre Breakdown
     ========================================================================== */

  private renderGenreBreakdown(container: HTMLElement): void {
    const genres = this.dataEngine.getGenreBreakdown(this.filterConfig);
    const card = container.createEl('div', { cls: 'analytics-card' });

    card.createEl('div', { text: 'Genre & Sound Profile Breakdown', cls: 'analytics-card-title' });

    const grid = card.createEl('div', { cls: 'spotify-genre-grid' });

    if (genres.length === 0) {
      grid.createEl('p', { text: 'No genre data available for this timeframe.', cls: 'vitals-modal-empty' });
      return;
    }

    genres.forEach((g) => {
      const tile = grid.createEl('div', { cls: 'spotify-genre-card' });

      const topRow = tile.createEl('div', { cls: 'spotify-genre-top' });
      topRow.createEl('span', { text: g.icon || '🎵', cls: 'spotify-genre-icon' });
      topRow.createEl('span', { text: `${g.percentage}%`, cls: 'spotify-genre-pct' });

      tile.createEl('div', { text: g.genre, cls: 'spotify-genre-name' });
      tile.createEl('div', { text: `${g.playCount} streams logged`, cls: 'spotify-genre-sub' });

      const barWrapper = tile.createEl('div', { cls: 'spotify-genre-bar-wrapper' });
      const barFill = barWrapper.createEl('div', { cls: 'spotify-genre-bar-fill' });
      barFill.style.width = `${Math.min(100, g.percentage)}%`;
    });
  }

  /* ==========================================================================
     View: Time Machine ("On This Day")
     ========================================================================== */

  private renderTimeMachine(container: HTMLElement): void {
    const buckets = this.dataEngine.getOnThisDayBuckets(new Date());
    const card = container.createEl('div', { cls: 'analytics-card' });

    card.createEl('div', { text: '⏳ On This Day — Throwback Time Machine', cls: 'analytics-card-title' });

    if (buckets.length === 0) {
      card.createEl('p', {
        text: "No historical streams found matching today's calendar date from previous months or years.",
        cls: 'vitals-modal-empty',
      });
      return;
    }

    const wrapper = card.createEl('div', { cls: 'spotify-time-machine-wrapper' });

    buckets.forEach((b) => {
      const bucketCard = wrapper.createEl('div', { cls: 'spotify-throwback-bucket' });
      const bHeader = bucketCard.createEl('div', { cls: 'spotify-throwback-header' });
      bHeader.createEl('h4', { text: b.periodLabel, cls: 'spotify-throwback-title' });

      const meta = bHeader.createEl('div', { cls: 'spotify-throwback-meta' });
      meta.createEl('span', { text: `${b.streams.length} songs`, cls: 'spotify-np-badge live-green' });
      meta.createEl('span', { text: `${b.totalHours} hrs`, cls: 'spotify-np-badge' });

      if (b.streams.length === 0) {
        bucketCard.createEl('p', { text: 'No music logged on this day.', cls: 'spotify-empty-text' });
      } else {
        const streamList = bucketCard.createEl('div', { cls: 'spotify-recent-list' });
        b.streams.slice(0, 5).forEach((s) => {
          const row = streamList.createEl('div', { cls: 'spotify-recent-row' });
          const artWrapper = row.createEl('div', { cls: 'spotify-recent-art-wrapper' });
          this.renderInitialsBadge(artWrapper, s.trackName || 'Track', 'track');
          this.dataEngine.resolveCoverArt(s.trackName || '', s.artistName || '', 'track').then((url) => {
            if (url) {
              artWrapper.empty();
              const img = artWrapper.createEl('img', { cls: 'spotify-recent-art' });
              img.src = url;
            }
          });

          const info = row.createEl('div', { cls: 'spotify-recent-info' });
          info.createEl('div', { text: s.trackName || 'Unknown Track', cls: 'spotify-recent-title' });
          info.createEl('div', {
            text: `${s.artistName || 'Unknown Artist'} • ${s.albumName || 'Unknown Album'}`,
            cls: 'spotify-recent-artist',
          });

          const timeMeta = row.createEl('div', { cls: 'spotify-recent-meta' });
          timeMeta.createEl('div', {
            text: new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            cls: 'spotify-recent-timestamp',
          });
        });

        if (b.streams.length > 5) {
          const moreBtn = bucketCard.createEl('button', {
            text: `View All ${b.streams.length} Streams`,
            cls: 'analytics-pill-btn',
          });
          moreBtn.addEventListener('click', () => {
            new SpotifyDayDetailModal(this.app, b.targetDate, b.streams, this.dataEngine).open();
          });
        }
      }
    });
  }

  /* ==========================================================================
     View: Top Tracks Leaderboard
     ========================================================================== */

  private renderTracksList(container: HTMLElement, tracks: SpotifyTrack[]): void {
    const card = container.createEl('div', { cls: 'analytics-card' });
    card.createEl('div', { text: `Leaderboard (Top ${tracks.length})`, cls: 'analytics-card-title' });

    const list = card.createEl('div', { cls: 'spotify-ranked-list' });

    if (tracks.length === 0) {
      list.createEl('p', { text: 'No track data recorded for this timeframe.', cls: 'vitals-modal-empty' });
      return;
    }

    tracks.forEach((track, index) => {
      const row = list.createEl('div', { cls: 'spotify-track-row' });

      const rankEl = row.createEl('div', { cls: `spotify-rank-num ${index < 3 ? `top-${index + 1}` : ''}` });
      rankEl.setText(`${index + 1}`);

      const artWrapper = row.createEl('div', { cls: 'spotify-track-art-wrapper' });

      if (track.albumArt) {
        const art = artWrapper.createEl('img', { cls: 'spotify-track-art' });
        art.src = track.albumArt;
      } else {
        this.renderInitialsBadge(artWrapper, track.name || 'Track', 'track');
        const artist = track.artists && track.artists[0] ? track.artists[0] : 'Artist';
        this.dataEngine.resolveCoverArt(track.name || '', artist, 'track').then((url) => {
          if (url) {
            artWrapper.empty();
            const art = artWrapper.createEl('img', { cls: 'spotify-track-art' });
            art.src = url;
          }
        });
      }

      const info = row.createEl('div', { cls: 'spotify-track-info' });
      info.createEl('div', { text: track.name || 'Unknown Track', cls: 'spotify-track-name' });
      const artistStr = Array.isArray(track.artists) ? track.artists.join(', ') : 'Unknown Artist';
      info.createEl('div', {
        text: `${artistStr} • ${track.album || 'Unknown Album'}`,
        cls: 'spotify-track-sub',
      });

      const meta = row.createEl('div', { cls: 'spotify-track-meta' });
      meta.createEl('div', { text: `${track.playCount} plays`, cls: 'spotify-stream-count' });
      const ms = track.totalMsPlayed ?? 0;
      const hrs = (ms / (1000 * 60)).toFixed(0);
      meta.createEl('div', { text: `${hrs} mins`, cls: 'spotify-track-dur' });
    });
  }

  /* ==========================================================================
     View: Top Artists Grid
     ========================================================================== */

  private renderArtistsGrid(container: HTMLElement, artists: SpotifyArtist[]): void {
    const card = container.createEl('div', { cls: 'analytics-card' });
    card.createEl('div', { text: `Top Artists (Top ${artists.length})`, cls: 'analytics-card-title' });

    const grid = card.createEl('div', { cls: 'spotify-artists-grid' });

    if (artists.length === 0) {
      grid.createEl('p', { text: 'No artist data recorded for this timeframe.', cls: 'vitals-modal-empty' });
      return;
    }

    artists.forEach((artist, index) => {
      const tile = grid.createEl('div', { cls: 'spotify-artist-card' });

      const artWrapper = tile.createEl('div', { cls: 'spotify-artist-art-wrapper' });
      if (artist.imageUrl) {
        const img = artWrapper.createEl('img', { cls: 'spotify-artist-art' });
        img.src = artist.imageUrl;
      } else {
        this.renderInitialsBadge(artWrapper, artist.name || 'Artist', 'artist');
        this.dataEngine.resolveArtistImage(artist.name || '').then((url) => {
          if (url) {
            artWrapper.empty();
            const img = artWrapper.createEl('img', { cls: 'spotify-artist-art' });
            img.src = url;
            artWrapper.createEl('span', {
              text: `#${index + 1}`,
              cls: `spotify-artist-rank-tag ${index < 3 ? `top-${index + 1}` : ''}`,
            });
          }
        });
      }

      artWrapper.createEl('span', {
        text: `#${index + 1}`,
        cls: `spotify-artist-rank-tag ${index < 3 ? `top-${index + 1}` : ''}`,
      });

      tile.createEl('div', { text: artist.name || 'Unknown Artist', cls: 'spotify-artist-name' });
      tile.createEl('div', { text: `${artist.playCount} streams`, cls: 'spotify-stream-count' });
      const ms = artist.totalMsPlayed ?? 0;
      const hours = (ms / (1000 * 60 * 60)).toFixed(1);
      tile.createEl('div', { text: `${hours} hours`, cls: 'spotify-artist-genres' });
    });
  }

  /* ==========================================================================
     View: Top Albums Grid
     ========================================================================== */

  private renderAlbumsGrid(container: HTMLElement, albums: SpotifyAlbum[]): void {
    const card = container.createEl('div', { cls: 'analytics-card' });
    card.createEl('div', { text: `Top Albums (Top ${albums.length})`, cls: 'analytics-card-title' });

    const grid = card.createEl('div', { cls: 'spotify-albums-grid' });

    if (albums.length === 0) {
      grid.createEl('p', { text: 'No album data recorded for this timeframe.', cls: 'vitals-modal-empty' });
      return;
    }

    albums.forEach((album, index) => {
      const tile = grid.createEl('div', { cls: 'spotify-album-card' });

      const artWrapper = tile.createEl('div', { cls: 'spotify-album-art-wrapper' });
      if (album.albumArt) {
        const img = artWrapper.createEl('img', { cls: 'spotify-album-art' });
        img.src = album.albumArt;
      } else {
        this.renderInitialsBadge(artWrapper, album.name || 'Album', 'album');
        this.dataEngine.resolveCoverArt(album.name || '', album.artist || '', 'album').then((url) => {
          if (url) {
            artWrapper.empty();
            const img = artWrapper.createEl('img', { cls: 'spotify-album-art' });
            img.src = url;
            artWrapper.createEl('span', {
              text: `#${index + 1}`,
              cls: `spotify-artist-rank-tag ${index < 3 ? `top-${index + 1}` : ''}`,
            });
          }
        });
      }

      artWrapper.createEl('span', {
        text: `#${index + 1}`,
        cls: `spotify-artist-rank-tag ${index < 3 ? `top-${index + 1}` : ''}`,
      });

      tile.createEl('div', { text: album.name || 'Unknown Album', cls: 'spotify-artist-name' });
      tile.createEl('div', { text: album.artist || 'Unknown Artist', cls: 'spotify-track-sub' });
      tile.createEl('div', { text: `${album.playCount} plays`, cls: 'spotify-stream-count' });
    });
  }

  /* ==========================================================================
     View: Import & History Management
     ========================================================================== */

  private renderUploadPrompt(container: HTMLElement): void {
    const card = container.createEl('div', { cls: 'analytics-card spotify-upload-card' });
    card.createEl('div', { text: '📥 Import Streaming History', cls: 'analytics-card-title' });
    card.createEl('p', {
      text: 'Upload your Spotify GDPR endsong_*.json files or stats.fm JSON exports to analyze your music habits inside Obsidian.',
      cls: 'spotify-upload-desc',
    });

    const dropZone = card.createEl('div', { cls: 'spotify-dropzone' });
    dropZone.createEl('div', { text: '🎵', cls: 'spotify-dropzone-icon' });
    dropZone.createEl('p', { text: 'Click to select or drag and drop endsong_*.json files here' });

    const fileInput = dropZone.createEl('input', {
      type: 'file',
      attr: { multiple: 'multiple', accept: '.json' },
      cls: 'spotify-file-input',
    });

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      if (fileInput.files && fileInput.files.length > 0) {
        new Notice('Processing streams, please wait...');
        const count = await this.dataEngine.importJSONFiles(fileInput.files);
        new Notice(`Successfully imported ${count} new streams!`);
        this.activeSubTab = 'recently_played';
        this.render(container);
      }
    });

    if (this.dataEngine.getStreamCount() > 0) {
      const resetBtn = card.createEl('button', {
        text: 'Clear Database & Re-import',
        cls: 'analytics-pill-btn spotify-danger-btn',
      });
      resetBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete imported streaming history?')) {
          this.dataEngine.clearAllData();
          new Notice('Spotify stream database reset.');
          this.render(container);
        }
      });
    }
  }

  /* ==========================================================================
     Formatters & Helper Utilities
     ========================================================================== */

  private formatRelativeTime(isoString: string): string {
    const streamDate = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - streamDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return streamDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private renderInitialsBadge(parent: HTMLElement, title: string, type: 'track' | 'artist' | 'album'): void {
    const safeTitle = title || '♪';
    let hash = 0;
    for (let i = 0; i < safeTitle.length; i++) {
      hash = safeTitle.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % ART_GRADIENTS.length;
    const bgGradient = ART_GRADIENTS[colorIndex];

    const initials = safeTitle
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');

    const badge = parent.createEl('div', { cls: `vitals-cover-badge ${type}` });
    badge.style.background = bgGradient;
    badge.createEl('span', { text: initials || '♪' });
  }

  private formatMs(ms: number): string {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  public destroy(): void {
    this.stopLiveLoops();
  }
}
