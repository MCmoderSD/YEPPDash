import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { WheelComponent, WheelSpin } from '../../components/wheel-component/wheel.component';
import { ConfirmActionDialogComponent } from '../../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { WheelWinnerChoice, WheelWinnerDialogComponent, } from '../../components/wheel-winner-dialog-component/wheel-winner-dialog.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { WheelService } from '../../services/wheel.service';
import { addEntry, cleanLabel, entriesFrom, entryText, flattenEntries, hasSeparator, parseWheelFile, removeOne, separatorMessage, shuffleEntries, sliceCount, sortEntries, WHEEL_FILE_NAME, WHEEL_LABEL_MAX_LENGTH, WHEEL_MAX_SLICES, WheelEntry, WheelFile, wheelFileContent, wheelSlices } from '../../data/wheel-entry';
import { wheelOverlayUrl } from '../../data/wheel-overlay';

@Component({
  selector: 'app-wheel-page',
  templateUrl: './wheel-page.component.html',
  styleUrl: './wheel-page.component.scss',
  standalone: false,
})
export class WheelPageComponent {

  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly document: Document = inject(DOCUMENT);
  private readonly auth: AuthService = inject(AuthService);
  private readonly wheels: WheelService = inject(WheelService);

  private readonly wheel: Signal<WheelComponent | undefined> = viewChild(WheelComponent);

  protected readonly entries: WritableSignal<WheelEntry[]> = signal<WheelEntry[]>([]);
  protected readonly draft: WritableSignal<string> = signal('');
  protected readonly loading: WritableSignal<boolean> = signal(false);

  private writing: Promise<void> = Promise.resolve();

  protected readonly columns: string[] = ['entry', 'actions'];

  protected readonly maxLength: number = WHEEL_LABEL_MAX_LENGTH;

  protected readonly slices: Signal<string[]> = computed((): string[] => wheelSlices(this.entries()));

  protected readonly total: Signal<number> = computed((): number => sliceCount(this.entries()));

  protected readonly full: Signal<boolean> = computed((): boolean => this.total() >= WHEEL_MAX_SLICES);

  protected readonly spinning: Signal<boolean> = computed((): boolean => this.wheel()?.spinning() ?? false);

  protected readonly busy: Signal<boolean> = computed((): boolean => this.spinning() || this.loading());

  private readonly channelId: Signal<string | null> = computed((): string | null => this.auth.currentUser()?.id ?? null);

  protected readonly overlayUrl: Signal<string | null> = computed((): string | null => {
    const channelId: string | null = this.channelId();
    return channelId === null ? null : wheelOverlayUrl(channelId);
  });

  protected readonly label: (entry: WheelEntry) => string = entryText;

  constructor() {
    void this.load();
  }

  protected add(): void {
    const label: string = cleanLabel(this.draft());
    if (!label) return;

    if (hasSeparator(label)) {
      this.notifications.failure(separatorMessage());
      return;
    }

    if (this.full()) {
      this.notifications.failure(`A wheel holds at most ${WHEEL_MAX_SLICES} slices.`);
      return;
    }

    this.entries.update((entries: WheelEntry[]): WheelEntry[] => addEntry(entries, label));
    this.draft.set('');
    void this.persist();
  }

  protected addOne(label: string): void {
    if (this.full()) {
      this.notifications.failure(`A wheel holds at most ${WHEEL_MAX_SLICES} slices.`);
      return;
    }

    this.entries.update((entries: WheelEntry[]): WheelEntry[] => addEntry(entries, label));
    void this.persist();
  }

  protected removeOne(label: string): void {
    this.entries.update((entries: WheelEntry[]): WheelEntry[] => removeOne(entries, label));
    void this.persist();
  }

  protected shuffle(): void {
    this.entries.update(shuffleEntries);
    void this.persist();
  }

  protected sort(): void {
    this.entries.update(sortEntries);
    void this.persist();
  }

