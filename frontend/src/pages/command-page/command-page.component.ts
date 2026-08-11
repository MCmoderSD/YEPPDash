import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, Signal, signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommandActiveChange, CommandSubmit, CommandTableComponent } from '../../components/command-table-component/command-table.component';
import { ConfirmActionDialogComponent } from '../../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { AuthService } from '../../services/auth.service';
import { CommandService } from '../../services/command.service';
import { NotificationService } from '../../services/notification.service';
import { CustomCommand, CustomCommandDraft, sameTrigger } from '../../data/custom-command';

function reasonFor(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  if (error.status !== 400 && error.status !== 409) return null;
  return typeof error.error === 'string' && error.error.trim() ? error.error.trim() : null;
}

@Component({
  selector: 'app-command-page',
  templateUrl: './command-page.component.html',
  styleUrl: './command-page.component.scss',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, CommandTableComponent],
})
export class CommandPageComponent {

  private readonly commands: CommandService = inject(CommandService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);

  private readonly entries: WritableSignal<CustomCommand[]> = signal<CustomCommand[]>([]);
  private readonly isLoading: WritableSignal<boolean> = signal(false);
  private readonly isBusy: WritableSignal<boolean> = signal(false);
  private readonly failed: WritableSignal<boolean> = signal(false);

  protected readonly commandList: Signal<CustomCommand[]> = this.entries.asReadonly();
  protected readonly loading: Signal<boolean> = this.isLoading.asReadonly();
  protected readonly busy: Signal<boolean> = this.isBusy.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.failed.asReadonly();

  protected readonly editing: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly adding: WritableSignal<boolean> = signal(false);

  protected readonly count: Signal<number> = computed((): number => this.commandList().length);

  protected readonly activeCount: Signal<number> = computed((): number =>
    this.commandList().filter((command: CustomCommand): boolean => command.active).length);

  constructor() {
    void this.load();
  }

  protected add(): void {
    this.editing.set(null);
    this.adding.set(true);
  }

  protected async submit({ name, draft }: CommandSubmit): Promise<void> {
    const saved: boolean = name === null
      ? await this.create(draft)
      : await this.update(name, draft);

    if (saved) {
      this.editing.set(null);
      this.adding.set(false);
    }
  }

  protected async remove(command: CustomCommand): Promise<void> {
    const confirmed: boolean = await ConfirmActionDialogComponent.confirm(this.dialog, {
      title: `Delete ${command.name}?`,
      message: `YEPPBot will stop answering to ${command.name} in your chat. This cannot be undone.`,
      confirmLabel: 'Delete',
    });

    if (!confirmed) return;

    const deleted: boolean = await this.run(
      async (channelId: string): Promise<void> => {
        await this.commands.deleteCommand(channelId, command.name);
        this.notifications.success(`Deleted ${command.name}.`);
      },
      `Could not delete ${command.name}.`,
    );

    if (deleted && this.editing() === command.name) this.editing.set(null);
  }

  protected async setActive({ command, active }: CommandActiveChange): Promise<void> {
    this.patchActive(command.name, active);

    await this.run(
      async (channelId: string): Promise<void> => {
        const updated: CustomCommand = await this.commands.setActive(channelId, command.name, active);
        this.patchActive(command.name, updated.active);
      },
      `Could not turn ${command.name} ${active ? 'on' : 'off'}.`,
      {
        reload: false,
        revert: (): void => this.patchActive(command.name, command.active),
      },
    );
  }

  private create(draft: CustomCommandDraft): Promise<boolean> {
    return this.run(
      async (channelId: string): Promise<void> => {
        await this.commands.addCommand(channelId, draft);
        this.notifications.success(`Added ${draft.name}.`);
      },
      `Could not add ${draft.name}.`,
    );
  }

  private update(name: string, draft: CustomCommandDraft): Promise<boolean> {
    return this.run(
      async (channelId: string): Promise<void> => {
        await this.commands.updateCommand(channelId, name, draft);
        this.notifications.success(`Updated ${draft.name}.`);
      },
      `Could not update ${name}.`,
    );
  }

  private patchActive(name: string, active: boolean): void {
    this.entries.update((entries: CustomCommand[]): CustomCommand[] => entries.map((entry: CustomCommand): CustomCommand => sameTrigger(entry.name, name) ? { ...entry, active } : entry));
  }

  private async run(
    action: (channelId: string) => Promise<void>,
    failure: string,
    options: { reload?: boolean; revert?: () => void } = {},
  ): Promise<boolean> {
    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return false;

    this.isBusy.set(true);
    try {
      await action(channelId);
      if (options.reload ?? true) this.entries.set(await this.commands.getCommands(channelId));

      return true;
    } catch (error: unknown) {
      options.revert?.();
      this.notifications.failure(reasonFor(error) ?? failure);

      return false;
    } finally {
      this.isBusy.set(false);
    }
  }

  private async load(): Promise<void> {
    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    this.isLoading.set(true);
    this.failed.set(false);
    try {
      this.entries.set(await this.commands.getCommands(channelId));
    } catch {
      this.entries.set([]);
      this.failed.set(true);
      this.notifications.failure('Could not load your commands.');
    } finally {
      this.isLoading.set(false);
    }
  }
}