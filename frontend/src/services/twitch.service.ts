import { HttpParams } from '@angular/common/http';
import { Service } from '@angular/core';
import { Editor, Moderator, Vip } from '../data/channel-roles';
import { TwitchUser } from '../data/twitch-user';
import { FollowerProfile, FollowStatus } from '../data/follower';
import { BanStatus } from '../data/banned-user';
import { CategoryPage, ChannelCategory, ChannelInformation, ChannelUpdate } from '../data/channel';
import { ApiService } from './api.service';

@Service()
export class TwitchService extends ApiService {

  constructor() {
    super('twitch');
  }

  getUsers(userIds: readonly string[] = [], logins: readonly string[] = []): Promise<TwitchUser[]> {
    if (userIds.length + logins.length === 0) return Promise.resolve([]);
    return this.get<TwitchUser[]>('users', this.repeated({ id: userIds, login: logins }));
  }

  getModerators(): Promise<Moderator[]> {
    return this.get<Moderator[]>('moderators');
  }

  getModeratorsById(userIds: readonly string[]): Promise<Moderator[]> {
    return this.checkChannelRole<Moderator>('moderators', userIds);
  }

  async isModerator(userId: string): Promise<boolean> {
    return (await this.getModeratorsById([userId])).length > 0;
  }

  addModerator(userId: string): Promise<void> {
    return this.post(`moderators/${encodeURIComponent(userId)}`);
  }

  removeModerator(userId: string): Promise<void> {
    return this.delete(`moderators/${encodeURIComponent(userId)}`);
  }

  getVips(): Promise<Vip[]> {
    return this.get<Vip[]>('vips');
  }

  getVipsById(userIds: readonly string[]): Promise<Vip[]> {
    return this.checkChannelRole<Vip>('vips', userIds);
  }

  async isVip(userId: string): Promise<boolean> {
    return (await this.getVipsById([userId])).length > 0;
  }

  addVip(userId: string): Promise<void> {
    return this.post(`vips/${encodeURIComponent(userId)}`);
  }

  removeVip(userId: string): Promise<void> {
    return this.delete(`vips/${encodeURIComponent(userId)}`);
  }

  getEditors(): Promise<Editor[]> {
    return this.get<Editor[]>('editors');
  }

  getEditorsById(userIds: readonly string[]): Promise<Editor[]> {
    return this.checkChannelRole<Editor>('editors', userIds);
  }

  async isEditor(userId: string): Promise<boolean> {
    return (await this.getEditorsById([userId])).length > 0;
  }

  getFollowers(): Promise<FollowerProfile[]> {
    return this.get<FollowerProfile[]>('followers');
  }

  getFollowStatus(userId: string): Promise<FollowStatus> {
    return this.get<FollowStatus>(`followers/${encodeURIComponent(userId)}`);
  }

  async isFollower(userId: string): Promise<boolean> {
    return (await this.getFollowStatus(userId)).following;
  }

  getChatters(): Promise<TwitchUser[]> {
    return this.get<TwitchUser[]>('chatters');
  }

  getBlocked(): Promise<TwitchUser[]> {
    return this.get<TwitchUser[]>('blocked');
  }

  unblockUser(userId: string): Promise<void> {
    return this.delete(`blocked/${encodeURIComponent(userId)}`);
  }

  getBanStatus(userId: string): Promise<BanStatus> {
    return this.get<BanStatus>(`banned/${encodeURIComponent(userId)}`);
  }

  async isBanned(userId: string): Promise<boolean> {
    return (await this.getBanStatus(userId)).banned;
  }

  unbanUser(userId: string): Promise<void> {
    return this.delete(`banned/${encodeURIComponent(userId)}`);
  }

  getChannel(): Promise<ChannelInformation> {
    return this.get<ChannelInformation>('channel');
  }

  // Resolves with nothing: Modify Channel Information answers 204, so the new values have to be
  // read back rather than taken from the reply.
  updateChannel(update: ChannelUpdate): Promise<void> {
    return this.patch<void>('channel', update);
  }

  // The channel answers with a game id and name but no cover, so this is how the category already
  // set gets one to show.
  getGames(gameIds: readonly string[]): Promise<ChannelCategory[]> {
    if (gameIds.length === 0) return Promise.resolve([]);
    return this.get<ChannelCategory[]>('games', this.repeated({ id: gameIds }));
  }

  // One page per call, and no cache anywhere in between — a search over every category on Twitch
  // has nothing worth keeping between two different search terms.
  searchCategories(query: string, cursor: string | null = null): Promise<CategoryPage> {
    let params: HttpParams = new HttpParams().set('query', query);
    if (cursor !== null) params = params.set('after', cursor);

    return this.get<CategoryPage>('categories', params);
  }

  private checkChannelRole<T>(path: string, userIds: readonly string[]): Promise<T[]> {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.get<T[]>(`${path}/check`, this.repeated({ id: userIds }));
  }

  private repeated(values: Record<string, readonly string[]>): HttpParams {
    return Object.entries(values).reduce(
      (params: HttpParams, [key, list]: [string, readonly string[]]): HttpParams =>
        list.reduce((carried: HttpParams, value: string): HttpParams => carried.append(key, value), params),
      new HttpParams(),
    );
  }
}