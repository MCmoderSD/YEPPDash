import {
  Component,
  computed,
  effect,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import {
  commandTriggers,
  CustomCommand,
  CustomCommandDraft,
  DEFAULT_RESPONSE_TYPE,
  DEFAULT_USER_LEVEL,
} from '../../data/custom-command';

export interface CommandActiveChange {
  command: CustomCommand;
  active: boolean;
}

export interface CommandSubmit {
  name: string | null;
  draft: CustomCommandDraft;
}

// The row a new command is typed into. It sits in the table like any other so the form opens in the
// same place it will later be edited from; the empty name is what marks it as not yet a command.
const DRAFT: CustomCommand = {
  name: '',
  aliases: [],
  message: '',
  active: true,
  responseType: DEFAULT_RESPONSE_TYPE,
  userLevel: DEFAULT_USER_LEVEL,
};

function isDraft(command: CustomCommand): boolean {
  return command.name === '';
}

@Component({
  selector: 'app-command-table',
  templateUrl: './command-table.component.html',
  styleUrl: './command-table.component.scss',
  standalone: false,
})
export class CommandTableComponent {

  readonly commands: InputSignal<CustomCommand[]> = input.required<CustomCommand[]>();

  // Set while a write is in flight, so a second click cannot start one on top of it.
  readonly busy: InputSignal<boolean> = input<boolean>(false);

  readonly loading: InputSignal<boolean> = input<boolean>(false);

  readonly unreachable: InputSignal<boolean> = input<boolean>(false);

  readonly editing: ModelSignal<string | null> = model<string | null>(null);

  readonly adding: ModelSignal<boolean> = model<boolean>(false);

  // Deliberately not called `submit`: the form inside an open row fires a native, bubbling submit
  // event, and an output sharing that name is reached by the DOM event as well — handing the page a
  // SubmitEvent with no draft on it.
  readonly save: OutputEmitterRef<CommandSubmit> = output<CommandSubmit>();

  readonly remove: OutputEmitterRef<CustomCommand> = output<CustomCommand>();

  readonly setActive: OutputEmitterRef<CommandActiveChange> = output<CommandActiveChange>();

  protected readonly columns: string[] = ['name', 'aliases', 'message', 'active', 'actions'];

  protected readonly dataSource: MatTableDataSource<CustomCommand> = new MatTableDataSource<CustomCommand>([]);

  protected readonly query: WritableSignal<string> = signal('');

  private readonly rows: Signal<CustomCommand[]> = computed((): CustomCommand[] =>
    this.adding() ? [DRAFT, ...this.commands()] : this.commands());

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  constructor() {
    // Aliases are searched alongside the name, so looking for a word finds the command that answers
    // to it whichever of its triggers that word happens to be. The draft row is never filtered out:
    // it is what is being typed, not something being looked for.
    this.dataSource.filterPredicate = (command: CustomCommand, filter: string): boolean => {
      return isDraft(command)
        || commandTriggers(command).some((trigger: string): boolean => trigger.toLowerCase().includes(filter))
        || command.message.toLowerCase().includes(filter);
    };

    this.dataSource.sortingDataAccessor = (command: CustomCommand, column: string): string | number => {
      switch (column) {
        case 'message': return command.message.toLowerCase();
        case 'aliases': return command.aliases.length;

        // Sorts the off ones together rather than by name, which is the point of sorting on a switch.
        case 'active': return command.active ? 1 : 0;
        default: return command.name.toLowerCase();
      }
    };

    // The draft is pinned to the top rather than sorted with the rest: it has no name to sort on,
    // and a row being typed into should not jump somewhere else as it is filled in.
    const sortData = this.dataSource.sortData;
    this.dataSource.sortData = (data: CustomCommand[], sort: MatSort): CustomCommand[] => {
      const sorted: CustomCommand[] = sortData.call(
        this.dataSource, data.filter((command: CustomCommand): boolean => !isDraft(command)), sort);

      return data.some(isDraft) ? [DRAFT, ...sorted] : sorted;
    };

    effect((): CustomCommand[] => this.dataSource.data = this.rows());
    effect((): void => {
      const sorter: MatSort | undefined = this.sorter();
      if (sorter) this.dataSource.sort = sorter;
    });
  }

  protected readonly trackByName = (_index: number, command: CustomCommand): string => command.name;

  protected isDraft(command: CustomCommand): boolean {
    return isDraft(command);
  }

  protected isOpen(command: CustomCommand): boolean {
    return isDraft(command) ? this.adding() : this.editing() === command.name;
  }

  protected panelId(command: CustomCommand): string {
    return `command-editor-${isDraft(command) ? 'new' : command.name}`;
  }

  protected takenFor(command: CustomCommand): string[] {
    return this.commands()
      .filter((other: CustomCommand): boolean => other.name !== command.name)
      .flatMap(commandTriggers);
  }

  protected filter(value: string): void {
    this.query.set(value.trim());
    this.dataSource.filter = value.trim().toLowerCase();
  }

  protected toggle(command: CustomCommand, event?: Event): void {
    event?.stopPropagation();

    if (isDraft(command)) {
      this.adding.set(false);
      return;
    }

    const next: string | null = this.editing() === command.name ? null : command.name;

    this.editing.set(next);
    if (next !== null) this.adding.set(false);
  }

  protected close(): void {
    this.editing.set(null);
    this.adding.set(false);
  }

  protected saved(command: CustomCommand, draft: CustomCommandDraft): void {
    this.save.emit({ name: isDraft(command) ? null : command.name, draft });
  }

  protected removeCommand(command: CustomCommand, event: Event): void {
    event.stopPropagation();
    this.remove.emit(command);
  }

  protected flip(command: CustomCommand, active: boolean): void {
    this.setActive.emit({ command, active });
  }
}
