import { requestUrl, Notice } from 'obsidian';
import { VitalsSettings } from '../../settings/VitalsSettings';

declare const require: any;

// Safely access Node's built-in http module inside Electron
const http = require('http');

const REDIRECT_URI = 'http://127.0.0.1:48321/callback';
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'user-top-read',
].join(' ');

export class SpotifyAuthService {
  private static server: any = null;

  private static generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private static async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  public static async loginWithSpotify(settings: VitalsSettings, onSuccess: () => Promise<void>): Promise<void> {
    if (!settings.spotifyClientId) {
      new Notice('Please enter your Spotify Client ID in Vitals settings first.');
      return;
    }

    if (this.server) {
      try {
        this.server.close();
      } catch {
        // Ignore close error
      }
      this.server = null;
    }

    const verifier = this.generateRandomString(64);
    const challenge = await this.generateCodeChallenge(verifier);

    this.server = http.createServer(async (req: any, res: any) => {
      try {
        const url = new URL(req.url || '', 'http://127.0.0.1:48321');
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h3>Spotify Authorization Denied. You may close this tab.</h3>');
          this.closeServer();
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(
            "<h2 style='font-family:sans-serif;text-align:center;margin-top:50px;'>Authentication successful! You can close this tab and return to Obsidian.</h2>",
          );

          await this.exchangeCodeForToken(code, verifier, settings);
          await onSuccess();
          new Notice('Connected to Spotify successfully!');
          this.closeServer();
        }
      } catch (err) {
        console.error('Error handling Spotify callback:', err);
        this.closeServer();
      }
    });

    this.server.listen(48321, '127.0.0.1', () => {
      const authUrl =
        `https://accounts.spotify.com/authorize?` +
        new URLSearchParams({
          response_type: 'code',
          client_id: settings.spotifyClientId,
          scope: SCOPES,
          redirect_uri: REDIRECT_URI,
          code_challenge_method: 'S256',
          code_challenge: challenge,
        }).toString();

      window.open(authUrl);
    });

    setTimeout(() => {
      this.closeServer();
    }, 180000);
  }

  private static async exchangeCodeForToken(code: string, verifier: string, settings: VitalsSettings): Promise<void> {
    const params = new URLSearchParams({
      client_id: settings.spotifyClientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    });

    const res = await requestUrl({
      url: 'https://accounts.spotify.com/api/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (res.json?.refresh_token) {
      settings.spotifyRefreshToken = res.json.refresh_token;
    }
  }

  private static closeServer(): void {
    if (this.server) {
      try {
        this.server.close();
      } catch {
        // Ignore close error
      }
      this.server = null;
    }
  }
}
