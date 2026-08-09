// One line of how a command is actually typed. `moderators` marks the forms the bot refuses to
// anyone below moderator — worth showing, because a chatter who tries one gets no reply at all
// rather than an error, which reads as the module being broken.
export interface BotModuleUsage {
  syntax: string;
  description: string;
  moderators: boolean;
}

// One of YEPPBot's built-in commands. The list is fixed — the bot has no route that enumerates its
// commands, so the backend hard-codes them and only `enabled` is per channel.
export interface BotModule {
  id: string;
  name: string;
  description: string;
  aliases: string[];
  usage: BotModuleUsage[];
  enabled: boolean;
}

// The bot resolves an alias to the command's own name before it checks whether it is blocked, so
// these are worth showing but never worth sending.
export function moduleTriggers(module: BotModule): string[] {
  return [module.id, ...module.aliases];
}