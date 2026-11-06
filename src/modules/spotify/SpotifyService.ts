import { SpotifyTrack, SpotifyArtist, SpotifyNowPlaying, SpotifyTimeRange } from './SpotifyModels';

export class SpotifyService {
  public static async getMockTopTracks(_timeRange: SpotifyTimeRange = 'medium_term'): Promise<SpotifyTrack[]> {
    return [
      {
        id: 't1',
        name: 'Blinding Lights',
        artists: ['The Weeknd'],
        album: 'After Hours',
        durationMs: 200040,
        playCount: 142,
        popularity: 95,
        albumArt: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
      },
      {
        id: 't2',
        name: 'Starboy',
        artists: ['The Weeknd', 'Daft Punk'],
        album: 'Starboy',
        durationMs: 230453,
        playCount: 110,
        popularity: 88,
        albumArt: 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452',
      },
      {
        id: 't3',
        name: 'As It Was',
        artists: ['Harry Styles'],
        album: "Harry's House",
        durationMs: 167303,
        playCount: 98,
        popularity: 84,
        albumArt: 'https://i.scdn.co/image/ab67616d0000b2732e8f5c35b377b2f6ef8d5be1',
      },
      {
        id: 't4',
        name: 'Save Your Tears',
        artists: ['The Weeknd'],
        album: 'After Hours',
        durationMs: 215626,
        playCount: 85,
        popularity: 79,
        albumArt: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
      },
      {
        id: 't5',
        name: 'Cruel Summer',
        artists: ['Taylor Swift'],
        album: 'Lover',
        durationMs: 178426,
        playCount: 76,
        popularity: 77,
        albumArt: 'https://i.scdn.co/image/ab67616d0000b273e787cffec20aa2a396a61647',
      },
    ];
  }

  public static async getMockTopArtists(_timeRange: SpotifyTimeRange = 'medium_term'): Promise<SpotifyArtist[]> {
    return [
      {
        id: 'a1',
        name: 'The Weeknd',
        playCount: 420,
        imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb214f3cf1cbe7139c1e26ffbb',
        genres: ['canadian pop', 'pop', 'r&b'],
        popularity: 98,
      },
      {
        id: 'a2',
        name: 'Taylor Swift',
        playCount: 310,
        imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb5a00969a4698c3132a15fbb0',
        genres: ['pop'],
        popularity: 100,
      },
      {
        id: 'a3',
        name: 'Daft Punk',
        playCount: 195,
        imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb9b68832a58b2979207dd43ee',
        genres: ['electro', 'filter house'],
        popularity: 82,
      },
      {
        id: 'a4',
        name: 'Harry Styles',
        playCount: 154,
        imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb04d26214300a83e0c0df48e8',
        genres: ['pop'],
        popularity: 86,
      },
    ];
  }

  public static async getMockNowPlaying(): Promise<SpotifyNowPlaying> {
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
}
