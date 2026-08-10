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

  readonly taken: InputSignal<string[]> = input<string[]>([]);

  readonly busy: InputSignal<boolean> = input<boolean>(false);

  readonly save: OutputEmitterRef<CustomCommandDraft> = output<CustomCommandDraft>();

  readonly cancel: OutputEmitterRef<void> = output<void>();

  protected readonly maxLength: number = COMMAND_MAX_LENGTH;

  protected readonly separators: number[] = [ENTER, COMMA, SPACE];

  protected readonly responseTypes: readonly CommandResponseType[] = RESPONSE_TYPES;

  protected readonly userLevels: readonly CommandUserLevel[] = USER_LEVELS;


  protected readonly responseTypeLabels: Readonly<Record<CommandResponseType, string>> = RESPONSE_TYPE_LABELS;

  protected readonly userLevelLabels: Readonly<Record<CommandUserLevel, string>> = USER_LEVEL_LABELS;

  protected readonly name: WritableSignal<string> = linkedSignal<string>((): string => this.command()?.name ?? '');

  protected readonly message: WritableSignal<string> = linkedSignal<string>((): string => this.command()?.message ?? '');

  protected readonly aliases: WritableSignal<string[]> = linkedSignal<string[]>((): string[] => [...(this.command()?.aliases ?? [])]);

  protected readonly responseType: WritableSignal<CommandResponseType> = linkedSignal<CommandResponseType>((): CommandResponseType => this.command()?.responseType ?? DEFAULT_RESPONSE_TYPE);

  protected readonly userLevel: WritableSignal<CommandUserLevel> = linkedSignal<CommandUserLevel>((): CommandUserLevel => this.command()?.userLevel ?? DEFAULT_USER_LEVEL);

  protected readonly adding: Signal<boolean> = computed((): boolean => this.command() === null);

  protected readonly messageLength: Signal<number> = computed((): number => this.message().length);

  private readonly cleanedName: Signal<string> = computed((): string => cleanTrigger(this.name()));

  protected readonly nameError: Signal<string | null> = computed((): string | null => {
    const name: string = this.cleanedName();

    if (!name) return null;

    if (!isValidTrigger(name)) return 'A command name can only contain letters and numbers.';
    if (name.length > this.maxLength) return `A name cannot be longer than ${this.maxLength} characters.`;
    if (this.taken().some((other: string): boolean => sameTrigger(other, name))) {
      return `${name} is already used by another command.`;
    }

    return null;
  });

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
    const entered: string[] = event.value
      .split(/[\s,]+/)
      .map(cleanTrigger)
      .filter((alias: string): boolean => isValidTrigger(alias));

    event.chipInput.clear();
    if (entered.length === 0) return;

    this.aliases.update((aliases: string[]): string[] => {
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
      active: this.command()?.active ?? true,
    });
  }
}