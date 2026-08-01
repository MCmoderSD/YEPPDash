export enum CommandResponseType {
  Reply = 'Reply',
  Mention = 'Mention',
  Say = 'Say',
}

export enum CommandUserLevel {
  Everyone = 'Everyone',
  Follower = 'Follower',
  Vip = 'Vip',
  Editor = 'Editor',
  Moderator = 'Moderator',
  Broadcaster = 'Broadcaster',
}

export const RESPONSE_TYPES: readonly CommandResponseType[] = [
  CommandResponseType.Reply,
  CommandResponseType.Mention,
  CommandResponseType.Say,
];

export const USER_LEVELS: readonly CommandUserLevel[] = [
  CommandUserLevel.Everyone,
  CommandUserLevel.Follower,
  CommandUserLevel.Vip,
  CommandUserLevel.Editor,
  CommandUserLevel.Moderator,
  CommandUserLevel.Broadcaster,
];


export const RESPONSE_TYPE_LABELS: Readonly<Record<CommandResponseType, string>> = {
  [CommandResponseType.Reply]: 'Reply',
  [CommandResponseType.Mention]: 'Mention',
  [CommandResponseType.Say]: 'Say',
};

export const USER_LEVEL_LABELS: Readonly<Record<CommandUserLevel, string>> = {
  [CommandUserLevel.Everyone]: 'Everyone',
  [CommandUserLevel.Follower]: 'Follower',
  [CommandUserLevel.Vip]: 'VIP',
  [CommandUserLevel.Editor]: 'Editor',
  [CommandUserLevel.Moderator]: 'Moderator',
  [CommandUserLevel.Broadcaster]: 'Broadcaster',
};

export const DEFAULT_RESPONSE_TYPE: CommandResponseType = CommandResponseType.Reply;
export const DEFAULT_USER_LEVEL: CommandUserLevel = CommandUserLevel.Everyone;


export interface CustomCommand {
  name: string;
  aliases: string[];
  message: string;
  active: boolean;
  responseType: CommandResponseType;
  userLevel: CommandUserLevel;
}


export type CustomCommandDraft = CustomCommand;

export const COMMAND_MAX_LENGTH = 500;

const TRIGGER_PATTERN = /^[\p{L}\p{N}]+$/u;

export function commandTriggers(command: CustomCommand): string[] {
  return [command.name, ...command.aliases];
}

export function cleanTrigger(value: string): string {
  return value.trim().replace(/^!+/, '').trim().toLowerCase();
}

export function isValidTrigger(trigger: string): boolean {
  return TRIGGER_PATTERN.test(trigger);
}

export function sameTrigger(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

export function joinAliases(aliases: readonly string[]): string {
  return aliases.join(',');
}