import { TwitchUser } from './twitch-user';

export interface Moderator extends TwitchUser {}

export interface Vip extends TwitchUser {}

export interface Editor extends TwitchUser {
  editorSince: string;
}

// What the membership checks answer with: Twitch's own role lists carry nothing but the id, and a
// caller only asking whether somebody is on one has no use for the profile behind it.
export interface ChannelMember {
  userId: string;
}