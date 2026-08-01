import { TwitchUser } from './twitch-user';

export interface Moderator extends TwitchUser {}

export interface Vip extends TwitchUser {}

export interface Editor extends TwitchUser {
  editorSince: string;
}