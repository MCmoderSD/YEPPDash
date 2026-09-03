import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, input, InputSignal, Signal, signal, untracked, viewChild, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
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
import { WheelGridComponent } from '../../components/wheel-grid-component/wheel-grid.component';
import { ConfirmActionDialogComponent } from '../../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { TextEditDialogComponent } from '../../components/text-edit-dialog-component/text-edit-dialog.component';
import { WheelWinnerChoice, WheelWinnerDialogComponent, } from '../../components/wheel-winner-dialog-component/wheel-winner-dialog.component';
import { NotificationService } from '../../services/notification.service';
import { errorMessage } from '../../services/http-error';
import { WheelService } from '../../services/wheel.service';
import { WheelResultsService } from '../../services/wheel-results.service';
import { addEntry, entriesFrom, entryProblem, entryText, flattenEntries, parseWheelFile, removeOne, renameEntry, shuffleEntries, sliceCount, sortEntries, splitEntries, WheelEntry, wheelFileContent, wheelFileName, wheelSlices } from '../../data/wheel-entry';
import { resultWonAt, WheelResult } from '../../data/wheel-result';
import { Wheel, WHEEL_NAME_MAX_LENGTH, WheelSummary, WheelUpdate } from '../../data/wheel';
import { overlayUrl, WHEEL_OVERLAY_PATH, WHEEL_PARAM } from '../../data/overlay';

type WheelEntryRow = WheelEntry & { readonly ghost?: true };

function ghostRows(count: number | null): WheelEntryRow[] {
  if (count === null || count <= 0) return [];
  return Array.from({ length: Math.min(count, 25) }, (): WheelEntryRow => ({ label: '', count: 1, ghost: true }));
}

@Component({
  selector: 'app-wheel-page',
  templateUrl: './wheel-page.component.html',
  styleUrl: './wheel-page.component.scss',
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSortModule, MatTableModule, MatTabsModule, OverlayLinkComponent, TableFrameComponent, WheelComponent, WheelGridComponent, LocaleDatePipe],
})
export class WheelPageComponent {

  readonly wheel: InputSignal<string | undefined> = input<string>();

  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly document: Document = inject(DOCUMENT);
  private readonly router: Router = inject(Router);
  private readonly wheels: WheelService = inject(WheelService);
  private readonly wheelResults: WheelResultsService = inject(WheelResultsService);

  private readonly board: Signal<WheelComponent | undefined> = viewChild(WheelComponent);
  private readonly resultsSorter: Signal<MatSort | undefined> = viewChild(MatSort);

  protected readonly summaries: WritableSignal<WheelSummary[]> = signal<WheelSummary[]>([]);

  private readonly loaded: WritableSignal<boolean> = signal(false);

  protected readonly skeleton: Signal<boolean> = computed((): boolean => !this.loaded());

  protected readonly expected: WritableSignal<number | null> = signal<number | null>(null);

  protected readonly name: WritableSignal<string> = signal('');
  protected readonly entries: WritableSignal<WheelEntry[]> = signal<WheelEntry[]>([]);
  protected readonly draft: WritableSignal<string> = signal('');

  protected readonly detailLoading: WritableSignal<boolean> = signal(false);
  protected readonly saving: WritableSignal<boolean> = signal(false);

  protected readonly results: WritableSignal<WheelResult[]> = signal<WheelResult[]>([]);
  protected readonly resultColumns: string[] = ['winner', 'time'];
  protected readonly resultsDataSource: MatTableDataSource<WheelResult> = new MatTableDataSource<WheelResult>([]);

  private writing: Promise<void> = Promise.resolve();

  protected readonly columns: string[] = ['entry', 'actions'];

  protected readonly selectedId: Signal<string | null> = computed((): string | null => {
    const raw: string | undefined = this.wheel();
    return raw === undefined || raw.length === 0 ? null : raw;
  });

  protected readonly detail: Signal<boolean> = computed((): boolean => this.selectedId() !== null);

  protected readonly slices: Signal<string[]> = computed((): string[] => wheelSlices(this.entries()));

  protected readonly total: Signal<number> = computed((): number => sliceCount(this.entries()));

  protected readonly spinning: Signal<boolean> = computed((): boolean => this.board()?.spinning() ?? false);

