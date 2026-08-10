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
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { CommandEditComponent } from '../command-edit-component/command-edit.component';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
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
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule, MatSortModule, MatTableModule, CommandEditComponent, ScrollBarComponent],
})
export class CommandTableComponent {

  readonly commands: InputSignal<CustomCommand[]> = input.required<CustomCommand[]>();

  readonly busy: InputSignal<boolean> = input<boolean>(false);

  readonly loading: InputSignal<boolean> = input<boolean>(false);

  readonly unreachable: InputSignal<boolean> = input<boolean>(false);

  readonly editing: ModelSignal<string | null> = model<string | null>(null);

  readonly adding: ModelSignal<boolean> = model<boolean>(false);

  readonly save: OutputEmitterRef<CommandSubmit> = output<CommandSubmit>();

  readonly remove: OutputEmitterRef<CustomCommand> = output<CustomCommand>();

  readonly setActive: OutputEmitterRef<CommandActiveChange> = output<CommandActiveChange>();

  protected readonly columns: string[] = ['name', 'aliases', 'message', 'active', 'actions'];

  protected readonly dataSource: MatTableDataSource<CustomCommand> = new MatTableDataSource<CustomCommand>([]);

  protected readonly query: WritableSignal<string> = signal('');

  private readonly rows: Signal<CustomCommand[]> = computed((): CustomCommand[] => this.adding() ? [DRAFT, ...this.commands()] : this.commands());

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  constructor() {
    this.dataSource.filterPredicate = (command: CustomCommand, filter: string): boolean => {
      return isDraft(command)
        || commandTriggers(command).some((trigger: string): boolean => trigger.toLowerCase().includes(filter))
        || command.message.toLowerCase().includes(filter);
    };

    this.dataSource.sortingDataAccessor = (command: CustomCommand, column: string): string | number => {
      switch (column) {
        case 'message': return command.message.toLowerCase();
        case 'aliases': return command.aliases.length;
        case 'active': return command.active ? 1 : 0;
        default: return command.name.toLowerCase();
      }
    };

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