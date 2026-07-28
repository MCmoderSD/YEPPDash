import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service, signal, Signal, WritableSignal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { ChatColor } from '../data/chat-color';
import { ChannelUser } from '../data/channel-user';
import { TwitchUser } from '../data/twitch-user';

// Twitch resolves at most 100 ids/logins per Get Users call, and the backend rejects anything
// beyond that, so longer lists are split up here instead of at every call site.
const BATCH_SIZE = 100;

@Service()
export class TwitchService {

  private readonly http: HttpClient = inject(HttpClient);

  private readonly color: WritableSignal<string | null> = signal<string | null>(null);

  private readonly moderatorList: WritableSignal<ChannelUser[] | null> = signal<ChannelUser[] | null>(null);

  private readonly vipList: WritableSignal<ChannelUser[] | null> = signal<ChannelUser[] | null>(null);

  readonly chatColor: Signal<string | null> = this.color.asReadonly();

  // null means "not loaded yet", an empty array means "loaded, the channel has none".
  readonly moderators: Signal<ChannelUser[] | null> = this.moderatorList.asReadonly();

  readonly vips: Signal<ChannelUser[] | null> = this.vipList.asReadonly();

  async loadChatColor(): Promise<void> {
    try {
      const response: ChatColor = await firstValueFrom(
        this.http.get<ChatColor>(`${environment.apiBaseUrl}/api/twitch/chat-color`, { withCredentials: true }),
      );
      this.color.set(response.color);
    } catch {
      this.color.set(null);
    }
  }

  // The backend paginates and caches these, so calling this again is cheap — one Helix request
  // when nothing changed. No client-side staleness guessing on top of it.
  async loadModerators(): Promise<ChannelUser[]> {
    const moderators: ChannelUser[] = await this.getChannelUsers('moderators');
    this.moderatorList.set(moderators);
    return moderators;
  }

  async loadVips(): Promise<ChannelUser[]> {
    const vips: ChannelUser[] = await this.getChannelUsers('vips');
    this.vipList.set(vips);
    return vips;
  }

  async getUsers(userIds: readonly string[] = [], logins: readonly string[] = []): Promise<TwitchUser[]> {
    const batches: Promise<TwitchUser[]>[] = this.toBatches(userIds, logins).map(batch => this.getUserBatch(batch));
    const results: TwitchUser[][] = await Promise.all(batches);

    return results.flat();
  }

  async addModerator(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/api/twitch/moderators/${encodeURIComponent(userId)}`, null, { withCredentials: true }),
    );
    this.moderatorList.set(null);
  }

  async removeModerator(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBaseUrl}/api/twitch/moderators/${encodeURIComponent(userId)}`, { withCredentials: true }),
    );
    this.moderatorList.set(null);
  }

  async addVip(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiBaseUrl}/api/twitch/vips/${encodeURIComponent(userId)}`, null, { withCredentials: true }),
    );
    this.vipList.set(null);
  }

  async removeVip(userId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBaseUrl}/api/twitch/vips/${encodeURIComponent(userId)}`, { withCredentials: true }),
    );
    this.vipList.set(null);
  }

  private getChannelUsers(path: string): Promise<ChannelUser[]> {
    return firstValueFrom(
      this.http.get<ChannelUser[]>(`${environment.apiBaseUrl}/api/twitch/${path}`, { withCredentials: true }),
    );
  }

  private getUserBatch(params: HttpParams): Promise<TwitchUser[]> {
    return firstValueFrom(
      this.http.get<TwitchUser[]>(`${environment.apiBaseUrl}/api/twitch/users`, { params, withCredentials: true }),
    );
  }

  private toBatches(userIds: readonly string[], logins: readonly string[]): HttpParams[] {
    const keyed: [string, string][] = [
      ...userIds.map((id): [string, string] => ['id', id]),
      ...logins.map((login): [string, string] => ['login', login]),
    ];

    const batches: HttpParams[] = [];
    for (let start = 0; start < keyed.length; start += BATCH_SIZE) {
      batches.push(keyed.slice(start, start + BATCH_SIZE).reduce(
        (params, [key, value]) => params.append(key, value),
        new HttpParams(),
      ));
    }

    return batches;
  }
}
