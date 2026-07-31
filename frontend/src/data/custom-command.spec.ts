import {
  cleanTrigger,
  commandTriggers,
  CommandResponseType,
  CommandUserLevel,
  CustomCommand,
  isValidTrigger,
  joinAliases,
  sameTrigger,
} from './custom-command';

function command(overrides: Partial<CustomCommand> = {}): CustomCommand {
  return {
    name: 'hug',
    aliases: ['cuddle', 'snuggle'],
    message: 'YEPP',
    active: true,
    responseType: CommandResponseType.Reply,
    userLevel: CommandUserLevel.Everyone,
    ...overrides,
  };
}

describe('commandTriggers', () => {
  it('should list the name first, then the aliases', () => {
    expect(commandTriggers(command())).toEqual(['hug', 'cuddle', 'snuggle']);
  });

  it('should be just the name when there are no aliases', () => {
    expect(commandTriggers(command({ aliases: [] }))).toEqual(['hug']);
  });
});

describe('cleanTrigger', () => {
  // The prefix is never asked for, but somebody typing it out of habit should still end up with a
  // command that works.
  it('should drop a leading exclamation mark', () => {
    expect(cleanTrigger('!hug')).toBe('hug');
  });

  it('should drop a repeated prefix', () => {
    expect(cleanTrigger('!!hug')).toBe('hug');
  });

  it('should drop the whitespace around it', () => {
    expect(cleanTrigger('  hug  ')).toBe('hug');
  });

  it('should drop whitespace on both sides of the prefix', () => {
    expect(cleanTrigger('  ! hug  ')).toBe('hug');
  });

  // An exclamation mark inside the name is not a prefix, so it stays.
  it('should keep an exclamation mark that is not leading', () => {
    expect(cleanTrigger('yepp!')).toBe('yepp!');
  });

  it('should answer with nothing for a prefix on its own', () => {
    expect(cleanTrigger('!')).toBe('');
  });

  // The table collates binary, so the case a trigger is written in is the case it is looked up in.
  it('should fold to lower case', () => {
    expect(cleanTrigger('HuG')).toBe('hug');
  });
});

describe('isValidTrigger', () => {
  it('should accept letters', () => {
    expect(isValidTrigger('hug')).toBe(true);
  });

  it('should accept digits', () => {
    expect(isValidTrigger('hug2')).toBe(true);
  });

  // Letters, not ASCII letters — another script is not something the bot cannot match on.
  it('should accept letters outside ASCII', () => {
    expect([isValidTrigger('küss'), isValidTrigger('обнять'), isValidTrigger('ハグ')])
      .toEqual([true, true, true]);
  });

  // Chat splits on spaces before it looks a command up, so one could never fire.
  it('should refuse a space', () => {
    expect(isValidTrigger('group hug')).toBe(false);
  });

  // A comma is what joins the aliases in their shared column, so one inside a trigger splits it.
  it('should refuse a comma', () => {
    expect(isValidTrigger('hug,cuddle')).toBe(false);
  });

  it('should refuse punctuation', () => {
    expect([isValidTrigger('hug-me'), isValidTrigger('hug!'), isValidTrigger('hug_me')])
      .toEqual([false, false, false]);
  });

  it('should refuse nothing at all', () => {
    expect(isValidTrigger('')).toBe(false);
  });
});

describe('joinAliases', () => {
  // How they are packed into the one column they share, which is what the 500 cap measures.
  it('should join with commas', () => {
    expect(joinAliases(['cuddle', 'snuggle'])).toBe('cuddle,snuggle');
  });

  it('should be empty when there are none', () => {
    expect(joinAliases([])).toBe('');
  });

  it('should not pad a single alias', () => {
    expect(joinAliases(['cuddle'])).toBe('cuddle');
  });
});

describe('sameTrigger', () => {
  // Chat does not tell !Hug from !hug, so two commands cannot claim both.
  it('should ignore case', () => {
    expect(sameTrigger('Hug', 'hug')).toBe(true);
  });

  it('should tell different words apart', () => {
    expect(sameTrigger('hug', 'hugs')).toBe(false);
  });
});