  protected readonly busy: Signal<boolean> = computed((): boolean =>
    this.spinning() || this.saving() || this.detailLoading());

  // The card the page was opened from already counted this wheel's entries, so the table can stand
  // the right number of placeholders up while the entries themselves are still on their way.
  private readonly expectedEntries: Signal<number | null> = computed((): number | null => {
    const id: string | null = this.selectedId();
    if (id === null) return null;

    return this.summaries().find((summary: WheelSummary): boolean => summary.id === id)?.entryCount ?? null;
  });

  protected readonly rows: Signal<WheelEntryRow[]> = computed((): WheelEntryRow[] =>
    this.detailLoading() ? ghostRows(this.expectedEntries()) : this.entries());

  protected readonly overlayUrl: Signal<string | null> = computed((): string | null => {
    const id: string | null = this.selectedId();
    return id === null ? null : overlayUrl(WHEEL_OVERLAY_PATH, WHEEL_PARAM, id);
  });

  protected readonly label: (entry: WheelEntry) => string = entryText;

  constructor() {
    void this.loadCount();
    void this.loadList();

    effect((): void => {
      const id: string | null = this.selectedId();
      untracked((): void => void this.loadWheel(id));
    });

    this.resultsDataSource.sortingDataAccessor = (result, column): string | number =>
      column === 'time' ? resultWonAt(result).getTime() : result.label.toLowerCase();

    effect((): WheelResult[] => this.resultsDataSource.data = this.results());
    effect((): void => {
      const sorter: MatSort | undefined = this.resultsSorter();
      if (sorter) this.resultsDataSource.sort = sorter;
    });
  }

  protected readonly problem: Signal<string | null> = computed((): string | null => entryProblem(this.draft()));

  protected readonly canAdd: Signal<boolean> = computed((): boolean =>
    !this.busy() && this.draft().trim().length > 0 && this.problem() === null);

