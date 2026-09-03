import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { TableFrameComponent } from '../../components/table-frame-component/table-frame.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { OverlayLinkComponent } from '../../components/overlay-link-component/overlay-link.component';
import { WheelComponent, WheelSpin } from '../../components/wheel-component/wheel.component';
import { ConfirmActionDialogComponent } from '../../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { TextEditDialogComponent } from '../../components/text-edit-dialog-component/text-edit-dialog.component';
import { WheelWinnerChoice, WheelWinnerDialogComponent, } from '../../components/wheel-winner-dialog-component/wheel-winner-dialog.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { WheelService } from '../../services/wheel.service';
import { WheelResultsService } from '../../services/wheel-results.service';
import { addEntry, entriesFrom, entryProblem, entryText, flattenEntries, labelProblem, parseWheelFile, removeOne, renameEntry, shuffleEntries, sliceCount, sortEntries, splitEntries, WHEEL_FILE_NAME, WHEEL_LABEL_MAX_LENGTH, WHEEL_MAX_SLICES, WheelEntry, WheelFile, wheelFileContent, wheelSlices } from '../../data/wheel-entry';
import { resultWonAt, WheelResult } from '../../data/wheel-result';
import { CHANNEL_PARAM, overlayUrl, WHEEL_OVERLAY_PATH } from '../../data/overlay';

type WheelEntryRow = WheelEntry & { readonly ghost?: true };

function ghostRows(count: number | null): WheelEntryRow[] {
  if (count === null || count <= 0) return [];
  return Array.from({ length: Math.min(count, 25) }, (): WheelEntryRow => ({ label: '', count: 1, ghost: true }));
}

@Component({
  selector: 'app-wheel-page',
  templateUrl: './wheel-page.component.html',
  styleUrl: './wheel-page.component.scss',
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSortModule, MatTableModule, MatTabsModule, OverlayLinkComponent, TableFrameComponent, WheelComponent, LocaleDatePipe],
})
export class WheelPageComponent {

  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly document: Document = inject(DOCUMENT);
  private readonly auth: AuthService = inject(AuthService);
  private readonly wheels: WheelService = inject(WheelService);
  private readonly wheelResults: WheelResultsService = inject(WheelResultsService);

  private readonly wheel: Signal<WheelComponent | undefined> = viewChild(WheelComponent);
  private readonly resultsSorter: Signal<MatSort | undefined> = viewChild(MatSort);

  protected readonly entries: WritableSignal<WheelEntry[]> = signal<WheelEntry[]>([]);
  protected readonly draft: WritableSignal<string> = signal('');
  protected readonly loading: WritableSignal<boolean> = signal(false);

  protected readonly results: WritableSignal<WheelResult[]> = signal<WheelResult[]>([]);
  protected readonly resultColumns: string[] = ['winner', 'time'];
  protected readonly resultsDataSource: MatTableDataSource<WheelResult> = new MatTableDataSource<WheelResult>([]);

  private writing: Promise<void> = Promise.resolve();

  protected readonly columns: string[] = ['entry', 'actions'];

  protected readonly slices: Signal<string[]> = computed((): string[] => wheelSlices(this.entries()));

  protected readonly total: Signal<number> = computed((): number => sliceCount(this.entries()));

  protected readonly full: Signal<boolean> = computed((): boolean => this.total() >= WHEEL_MAX_SLICES);

  protected readonly spinning: Signal<boolean> = computed((): boolean => this.wheel()?.spinning() ?? false);

  protected readonly busy: Signal<boolean> = computed((): boolean => this.spinning() || this.loading());

  protected readonly initialLoad: Signal<boolean> = computed((): boolean => this.loading() && this.entries().length === 0);

  protected readonly expected: WritableSignal<number | null> = signal<number | null>(null);

  protected readonly rows: Signal<WheelEntryRow[]> = computed((): WheelEntryRow[] =>
    this.initialLoad() ? ghostRows(this.expected()) : this.entries());

  private readonly channelId: Signal<string | null> = computed((): string | null => this.auth.currentUser()?.id ?? null);

  protected readonly overlayUrl: Signal<string | null> = computed((): string | null => {
    const channelId: string | null = this.channelId();
    return channelId === null ? null : overlayUrl(WHEEL_OVERLAY_PATH, CHANNEL_PARAM, channelId);
  });

