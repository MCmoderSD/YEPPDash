import { COMMA, ENTER, SPACE } from '@angular/cdk/keycodes';
import {
  Component,
  computed,
  input,
  InputSignal,
  linkedSignal,
  output,
  OutputEmitterRef,
  Signal,
  WritableSignal,
} from '@angular/core';
import { MatChipInputEvent } from '@angular/material/chips';
import {
  cleanTrigger,
  COMMAND_MAX_LENGTH,
  CommandResponseType,
  CommandUserLevel,
  CustomCommand,
  CustomCommandDraft,
  DEFAULT_RESPONSE_TYPE,
  DEFAULT_USER_LEVEL,
  isValidTrigger,
  joinAliases,
  RESPONSE_TYPE_LABELS,
  RESPONSE_TYPES,
  sameTrigger,
  USER_LEVEL_LABELS,
  USER_LEVELS,
} from '../../data/custom-command';

@Component({
  selector: 'app-command-edit',
  templateUrl: './command-edit.component.html',
  styleUrl: './command-edit.component.scss',
  standalone: false,
})
export class CommandEditComponent {

  readonly command: InputSignal<CustomCommand | null> = input<CustomCommand | null>(null);

  // The triggers already taken in this channel, so a collision is shown while typing rather than
  // coming back as a 409 after Save. Excludes this command's own — it may keep them.
  readonly taken: InputSignal<string[]> = input<string[]>([]);

  readonly busy: InputSignal<boolean> = input<boolean>(false);

  readonly save: OutputEmitterRef<CustomCommandDraft> = output<CustomCommandDraft>();

  readonly cancel: OutputEmitterRef<void> = output<void>();

  protected readonly maxLength: number = COMMAND_MAX_LENGTH;

  // Enter and comma are the usual ways to finish a chip; space is here because a trigger cannot
  // contain one anyway, so typing one clearly means "next alias".
  protected readonly separators: number[] = [ENTER, COMMA, SPACE];

  protected readonly responseTypes: readonly CommandResponseType[] = RESPONSE_TYPES;

  protected readonly userLevels: readonly CommandUserLevel[] = USER_LEVELS;

  // Labels are looked up rather than carried alongside each value: one of them reads differently
  // than the enum spells it ("Vip" on the wire, "VIP" in the picker).
  protected readonly responseTypeLabels: Readonly<Record<CommandResponseType, string>> = RESPONSE_TYPE_LABELS;

  protected readonly userLevelLabels: Readonly<Record<CommandUserLevel, string>> = USER_LEVEL_LABELS;

  // Seeded from the command and reset whenever a different one is opened, so the fields never show
  // what was typed into the row before.
  protected readonly name: WritableSignal<string> =
    linkedSignal<string>((): string => this.command()?.name ?? '');

  protected readonly message: WritableSignal<string> =
    linkedSignal<string>((): string => this.command()?.message ?? '');

  protected readonly aliases: WritableSignal<string[]> =
    linkedSignal<string[]>((): string[] => [...(this.command()?.aliases ?? [])]);

  protected readonly responseType: WritableSignal<CommandResponseType> =
    linkedSignal<CommandResponseType>((): CommandResponseType => this.command()?.responseType ?? DEFAULT_RESPONSE_TYPE);

  protected readonly userLevel: WritableSignal<CommandUserLevel> =
    linkedSignal<CommandUserLevel>((): CommandUserLevel => this.command()?.userLevel ?? DEFAULT_USER_LEVEL);

  protected readonly adding: Signal<boolean> = computed((): boolean => this.command() === null);

  protected readonly messageLength: Signal<number> = computed((): number => this.message().length);

  private readonly cleanedName: Signal<string> = computed((): string => cleanTrigger(this.name()));

  protected readonly nameError: Signal<string | null> = computed((): string | null => {
    const name: string = this.cleanedName();

    // Nothing typed yet is not an error to shout about — Save is simply still disabled.
    if (!name) return null;

    if (!isValidTrigger(name)) return 'A command name can only contain letters and numbers.';
    if (name.length > this.maxLength) return `A name cannot be longer than ${this.maxLength} characters.`;
    if (this.taken().some((other: string): boolean => sameTrigger(other, name))) {
      return `${name} is already used by another command.`;
    }

    return null;
  });

  // They share one column, so the ceiling is on the joined list rather than on any one of them.
  protected readonly aliasError: Signal<string | null> = computed((): string | null => {
    return joinAliases(this.aliases()).length > this.maxLength
      ? `The aliases together cannot be longer than ${this.maxLength} characters.`
      : null;
  });

  protected readonly valid: Signal<boolean> = computed((): boolean => {
    return this.cleanedName().length > 0
      && this.nameError() === null
      && this.aliasError() === null
      && this.message().trim().length > 0
      && this.message().trim().length <= this.maxLength;
  });

  // Compared against what was opened, so re-saving an untouched command is not offered as an edit.
  protected readonly changed: Signal<boolean> = computed((): boolean => {
    const command: CustomCommand | null = this.command();
    if (!command) return true;

    return this.cleanedName() !== command.name
      || this.message().trim() !== command.message.trim()
      || this.responseType() !== command.responseType
      || this.userLevel() !== command.userLevel
      || this.aliases().join(' ') !== command.aliases.join(' ');
  });

  protected readonly canSave: Signal<boolean> = computed((): boolean =>
    this.valid() && this.changed() && !this.busy());

  protected addAlias(event: MatChipInputEvent): void {
    // Split on whitespace and commas rather than taken whole: neither can survive into a stored
    // trigger — a space stops it firing and a comma splits the column the aliases share — so both
    // clearly mean "next alias". This is also what catches a paste, or a field left on blur.
    const entered: string[] = event.value
      .split(/[\s,]+/)
      .map(cleanTrigger)
      .filter((alias: string): boolean => isValidTrigger(alias));

    // Cleared either way, so a dropped duplicate does not sit in the field looking unsubmitted.
    event.chipInput.clear();
    if (entered.length === 0) return;

    this.aliases.update((aliases: string[]): string[] => {
      // A set: an alias that repeats the name or one already in the list adds nothing, so it is
      // dropped here rather than stored twice and silently collapsed by the API.
      const added: string[] = entered.filter((alias: string, index: number): boolean =>
        !sameTrigger(alias, this.cleanedName())
        && !aliases.some((other: string): boolean => sameTrigger(other, alias))
        && entered.findIndex((other: string): boolean => sameTrigger(other, alias)) === index);

      return added.length === 0 ? aliases : [...aliases, ...added];
    });
  }

  protected removeAlias(alias: string): void {
    this.aliases.update((aliases: string[]): string[] =>
      aliases.filter((other: string): boolean => other !== alias));
  }

  protected submit(): void {
    if (!this.canSave()) return;

    this.save.emit({
      name: this.cleanedName(),
      aliases: this.aliases(),
      message: this.message().trim(),
      responseType: this.responseType(),
      userLevel: this.userLevel(),

      // A new command is switched on the moment it is added; an edit leaves the switch in the row
      // alone, which is the only thing that turns one off.
      active: this.command()?.active ?? true,
    });
  }
}