  protected select(id: string | null): void {
    if (id === (this.wheel() ?? null)) return;

    void this.router.navigate([], {
      queryParams: { wheel: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected back(): void {
    this.select(null);
  }

  protected async createWheel(): Promise<void> {
    const name: string | undefined = await TextEditDialogComponent.ask(this.dialog, {
      title: 'New wheel',
      label: 'Name',
      maxLength: WHEEL_NAME_MAX_LENGTH,
      multiline: false,
      confirmLabel: 'Create',
      hint: 'Every wheel keeps its own entries, its own results and its own browser source.',
    });

    if (name === undefined) return;

    this.saving.set(true);
    try {
      const created: Wheel = await this.wheels.create({ name, entries: [] });

      await this.loadList();
      this.select(created.id);

      this.notifications.success(`“${created.name}” is ready — add your entries.`);
    } catch (error: unknown) {
      this.notifications.failure(errorMessage(error, 'Could not create the wheel.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async renameWheel(): Promise<void> {
    if (this.busy()) return;

    const name: string | undefined = await TextEditDialogComponent.ask(this.dialog, {
      title: 'Rename wheel',
      label: 'Name',
      text: this.name(),
      maxLength: WHEEL_NAME_MAX_LENGTH,
      multiline: false,
    });

    if (name === undefined) return;

    this.name.set(name);
    await this.persist();
  }

  protected async removeWheel(): Promise<void> {
    const id: string | null = this.selectedId();
    if (id === null) return;

    const confirmed: boolean = await ConfirmActionDialogComponent.confirm(this.dialog, {
      title: 'Delete this wheel?',
      message: `“${this.name()}”, its ${this.entries().length} entries and its recorded results are removed, `
        + 'and its browser source stops working.',
      confirmLabel: 'Delete',
    });

    if (!confirmed) return;

    this.saving.set(true);
    try {
      await this.wheels.remove(id);
      this.wheelResults.clear(id);

      await this.loadList();
      this.select(null);

      this.notifications.success('The wheel is gone.');
    } catch (error: unknown) {
      this.notifications.failure(errorMessage(error, 'Could not delete the wheel.'));
    } finally {
      this.saving.set(false);
    }
  }

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

    this.entries.update((entries: WheelEntry[]): WheelEntry[] =>
      labels.reduce((list: WheelEntry[], label: string): WheelEntry[] => addEntry(list, label), entries));

    void this.persist();

    return true;
  }

  protected addOne(label: string): void {
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
      multiline: false,
      hint: 'Renaming onto a name already listed merges the two.',
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
    const id: string | null = this.selectedId();
    if (count < 2 || this.spinning() || id === null) return;

    const index: number = Math.floor(Math.random() * count);

    this.board()?.spin(index);
    void this.wheels.spin(id, index).catch((): void => undefined);
  }

  protected async landed(spin: WheelSpin): Promise<void> {
    const id: string | null = this.selectedId();

    if (id !== null) this.results.set(this.wheelResults.record(id, spin.label));

    const choice: WheelWinnerChoice = await WheelWinnerDialogComponent.announce(this.dialog, spin.label);

    if (id !== null) void this.wheels.dismiss(id).catch((): void => undefined);

    if (choice === 'remove') this.removeOne(spin.label);
  }

  protected async resetResults(): Promise<void> {
    const id: string | null = this.selectedId();
    if (id === null) return;

    const confirmed: boolean = await ConfirmActionDialogComponent.confirm(this.dialog, {
      title: 'Clear the results?',
      message: `All ${this.results().length} recorded results will be removed.`,
      confirmLabel: 'Clear',
    });

    if (!confirmed) return;

    this.results.set(this.wheelResults.clear(id));
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
    link.download = wheelFileName(this.name());
    link.click();

    view.URL.revokeObjectURL(url);
  }

  protected async import(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file: File | undefined = input.files?.[0];

    input.value = '';
    if (!file) return;

    const parsed: string[] = parseWheelFile(await file.text());

    if (parsed.length === 0) {
      this.notifications.failure('That file holds no entries.');
      return;
    }

    if (this.entries().length > 0) {
      const confirmed: boolean = await ConfirmActionDialogComponent.confirm(this.dialog, {
        title: `Replace the wheel with ${file.name}?`,
        message: `The ${this.entries().length} entries on the wheel will be replaced by the `
          + `${parsed.length} in the file.`,
        confirmLabel: 'Replace',
      });

      if (!confirmed) return;
    }

    this.entries.set(entriesFrom(parsed));

    await this.persist();
    this.notifications.success(`Imported ${parsed.length} entries.`);
  }

  private async loadCount(): Promise<void> {
    try {
      this.expected.set(await this.wheels.count());
    } catch {
      this.expected.set(null);
    }
  }

  private async loadList(): Promise<void> {
    try {
      const summaries: WheelSummary[] = await this.wheels.list();

      this.summaries.set(summaries);
      this.expected.set(summaries.length);
    } catch (error: unknown) {
      this.notifications.failure(errorMessage(error, 'Could not load your wheels.'));
    } finally {
      this.loaded.set(true);
    }
  }

  private async loadWheel(id: string | null): Promise<void> {
    if (id === null) {
      this.reset();
      return;
    }

    this.reset();
    this.detailLoading.set(true);

    try {
      const wheel: Wheel = await this.wheels.getWheel(id);

      this.name.set(wheel.name);
      this.entries.set([...wheel.entries]);
      this.results.set(this.wheelResults.list(id));
      this.draft.set('');
    } catch (error: unknown) {
      this.notifications.failure(errorMessage(error, 'Could not load that wheel.'));
      this.select(null);
    } finally {
      this.detailLoading.set(false);
    }
  }

  private reset(): void {
    this.name.set('');
    this.entries.set([]);
    this.draft.set('');
    this.results.set([]);
  }

  private persist(): Promise<void> {
    const id: string | null = this.selectedId();
    if (id === null) return Promise.resolve();

    const update: WheelUpdate = { name: this.name(), entries: this.entries() };

    this.writing = this.writing
      .then((): Promise<Wheel> => this.wheels.save(id, update))
      .then((saved: Wheel): void => this.stamp(saved))
      .catch((): void => this.notifications.failure('Could not save your wheel.'));

    return this.writing;
  }

  private stamp(saved: Wheel): void {
    this.summaries.update((current: WheelSummary[]): WheelSummary[] =>
      current.map((summary: WheelSummary): WheelSummary => summary.id === saved.id
        ? {
          ...summary,
          name: saved.name,
          entryCount: saved.entries.length,
          sliceCount: sliceCount(saved.entries),
          updatedAt: saved.updatedAt,
        }
        : summary));
  }
}