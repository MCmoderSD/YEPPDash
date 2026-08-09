// One of YEPPBot's built-in commands. The list is fixed — the bot has no route that enumerates its
// commands, so the backend hard-codes them and only the enabled flag is per channel.
export interface BotModule {
  id: string;
  name: string;
  description: string;
  aliases: string[];
  enabled: boolean;
}

// The bot resolves an alias to the command's own name before it checks whether it is blocked, so
// these are worth showing but never worth sending.
export function moduleTriggers(module: BotModule): string[] {
  return [module.id, ...module.aliases];
}