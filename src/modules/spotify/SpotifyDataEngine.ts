import { App, requestUrl } from 'obsidian';
import {
  SpotifyStreamRecord,
  SpotifyTrack,
  SpotifyArtist,
  SpotifyAlbum,
  SpotifyFilterConfig,
  SpotifyNowPlaying,
  SpotifyHeatmapDay,
  SpotifyHourlyDistribution,
  SpotifySkipAnalytics,
  SpotifyGenreShare,
  SpotifyThrowbackBucket,
} from './SpotifyModels';
import { VitalsSettings } from '../../settings/VitalsSettings';

export class SpotifyDataEngine {
  private app: App;
  public settings?: VitalsSettings;
  private storageKey = 'vitals-spotify-streams';
  private artCacheKey = 'vitals-spotify-art-cache';

  private streams: SpotifyStreamRecord[] = [];
  private artCache: Record<string, string> = {};
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(app: App, settings?: VitalsSettings) {
    this.app = app;
    this.settings = settings;
    this.loadFromStorage();
  }

  public updateSettings(settings: VitalsSettings): void {
    this.settings = settings;
  }

  public loadFromStorage(): void {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        this.streams = JSON.parse(raw);
      } catch {
        this.streams = [];
      }
    }
    const rawCache = localStorage.getItem(this.artCacheKey);
    if (rawCache) {
      try {
        this.artCache = JSON.parse(rawCache);
      } catch {
        this.artCache = {};
      }
    }
  }

  public saveToStorage(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.streams));
  }

  private saveArtCache(): void {
    localStorage.setItem(this.artCacheKey, JSON.stringify(this.artCache));
  }

  public getStreamCount(): number {
    return this.streams.length;
  }

  public toLocalDateKey(dateInput: Date | string | number): string {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }

  public getLatestStreamDate(): Date {
    if (this.streams.length === 0) return new Date();
    let max = -Infinity;
    for (const s of this.streams) {
      const t = new Date(s.ts).getTime();
      if (!isNaN(t) && t > max) max = t;
    }
    return max === -Infinity ? new Date() : new Date(max);
  }

  public getEarliestStreamDate(): Date {
    if (this.streams.length === 0) return new Date();
    let min = Infinity;
    for (const s of this.streams) {
      const t = new Date(s.ts).getTime();
      if (!isNaN(t) && t < min) min = t;
    }
    return min === Infinity ? new Date() : new Date(min);
  }

  public getRecentStreams(limit: number = 60): SpotifyStreamRecord[] {
    return this.streams.slice(0, limit);
  }

  private buildFingerprint(ts: string, track: string, artist: string): string {
    const timeMs = new Date(ts).getTime();
    const cleanTrack = (track || '').toLowerCase().trim();
    const cleanArtist = (artist || '').toLowerCase().trim();
    return `${timeMs}_${cleanTrack}_${cleanArtist}`;
  }

  public async importJSONFiles(files: FileList): Promise<number> {
    let importedCount = 0;
    const existingFingerprints = new Set(
      this.streams.map((s) => this.buildFingerprint(s.ts, s.trackName, s.artistName)),
    );

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.endsWith('.json')) continue;

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        if (!Array.isArray(json)) continue;

        for (const item of json) {
          let rawTs = item.ts || item.endTime;
          if (!rawTs) continue;

          let ts = rawTs.includes('T') ? rawTs : rawTs.replace(' ', 'T') + ':00Z';
          let track = item.master_metadata_track_name || item.trackName;
          let artist = item.master_metadata_album_artist_name || item.artistName;
          let album = item.master_metadata_album_album_name || item.albumName || 'Unknown Album';
          let ms = item.ms_played || item.msPlayed || 0;

          if (!track && item.track) {
            track = item.track.name;
            artist = item.track.artists?.[0]?.name || 'Unknown';
            album = item.track.album?.name || 'Unknown Album';
            ms = item.durationMs || 0;
            ts = item.endTime;
          }

          if (!track || !artist) continue;

          const fingerprint = this.buildFingerprint(ts, track, artist);
          if (!existingFingerprints.has(fingerprint)) {
            existingFingerprints.add(fingerprint);
            this.streams.push({
              ts: ts,
              trackName: track,
              artistName: artist,
              albumName: album,
              msPlayed: ms,
              spotifyTrackUri: item.spotify_track_uri,
            });
            importedCount++;
          }
        }
      } catch (err) {
        console.error(`Failed to parse file: ${file.name}`, err);
      }
    }

    this.streams.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    this.saveToStorage();
    return importedCount;
  }

  public getAvailableYears(): number[] {
    const years = new Set<number>();
    for (const s of this.streams) {
      const yr = new Date(s.ts).getFullYear();
      if (!isNaN(yr)) years.add(yr);
    }
    const arr = Array.from(years).sort((a, b) => b - a);
    return arr.length > 0 ? arr : [new Date().getFullYear()];
  }

  public calculateBounds(config: SpotifyFilterConfig): {
    startMs: number;
    endMs: number;
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (config.mode === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (config.mode === 'custom_day' && config.customDay) {
      const parts = config.customDay.split('-').map(Number);
      startDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      endDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
    } else if (config.mode === 'specific_year' && config.selectedYear) {
      startDate = new Date(config.selectedYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(config.selectedYear, 11, 31, 23, 59, 59, 999);
    } else if (config.mode === '4w') {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startDate = new Date(endDate.getTime() - 28 * 86400000);
      startDate.setHours(0, 0, 0, 0);
    } else if (config.mode === '1m') {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0, 0);
    } else if (config.mode === '3m') {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0, 0);
    } else if (config.mode === '6m') {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0, 0);
    } else if (config.mode === '1y') {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (
      config.startYear !== undefined &&
      config.startMonth !== undefined &&
      config.endYear !== undefined &&
      config.endMonth !== undefined
    ) {
      startDate = new Date(config.startYear, config.startMonth, 1, 0, 0, 0, 0);
      endDate = new Date(config.endYear, config.endMonth + 1, 0, 23, 59, 59, 999);
    } else {
      const earliest = this.getEarliestStreamDate();
      const latest = this.getLatestStreamDate();
      startDate = new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate(), 0, 0, 0, 0);
      const endRef = latest.getTime() > now.getTime() ? latest : now;
      endDate = new Date(endRef.getFullYear(), endRef.getMonth(), endRef.getDate(), 23, 59, 59, 999);
    }

    return {
      startMs: startDate.getTime(),
      endMs: endDate.getTime(),
      startDate,
      endDate,
    };
  }

  public getFilteredStreams(config: SpotifyFilterConfig): SpotifyStreamRecord[] {
    if (config.mode === 'lifetime') return this.streams;

    const { startMs, endMs } = this.calculateBounds(config);
    return this.streams.filter((s) => {
      const t = new Date(s.ts).getTime();
      return !isNaN(t) && t >= startMs && t <= endMs;
    });
  }

  public getTopTracks(config: SpotifyFilterConfig): SpotifyTrack[] {
    const list = this.getFilteredStreams(config).filter((s) => s.msPlayed >= 25000);
    const map: Record<string, SpotifyTrack> = {};

    for (const s of list) {
      const key = `${s.trackName}___${s.artistName}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          name: s.trackName,
          artists: [s.artistName],
          album: s.albumName,
          durationMs: s.msPlayed,
          playCount: 0,
          totalMsPlayed: 0,
          albumArt: this.artCache[`track___${key}`],
          externalUrl: s.spotifyTrackUri,
        };
      }
      map[key].playCount += 1;
      map[key].totalMsPlayed = (map[key].totalMsPlayed ?? 0) + s.msPlayed;
    }

    return Object.values(map).sort((a, b) => b.playCount - a.playCount);
  }

  public getTopArtists(config: SpotifyFilterConfig): SpotifyArtist[] {
    const list = this.getFilteredStreams(config).filter((s) => s.msPlayed >= 25000);
    const map: Record<string, SpotifyArtist> = {};

    for (const s of list) {
      const artist = s.artistName;
      if (!map[artist]) {
        map[artist] = {
          name: artist,
          playCount: 0,
          totalMsPlayed: 0,
          imageUrl: this.artCache[`artist___${artist}`],
        };
      }
      map[artist].playCount += 1;
      map[artist].totalMsPlayed = (map[artist].totalMsPlayed ?? 0) + s.msPlayed;
    }

    return Object.values(map).sort((a, b) => b.playCount - a.playCount);
  }

  public getTopAlbums(config: SpotifyFilterConfig): SpotifyAlbum[] {
    const list = this.getFilteredStreams(config).filter((s) => s.msPlayed >= 25000);
    const map: Record<string, SpotifyAlbum> = {};

    for (const s of list) {
      const key = `${s.albumName}___${s.artistName}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          name: s.albumName,
          artist: s.artistName,
          playCount: 0,
          totalMsPlayed: 0,
          albumArt: this.artCache[`album___${key}`],
        };
      }
      map[key].playCount += 1;
      map[key].totalMsPlayed += s.msPlayed;
    }

    return Object.values(map).sort((a, b) => b.playCount - a.playCount);
  }

  public getHeatmapData(config: SpotifyFilterConfig): {
    days: SpotifyHeatmapDay[];
    maxHours: number;
    totalHours: number;
    activeDays: number;
    longestStreak: number;
  } {
    const filtered = this.getFilteredStreams(config);
    const dayMap: Record<string, { ms: number; count: number }> = {};

    for (const s of filtered) {
      const key = this.toLocalDateKey(s.ts);
      if (!key) continue;

      if (!dayMap[key]) {
        dayMap[key] = { ms: 0, count: 0 };
      }
      dayMap[key].ms += s.msPlayed || 0;
      dayMap[key].count += 1;
    }

    const { startDate, endDate } = this.calculateBounds(config);

    const days: SpotifyHeatmapDay[] = [];
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);

    const stop = new Date(endDate);
    stop.setHours(23, 59, 59, 999);

    let maxHours = 0;
    let totalMs = 0;
    let activeDays = 0;

    let safety = 0;
    while (cur <= stop && safety < 3000) {
      safety++;
      const key = this.toLocalDateKey(cur);
      const entry = dayMap[key] || { ms: 0, count: 0 };
      const hours = parseFloat((entry.ms / (1000 * 60 * 60)).toFixed(2));

      totalMs += entry.ms;
      if (hours > 0) activeDays++;
      if (hours > maxHours) maxHours = hours;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (hours > 0 && hours < 0.75) level = 1;
      else if (hours >= 0.75 && hours < 2) level = 2;
      else if (hours >= 2 && hours < 4) level = 3;
      else if (hours >= 4) level = 4;

      days.push({
        date: key,
        hours,
        streamCount: entry.count,
        level,
      });

      cur.setDate(cur.getDate() + 1);
    }

    let longestStreak = 0;
    let currentStreak = 0;
    for (const d of days) {
      if (d.hours > 0) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    return {
      days,
      maxHours,
      totalHours: parseFloat((totalMs / (1000 * 60 * 60)).toFixed(1)),
      activeDays,
      longestStreak,
    };
  }

  /**
   * FEATURE 1: 24-Hour Diurnal Clock Aggregator
   */
  public getDiurnalDistribution(config: SpotifyFilterConfig): SpotifyHourlyDistribution[] {
    const filtered = this.getFilteredStreams(config);
    const hourlyData: { count: number; ms: number }[] = Array.from({ length: 24 }, () => ({
      count: 0,
      ms: 0,
    }));

    let totalStreams = 0;
    for (const s of filtered) {
      const d = new Date(s.ts);
      if (isNaN(d.getTime())) continue;
      const hour = d.getHours(); // Local timezone hour 0 - 23
      hourlyData[hour].count += 1;
      hourlyData[hour].ms += s.msPlayed || 0;
      totalStreams++;
    }

    return hourlyData.map((data, hour) => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      return {
        hour,
        label: `${displayHour} ${period}`,
        streamCount: data.count,
        totalMs: data.ms,
        hours: parseFloat((data.ms / (1000 * 60 * 60)).toFixed(1)),
        percentage: totalStreams > 0 ? parseFloat(((data.count / totalStreams) * 100).toFixed(1)) : 0,
      };
    });
  }

  /**
   * FEATURE 3: Skip Rate & Completion Analytics
   */
  public getSkipAnalytics(config: SpotifyFilterConfig): SpotifySkipAnalytics {
    const filtered = this.getFilteredStreams(config);
    const totalStreams = filtered.length;

    let skippedStreams = 0;
    let completedStreams = 0;
    let partialStreams = 0;

    const trackCounts: Record<
      string,
      { trackName: string; artistName: string; skips: number; plays: number; completions: number }
    > = {};

    for (const s of filtered) {
      const key = `${s.trackName}___${s.artistName}`;
      if (!trackCounts[key]) {
        trackCounts[key] = { trackName: s.trackName, artistName: s.artistName, skips: 0, plays: 0, completions: 0 };
      }
      trackCounts[key].plays++;

      // Industry standard Spotify metrics
      if (s.msPlayed < 30000) {
        skippedStreams++;
        trackCounts[key].skips++;
      } else if (s.msPlayed >= 180000) {
        // >= 3 minutes
        completedStreams++;
        trackCounts[key].completions++;
      } else {
        partialStreams++;
      }
    }

    const all = Object.values(trackCounts);
    const topSkippedTracks = all
      .filter((t) => t.skips > 0)
      .sort((a, b) => b.skips - a.skips)
      .slice(0, 10)
      .map((t) => ({ trackName: t.trackName, artistName: t.artistName, skipCount: t.skips, playCount: t.plays }));

    const mostCompletedTracks = all
      .filter((t) => t.completions > 0)
      .sort((a, b) => b.completions - a.completions)
      .slice(0, 10)
      .map((t) => ({
        trackName: t.trackName,
        artistName: t.artistName,
        completionCount: t.completions,
        playCount: t.plays,
      }));

    const completionRate = totalStreams > 0 ? parseFloat(((completedStreams / totalStreams) * 100).toFixed(1)) : 0;
    const skipRate = totalStreams > 0 ? parseFloat(((skippedStreams / totalStreams) * 100).toFixed(1)) : 0;

    return {
      totalStreams,
      completedStreams,
      skippedStreams,
      partialStreams,
      completionRate,
      skipRate,
      topSkippedTracks,
      mostCompletedTracks,
    };
  }

  /* ==========================================================================
     Real-Time Stream Recording (Live Skips & Local Captures)
     ========================================================================== */

  public recordLocalSkip(track: {
    trackName: string;
    artistName: string;
    albumName: string;
    albumArt: string;
    msPlayed: number;
    durationMs: number;
  }): void {
    if (!this.streams) {
      this.streams = [];
    }

    const nowIso = new Date().toISOString();
    const newStream: any = {
      trackName: track.trackName,
      artistName: track.artistName,
      albumName: track.albumName,
      albumArt: track.albumArt,
      msPlayed: Math.max(1000, track.msPlayed),
      durationMs: track.durationMs,
      ts: nowIso,
      skipped: true,
      reason_end: 'fwdbtn',
    };

    // Prevent duplicate entries if triggered within 5 seconds
    const alreadyLogged = this.streams.some(
      (s) => s.trackName === track.trackName && Math.abs(new Date(s.ts).getTime() - new Date(nowIso).getTime()) < 5000,
    );

    if (!alreadyLogged) {
      this.streams.unshift(newStream);
      // Persist to local data store
      if (typeof (this as any).saveData === 'function') {
        (this as any).saveData();
      }
    }
  }

  /**
   * FEATURE 4: Interactive Genre Breakdown & Matrix
   */
  public getGenreBreakdown(config: SpotifyFilterConfig): SpotifyGenreShare[] {
    const filtered = this.getFilteredStreams(config).filter((s) => s.msPlayed >= 25000);
    const genreMap: Record<string, number> = {};

    // Built-in intelligent genre mapping keywords
    const genreKeywords: Record<string, { icon: string; match: RegExp }> = {
      'Ambient & White Noise': {
        icon: '🌊',
        match: /thunder|rain|storm|sleep|ambient|meditation|waves|noise|nature|calm/i,
      },
      'Pop & Dance': { icon: '✨', match: /pop|dance|disco|club|chart|summer|party|synthpop/i },
      'Hip-Hop & R&B': { icon: '🎤', match: /hip-hop|rap|trap|r&b|soul|urban|drill/i },
      'Rock & Alternative': { icon: '🎸', match: /rock|metal|punk|alternative|indie|grunge|guitar/i },
      'Electronic & EDM': { icon: '⚡', match: /electronic|house|techno|edm|trance|electro|dubstep/i },
      'Classical & Instrumental': {
        icon: '🎻',
        match: /classical|orchestra|piano|symphony|instrumental|violin|soundtrack|score/i,
      },
      'Bengali & South Asian': {
        icon: '🪕',
        match: /bangla|bengali|rabindra|nazrul|hindi|tamil|bollywood|desi|ghazal/i,
      },
      'Acoustic & Folk': { icon: '☕', match: /acoustic|folk|singer-songwriter|unplugged|chill/i },
    };

    let classifiedStreams = 0;

    for (const s of filtered) {
      const combined = `${s.trackName} ${s.artistName} ${s.albumName}`;
      let matched = false;

      for (const [category, meta] of Object.entries(genreKeywords)) {
        if (meta.match.test(combined)) {
          genreMap[category] = (genreMap[category] || 0) + 1;
          classifiedStreams++;
          matched = true;
          break;
        }
      }

      if (!matched) {
        genreMap['Other / Diverse'] = (genreMap['Other / Diverse'] || 0) + 1;
        classifiedStreams++;
      }
    }

    return Object.entries(genreMap)
      .map(([genre, count]) => {
        const icon = genreKeywords[genre]?.icon || '🎵';
        const percentage = classifiedStreams > 0 ? parseFloat(((count / classifiedStreams) * 100).toFixed(1)) : 0;
        return { genre, playCount: count, percentage, icon };
      })
      .sort((a, b) => b.playCount - a.playCount);
  }

  /**
   * FEATURE 5: "On This Day" Time Machine Engine
   */
  public getOnThisDayBuckets(nowDate: Date = new Date()): SpotifyThrowbackBucket[] {
    const buckets: SpotifyThrowbackBucket[] = [];
    const availableYears = this.getAvailableYears();
    const currentYear = nowDate.getFullYear();
    const targetMonth = nowDate.getMonth();
    const targetDay = nowDate.getDate();

    // 1. Same Day - Previous Month
    const prevMonthDate = new Date(currentYear, targetMonth - 1, targetDay);
    if (prevMonthDate.getMonth() === (targetMonth - 1 + 12) % 12) {
      const key = this.toLocalDateKey(prevMonthDate);
      const streams = this.getStreamsForDay(key);
      const totalHours = parseFloat((streams.reduce((acc, s) => acc + s.msPlayed, 0) / 3600000).toFixed(1));
      buckets.push({
        periodLabel: `1 Month Ago (${prevMonthDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})`,
        targetDate: key,
        streams,
        totalHours,
      });
    }

    // 2. Same Day - 2 Months Ago
    const twoMonthsDate = new Date(currentYear, targetMonth - 2, targetDay);
    if (twoMonthsDate.getMonth() === (targetMonth - 2 + 12) % 12) {
      const key = this.toLocalDateKey(twoMonthsDate);
      const streams = this.getStreamsForDay(key);
      const totalHours = parseFloat((streams.reduce((acc, s) => acc + s.msPlayed, 0) / 3600000).toFixed(1));
      buckets.push({
        periodLabel: `2 Months Ago (${twoMonthsDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})`,
        targetDate: key,
        streams,
        totalHours,
      });
    }

    // 3. Same Day - Historical Years (1 Year ago, 2025, 2024, 2023, ...)
    for (const yr of availableYears) {
      if (yr >= currentYear) continue; // Past years only
      const pastDate = new Date(yr, targetMonth, targetDay);
      const key = this.toLocalDateKey(pastDate);
      const streams = this.getStreamsForDay(key);
      const totalHours = parseFloat((streams.reduce((acc, s) => acc + s.msPlayed, 0) / 3600000).toFixed(1));

      const yearsAgo = currentYear - yr;
      const label = yearsAgo === 1 ? `1 Year Ago (${yr})` : `${yearsAgo} Years Ago (${yr})`;

      buckets.push({
        periodLabel: `On This Day: ${label}`,
        targetDate: key,
        streams,
        totalHours,
      });
    }

    return buckets;
  }

  public getStreamsForDay(dateStr: string): SpotifyStreamRecord[] {
    return this.streams.filter((s) => this.toLocalDateKey(s.ts) === dateStr);
  }

  private cleanQuery(title: string): string {
    return title
      .replace(/\s*-\s*\d{4}\s*remaster.*/gi, '')
      .replace(/\s*-\s*remastered.*/gi, '')
      .replace(/\s*\(remastered.*\)/gi, '')
      .replace(/\s*\(feat\..*?\)/gi, '')
      .replace(/\s*\[feat\..*?\]/gi, '')
      .replace(/\s*-\s*live.*/gi, '')
      .trim();
  }

  public async resolveCoverArt(title: string, artist: string, type: 'track' | 'album'): Promise<string | null> {
    const cacheKey = `${type}___${title}___${artist}`;
    if (this.artCache[cacheKey]) return this.artCache[cacheKey];

    const cleaned = this.cleanQuery(title);
    const entity = type === 'album' ? 'album' : 'song';

    try {
      const query = encodeURIComponent(`${cleaned} ${artist}`);
      const res = await requestUrl({
        url: `https://itunes.apple.com/search?term=${query}&entity=${entity}&limit=1`,
      });

      if (res.json?.results?.length > 0) {
        const item = res.json.results[0];
        const art = (item.artworkUrl100 || item.artworkUrl60)?.replace('100x100bb', '300x300bb');
        if (art) {
          this.artCache[cacheKey] = art;
          this.saveArtCache();
          return art;
        }
      }

      const titleOnlyQuery = encodeURIComponent(cleaned);
      const res2 = await requestUrl({
        url: `https://itunes.apple.com/search?term=${titleOnlyQuery}&entity=${entity}&limit=1`,
      });

      if (res2.json?.results?.length > 0) {
        const item = res2.json.results[0];
        const art = (item.artworkUrl100 || item.artworkUrl60)?.replace('100x100bb', '300x300bb');
        if (art) {
          this.artCache[cacheKey] = art;
          this.saveArtCache();
          return art;
        }
      }
    } catch {
      // Fallback
    }

    return null;
  }

  public async resolveArtistImage(artistName: string): Promise<string | null> {
    const cacheKey = `artist___${artistName}`;
    if (this.artCache[cacheKey]) return this.artCache[cacheKey];

    try {
      const q = encodeURIComponent(artistName);
      const res = await requestUrl({
        url: `https://api.deezer.com/search/artist?q=${q}&limit=1`,
      });

      if (res.json?.data?.length > 0) {
        const artist = res.json.data[0];
        const pic = artist.picture_medium || artist.picture_big || artist.picture;
        if (pic) {
          this.artCache[cacheKey] = pic;
          this.saveArtCache();
          return pic;
        }
      }
    } catch {
      // Fallback
    }

    return null;
  }

  public async getValidAccessToken(): Promise<string | null> {
    if (!this.settings?.spotifyClientId || !this.settings?.spotifyRefreshToken) {
      return null;
    }

    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const res = await requestUrl({
        url: 'https://accounts.spotify.com/api/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.settings.spotifyClientId,
          refresh_token: this.settings.spotifyRefreshToken,
        }).toString(),
      });

      if (res.json?.access_token) {
        this.accessToken = res.json.access_token;
        this.tokenExpiresAt = Date.now() + (res.json.expires_in - 60) * 1000;
        return this.accessToken;
      }
    } catch (err) {
      console.error('Vitals: Failed to refresh Spotify token:', err);
    }
    return null;
  }

  public async syncRecentlyPlayed(): Promise<number> {
    const token = await this.getValidAccessToken();
    if (!token) return 0;

    try {
      const res = await requestUrl({
        url: 'https://api.spotify.com/v1/me/player/recently-played?limit=50',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.json?.items || !Array.isArray(res.json.items)) return 0;

      let newStreamsCount = 0;
      const existingFingerprints = new Set(
        this.streams.map((s) => this.buildFingerprint(s.ts, s.trackName, s.artistName)),
      );

      for (const item of res.json.items) {
        const playedAt = item.played_at;
        const track = item.track?.name;
        const artist = item.track?.artists?.[0]?.name;
        const album = item.track?.album?.name || 'Unknown Album';
        const ms = item.track?.duration_ms || 0;
        const art = item.track?.album?.images?.[0]?.url;

        if (!playedAt || !track || !artist) continue;

        const fingerprint = this.buildFingerprint(playedAt, track, artist);
        if (!existingFingerprints.has(fingerprint)) {
          existingFingerprints.add(fingerprint);
          this.streams.unshift({
            ts: playedAt,
            trackName: track,
            artistName: artist,
            albumName: album,
            msPlayed: ms,
            spotifyTrackUri: item.track?.uri,
            albumArt: art,
          });

          if (art) {
            this.artCache[`track___${track}___${artist}`] = art;
            this.artCache[`album___${album}___${artist}`] = art;
          }
          newStreamsCount++;
        }
      }

      if (newStreamsCount > 0) {
        this.streams.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
        this.saveToStorage();
        this.saveArtCache();
      }

      return newStreamsCount;
    } catch (err) {
      console.error('Vitals: Error syncing Spotify recently-played:', err);
      return 0;
    }
  }

  public async fetchNowPlaying(): Promise<SpotifyNowPlaying | null> {
    const token = await this.getValidAccessToken();

    if (!token && !this.settings?.spotifyRefreshToken) {
      return {
        isPlaying: true,
        trackName: 'Starboy',
        artistName: 'The Weeknd, Daft Punk',
        albumName: 'Starboy',
        albumArt: 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452',
        progressMs: 142000,
        durationMs: 230000,
        externalUrl: 'https://open.spotify.com',
      };
    }

    if (!token) return null;

    try {
      const res = await requestUrl({
        url: 'https://api.spotify.com/v1/me/player/currently-playing',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 204 || !res.json || !res.json.item) {
        return {
          isPlaying: false,
          trackName: 'Nothing Playing',
          artistName: 'Spotify Idle',
          albumName: 'Ready to stream',
          albumArt: '',
          progressMs: 0,
          durationMs: 0,
        };
      }

      const data = res.json;
      return {
        isPlaying: Boolean(data.is_playing),
        trackName: data.item.name || 'Unknown Track',
        artistName: data.item.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        albumName: data.item.album?.name || 'Unknown Album',
        albumArt: data.item.album?.images?.[0]?.url || '',
        progressMs: data.progress_ms || 0,
        durationMs: data.item.duration_ms || 1,
        externalUrl: data.item.external_urls?.spotify,
      };
    } catch {
      return null;
    }
  }

  public clearAllData(): void {
    this.streams = [];
    this.artCache = {};
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.artCacheKey);
  }
}