  protected spin(): void {
    const count: number = this.slices().length;
    const channelId: string | null = this.channelId();
    if (count < 2 || this.spinning() || channelId === null) return;

    const index: number = Math.floor(Math.random() * count);

    this.wheel()?.spin(index);
    void this.wheels.spin(channelId, index).catch((): void => undefined);
  }

  protected async landed(spin: WheelSpin): Promise<void> {
    const choice: WheelWinnerChoice = await WheelWinnerDialogComponent.announce(this.dialog, spin.label);

    const channelId: string | null = this.channelId();
    if (channelId !== null) void this.wheels.dismiss(channelId).catch((): void => undefined);

    if (choice === 'remove') this.removeOne(spin.label);
  }

  protected async clear(): Promise<void> {
    const confirmed: boolean = await ConfirmActionDialogComponent.confirm(this.dialog, {
      title: 'Clear the wheel?',
      message: `All ${this.entries().length} entries will be removed.`,
      confirmLabel: 'Clear',
    });

    if (!confirmed) return;

    this.entries.set([]);
    void this.persist();
  }

  protected export(): void {
    const view: (Window & typeof globalThis) | null = this.document.defaultView;
    if (!view) return;

    const file = new Blob([wheelFileContent(flattenEntries(this.entries()))], {
      type: 'text/plain;charset=utf-8',
    });

    const url: string = view.URL.createObjectURL(file);
    const link: HTMLAnchorElement = this.document.createElement('a');

    link.href = url;
    link.download = WHEEL_FILE_NAME;
    link.click();

    view.URL.revokeObjectURL(url);
  }

  protected async import(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file: File | undefined = input.files?.[0];

    input.value = '';
    if (!file) return;

    const parsed: WheelFile = parseWheelFile(await file.text());

    if (parsed.entries.length === 0) {
      this.notifications.failure('That file holds no entries.');
      return;
    }

    if (this.entries().length > 0) {
      const confirmed: boolean = await ConfirmActionDialogComponent.confirm(this.dialog, {
        title: `Replace the wheel with ${file.name}?`,
        message: `The ${this.entries().length} entries on the wheel will be replaced by the `
          + `${parsed.entries.length} in the file.`,
        confirmLabel: 'Replace',
      });

      if (!confirmed) return;
    }

    this.entries.set(entriesFrom(parsed.entries));

    if (parsed.rejected.length > 0) {
      this.notifications.failure(
        `Skipped ${parsed.rejected.length} line${parsed.rejected.length === 1 ? '' : 's'}: `
        + `an entry cannot contain a comma, and a wheel holds at most ${WHEEL_MAX_SLICES}.`);
    }

    await this.persist();
    this.notifications.success(`Imported ${parsed.entries.length} entries.`);
  }

  protected async copyOverlayUrl(): Promise<void> {
    const url: string | null = this.overlayUrl();
    if (url === null) return;

    const clipboard: Clipboard | undefined = this.document.defaultView?.navigator?.clipboard;

    if (!clipboard) {
      this.notifications.failure('This browser will not let the page copy for you — select the link instead.');
      return;
    }

    try {
      await clipboard.writeText(url);
      this.notifications.success('Overlay link copied.');
    } catch {
      this.notifications.failure('Could not copy the overlay link.');
    }
  }

  private async load(): Promise<void> {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    this.loading.set(true);
    try {
      this.entries.set(entriesFrom(await this.wheels.getWheel(channelId)));
    } catch {
      this.notifications.failure('Could not load your wheel.');
    } finally {
      this.loading.set(false);
    }
  }

  private persist(): Promise<void> {
    const channelId: string | null = this.channelId();
    if (channelId === null) return Promise.resolve();

    const entries: string[] = flattenEntries(this.entries());

    this.writing = this.writing
      .then((): Promise<unknown> => this.wheels.saveWheel(channelId, entries))
      .then((): void => undefined)
      .catch((): void => this.notifications.failure('Could not save your wheel.'));

    return this.writing;
  }
}