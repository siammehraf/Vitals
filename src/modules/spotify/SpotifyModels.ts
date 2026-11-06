export type SpotifyTimeRange = 'short_term' | 'medium_term' | 'long_term';

export interface SpotifyStreamRecord {
  ts: string;
  trackName: string;
  artistName: string;
  albumName: string;
  msPlayed: number;
  spotifyTrackUri?: string;
  albumArt?: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  durationMs: number;
  playCount: number;
  totalMsPlayed?: number;
  albumArt?: string;
  externalUrl?: string;
  popularity?: number;
}

export interface SpotifyArtist {
  id?: string;
  name: string;
  playCount: number;
  totalMsPlayed?: number;
  imageUrl?: string;
  genres?: string[];
  popularity?: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artist: string;
  playCount: number;
  totalMsPlayed: number;
  albumArt?: string;
}

export interface SpotifyNowPlaying {
  isPlaying: boolean;
  trackName: string;
  artistName: string;
  albumName: string;
  albumArt: string;
  progressMs: number;
  durationMs: number;
  externalUrl?: string;
}

export interface SpotifyHeatmapDay {
  date: string;
  hours: number;
  streamCount: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface SpotifyHourlyDistribution {
  hour: number; // 0 - 23
  label: string; // "12 AM", "1 PM"
  streamCount: number;
  totalMs: number;
  hours: number;
  percentage: number;
}

export interface SpotifySkipAnalytics {
  totalStreams: number;
  completedStreams: number;
  skippedStreams: number;
  partialStreams: number;
  completionRate: number; // 0 - 100
  skipRate: number; // 0 - 100
  topSkippedTracks: { trackName: string; artistName: string; skipCount: number; playCount: number }[];
  mostCompletedTracks: { trackName: string; artistName: string; completionCount: number; playCount: number }[];
}

export interface SpotifyGenreShare {
  genre: string;
  playCount: number;
  percentage: number;
  icon: string;
}

export interface SpotifyThrowbackBucket {
  periodLabel: string; // e.g. "On This Day (1 Year Ago - Nov 6, 2025)"
  targetDate: string; // YYYY-MM-DD
  streams: SpotifyStreamRecord[];
  totalHours: number;
}

export type SpotifyFilterMode =
  | 'today'
  | 'custom_day'
  | '4w'
  | '1m'
  | '3m'
  | '6m'
  | '1y'
  | 'specific_year'
  | 'lifetime';

export interface SpotifyFilterConfig {
  mode: SpotifyFilterMode;
  customDay?: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  selectedYear?: number;
}

export type SpotifyStatsTab =
  | 'recently_played'
  | 'listening_hours'
  | 'diurnal_clock'
  | 'skip_analytics'
  | 'genres'
  | 'time_machine'
  | 'tracks'
  | 'artists'
  | 'albums'
  | 'stream_history';