  protected readonly label: (entry: WheelEntry) => string = entryText;

  constructor() {
    void this.load();

    this.resultsDataSource.sortingDataAccessor = (result, column): string | number =>
      column === 'time' ? resultWonAt(result).getTime() : result.label.toLowerCase();

    effect((): WheelResult[] => this.resultsDataSource.data = this.results());
    effect((): void => {
      const sorter: MatSort | undefined = this.resultsSorter();
      if (sorter) this.resultsDataSource.sort = sorter;
    });
  }

  protected readonly problem: Signal<string | null> = computed((): string | null => {
    const problem: string | null = entryProblem(this.draft());
    if (problem !== null) return problem;

    return this.full() ? `A wheel holds at most ${WHEEL_MAX_SLICES} slices.` : null;
  });

  protected readonly canAdd: Signal<boolean> = computed((): boolean =>
    !this.busy() && this.draft().trim().length > 0 && this.problem() === null);

  protected add(): void {
    if (!this.canAdd()) return;
    if (this.addAll(splitEntries(this.draft()))) this.draft.set('');
  }

  protected pasted(event: ClipboardEvent): void {
    const text: string | undefined = event.clipboardData?.getData('text');
    if (!text) return;

    const labels: string[] = splitEntries(text);
    if (labels.length < 2) return;

    event.preventDefault();

    const problem: string | null = entryProblem(text);

    if (problem !== null) {
      this.notifications.failure(problem);
      return;
    }

    if (this.addAll(labels)) this.draft.set('');
  }

  private addAll(labels: readonly string[]): boolean {
    if (labels.length === 0) return false;

    let added = 0;
    let next: WheelEntry[] = this.entries();

    for (const label of labels) {
      if (sliceCount(next) >= WHEEL_MAX_SLICES) break;

      next = addEntry(next, label);
      added++;
    }

    if (added === 0) {
      this.notifications.failure(`A wheel holds at most ${WHEEL_MAX_SLICES} slices.`);
      return false;
    }

    this.entries.set(next);
    void this.persist();

    if (added < labels.length) {
      this.notifications.failure(
        `Added ${added} of ${labels.length} — a wheel holds at most ${WHEEL_MAX_SLICES} slices.`);
    }

    return true;
  }

  protected addOne(label: string): void {
    if (this.full()) {
      this.notifications.failure(`A wheel holds at most ${WHEEL_MAX_SLICES} slices.`);
      return;
    }

    this.entries.update((entries: WheelEntry[]): WheelEntry[] => addEntry(entries, label));
    void this.persist();
  }

  protected async rename(entry: WheelEntryRow, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (entry.ghost || this.busy()) return;

    const label: string | undefined = await TextEditDialogComponent.ask(this.dialog, {
      title: 'Edit entry',
      label: 'Entry',
      text: entry.label,
      maxLength: WHEEL_LABEL_MAX_LENGTH,
      multiline: false,
      hint: 'Renaming onto a name already listed merges the two.',
      problem: labelProblem,
    });

    if (label === undefined) return;

    this.entries.update((entries: WheelEntry[]): WheelEntry[] => renameEntry(entries, entry.label, label));
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
    const channelId: string | null = this.channelId();

    if (channelId !== null) this.results.set(this.wheelResults.record(channelId, spin.label));

    const choice: WheelWinnerChoice = await WheelWinnerDialogComponent.announce(this.dialog, spin.label);

    if (channelId !== null) void this.wheels.dismiss(channelId).catch((): void => undefined);

    if (choice === 'remove') this.removeOne(spin.label);
  }

  protected async resetResults(): Promise<void> {
    const confirmed: boolean = await ConfirmActionDialogComponent.confirm(this.dialog, {
      title: 'Clear the results?',
      message: `All ${this.results().length} recorded results will be removed.`,
      confirmLabel: 'Clear',
    });

    if (!confirmed) return;

    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    this.results.set(this.wheelResults.clear(channelId));
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

  private async load(): Promise<void> {
    const channelId: string | null = this.channelId();
    if (channelId === null) return;

    this.results.set(this.wheelResults.list(channelId));

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