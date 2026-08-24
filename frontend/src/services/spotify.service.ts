import { HttpParams } from '@angular/common/http';
import { Service } from '@angular/core';
import { ApiService } from './api.service';
import { environment } from '../environments/environment';
import { SongRequest, SpotifyBlocklistEntry, SpotifyBlocklistType, SpotifyPlayback, SpotifyQueueEntry, SpotifySettings, SpotifyStatus, SpotifyTrack } from '../data/spotify';

@Service()
export class SpotifyService extends ApiService {

  constructor() {
    super('spotify');
  }

  /**
   * A full page navigation rather than a fetch: the answer is a redirect to Spotify's own consent
   * screen, and that has to happen in the address bar to be something a person can trust.
   */
  connectUrl(returnUrl: string): string {
    return `${environment.apiBaseUrl}/spotify/connect?returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  getStatus(channelId: string): Promise<SpotifyStatus> {
    return this.get<SpotifyStatus>(`${encodeURIComponent(channelId)}/status`);
  }

  disconnect(channelId: string): Promise<void> {
    return this.delete<void>(`${encodeURIComponent(channelId)}/connection`);
  }

  getPlayback(channelId: string): Promise<SpotifyPlayback> {
    return this.get<SpotifyPlayback>(`${encodeURIComponent(channelId)}/state`);
  }

  getQueue(channelId: string): Promise<SpotifyQueueEntry[]> {
    return this.get<SpotifyQueueEntry[]>(`${encodeURIComponent(channelId)}/queue`);
  }

  play(channelId: string): Promise<void> {
    return this.post<void>(`${encodeURIComponent(channelId)}/play`);
  }

  pause(channelId: string): Promise<void> {
    return this.post<void>(`${encodeURIComponent(channelId)}/pause`);
  }

  next(channelId: string): Promise<void> {
    return this.post<void>(`${encodeURIComponent(channelId)}/next`);
  }

  search(channelId: string, query: string): Promise<SpotifyTrack[]> {
    return this.get<SpotifyTrack[]>(
      `${encodeURIComponent(channelId)}/search`, new HttpParams().set('q', query));
  }

  /**
   * Sends the text untouched — a link, a URI or something to search for. The backend decides which,
   * so the same input works here and in chat without two parsers to keep in step.
   */
  request(channelId: string, input: string): Promise<{ track: string; artists: string; trackId: string }> {
    return this.post(`${encodeURIComponent(channelId)}/request`, { input });
  }

  getSettings(channelId: string): Promise<SpotifySettings> {
    return this.get<SpotifySettings>(`${encodeURIComponent(channelId)}/settings`);
  }

  saveSettings(channelId: string, settings: SpotifySettings): Promise<SpotifySettings> {
    return this.put<SpotifySettings>(`${encodeURIComponent(channelId)}/settings`, settings);
  }

  getBlocklist(channelId: string): Promise<SpotifyBlocklistEntry[]> {
    return this.get<SpotifyBlocklistEntry[]>(`${encodeURIComponent(channelId)}/blocklist`);
  }

  block(channelId: string, entryType: SpotifyBlocklistType, entryId: string, name: string, reason: string | null): Promise<SpotifyBlocklistEntry[]> {
    return this.post<SpotifyBlocklistEntry[]>(
      `${encodeURIComponent(channelId)}/blocklist`, { entryType, entryId, name, reason });
  }

  unblock(channelId: string, id: number): Promise<void> {
    return this.delete<void>(`${encodeURIComponent(channelId)}/blocklist/${id}`);
  }

  getHistory(channelId: string, requestedBy?: string): Promise<SongRequest[]> {
    const params: HttpParams | undefined = requestedBy
      ? new HttpParams().set('requestedBy', requestedBy)
      : undefined;

    return this.get<SongRequest[]>(`${encodeURIComponent(channelId)}/history`, params);
  }
}
