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

// Letters and numbers in any script, nothing else. A space would stop the command firing at all
// (chat splits on those before it looks one up) and a comma would split it in two, since a
// command's aliases share a single comma-separated column.
const TRIGGER_PATTERN = /^[\p{L}\p{N}]+$/u;

export function commandTriggers(command: CustomCommand): string[] {
  return [command.name, ...command.aliases];
}

/**
 * Cleans one trigger word into the exact form it is stored as. The prefix chat types is not part of
 * the name and is never asked for, but somebody typing it out of habit should get a command that
 * works. Lower case because the table collates binary — the case it is written in is the case it
 * has to be looked up in.
 */
export function cleanTrigger(value: string): string {
  return value.trim().replace(/^!+/, '').trim().toLowerCase();
}

/** Whether a cleaned trigger is one the bot could actually match on. */
export function isValidTrigger(trigger: string): boolean {
  return TRIGGER_PATTERN.test(trigger);
}

/** Whether two triggers would collide. Both are compared as they are stored. */
export function sameTrigger(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/** How the aliases are packed into their one column, which is what the 500 cap applies to. */
export function joinAliases(aliases: readonly string[]): string {
  return aliases.join(',');
}
