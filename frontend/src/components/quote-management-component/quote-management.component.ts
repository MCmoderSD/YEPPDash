import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { TextEditDialogComponent } from '../text-edit-dialog-component/text-edit-dialog.component';
import { ConfirmActionDialogComponent } from '../confirm-action-dialog-component/confirm-action-dialog.component';
import { AuthService } from '../../services/auth.service';
import { QuoteService } from '../../services/quote.service';
import { NotificationService } from '../../services/notification.service';
import { Quote, QUOTE_MAX_LENGTH } from '../../data/quote';

function reasonFor(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;
  return typeof error.error === 'string' && error.error.trim() ? error.error.trim() : null;
}

type QuoteRow = Quote & { readonly ghost?: true };

function ghostRows(count: number | null): QuoteRow[] {
  if (count === null || count <= 0) return [];

  return Array.from({ length: Math.min(count, 25) }, (_: unknown, index: number): QuoteRow =>
    ({ id: -(index + 1), quote: '', timestamp: '', ghost: true }));
}

@Component({
  selector: 'app-quote-management',
  templateUrl: './quote-management.component.html',
  styleUrl: './quote-management.component.scss',
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MatSortModule, MatTableModule, ScrollBarComponent, LocaleDatePipe],
})
export class QuoteManagementComponent {

  private readonly quotes: QuoteService = inject(QuoteService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly document: Document = inject(DOCUMENT);

  private readonly entries: WritableSignal<Quote[]> = signal<Quote[]>([]);
  private readonly isLoading: WritableSignal<boolean> = signal(false);
  private readonly isBusy: WritableSignal<boolean> = signal(false);
  private readonly failed: WritableSignal<boolean> = signal(false);

  protected readonly quoteList: Signal<Quote[]> = this.entries.asReadonly();
  protected readonly loading: Signal<boolean> = this.isLoading.asReadonly();

  protected readonly expected: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly busy: Signal<boolean> = this.isBusy.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.failed.asReadonly();

  protected readonly columns: string[] = ['id', 'quote', 'timestamp', 'actions'];

  protected readonly count: Signal<number> = computed((): number => this.quoteList().length);

  protected readonly dataSource: MatTableDataSource<QuoteRow> = new MatTableDataSource<QuoteRow>([]);

  protected readonly trackQuote = (_: number, quote: QuoteRow): number => quote.id;

  protected readonly query: WritableSignal<string> = signal('');

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  constructor() {
    this.dataSource.filterPredicate = (quote: Quote, filter: string): boolean => {
      return quote.quote.toLowerCase().includes(filter) || `${quote.id}`.includes(filter);
    };

    this.dataSource.sortingDataAccessor = (quote: Quote, column: string): string | number => {
      switch (column) {
        case 'timestamp': return Date.parse(quote.timestamp);
        case 'quote': return quote.quote.toLowerCase();
        default: return quote.id;
      }
    };

    effect((): QuoteRow[] => this.dataSource.data = this.loading() ? ghostRows(this.expected()) : this.quoteList());
    effect((): void => {
      const sorter: MatSort | undefined = this.sorter();
      if (sorter) this.dataSource.sort = sorter;
    });

    void this.load();
  }

  protected filter(value: string): void {
    this.query.set(value.trim());
    this.dataSource.filter = value.trim().toLowerCase();
  }

  protected async add(): Promise<void> {
    const text: string | undefined = await this.ask(null);
    if (!text) return;

    await this.run(
      async (channelId: string): Promise<void> => {
        const added: Quote = await this.quotes.addQuote(channelId, text);
        this.notifications.success(`Added quote ${added.id}.`);
      },
      'Could not add the quote.',
    );
  }

  protected async edit(quote: QuoteRow): Promise<void> {
    if (quote.ghost) return;

    const text: string | undefined = await this.ask(quote);
    if (!text) return;

    await this.run(
      async (channelId: string): Promise<void> => {
        await this.quotes.updateQuote(channelId, quote.id, text);
        this.notifications.success(`Updated quote ${quote.id}.`);
      },
      `Could not update quote ${quote.id}.`,
    );
  }

  protected async remove(quote: Quote): Promise<void> {
    const confirmed: boolean = await ConfirmActionDialogComponent.confirm(this.dialog, {
      title: `Delete quote ${quote.id}?`,
      message: `“${quote.quote}” will be deleted, and the quotes after it move up a number. This cannot be undone.`,
      confirmLabel: 'Delete',
    });

    if (!confirmed) return;

    await this.run(
      async (channelId: string): Promise<void> => {
        await this.quotes.deleteQuote(channelId, quote.id);
        this.notifications.success(`Deleted quote ${quote.id}.`);
      },
      `Could not delete quote ${quote.id}.`,
    );
  }

  protected async move(quote: Quote, offset: number): Promise<void> {
    const position: number = quote.id + offset;

    await this.run(
      async (channelId: string): Promise<void> => {
        this.entries.set(await this.quotes.moveQuote(channelId, quote.id, position));
      },
      `Could not move quote ${quote.id}.`,
      { reload: false },
    );
  }

  protected async export(): Promise<void> {
    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    this.isBusy.set(true);
    try {
      const { blob, filename } = await this.quotes.exportQuotes(channelId);
      this.download(blob, filename);
      this.notifications.success(`Exported ${this.count()} quote${this.count() === 1 ? '' : 's'}.`);
    } catch {
      this.notifications.failure('Could not export your quotes.');
    } finally {
      this.isBusy.set(false);
    }
  }

  protected async import(input: HTMLInputElement): Promise<void> {
    const file: File | undefined = input.files?.[0];

    input.value = '';
    if (!file) return;

    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    const confirmed: boolean = await ConfirmActionDialogComponent.confirm(this.dialog, {
      title: 'Replace all quotes?',
      message: this.count() === 0
        ? `The quotes in “${file.name}” will be imported.`
        : `All ${this.count()} quotes in your channel will be deleted and replaced by the contents of “${file.name}”. This cannot be undone — export them first if you want a copy.`,
      confirmLabel: 'Replace',
      timeoutMs: this.count() === 0 ? 0 : 3000,
    });

    if (!confirmed) return;

    this.isBusy.set(true);
    try {
      const imported: Quote[] = await this.quotes.importQuotes(channelId, file);
      this.entries.set(imported);
      this.notifications.success(`Imported ${imported.length} quote${imported.length === 1 ? '' : 's'}.`);
    } catch (error: unknown) {
      this.notifications.failure(reasonFor(error) ?? 'Could not import the file.');
    } finally {
      this.isBusy.set(false);
    }
  }

  private download(blob: Blob, filename: string): void {
    const url: string = URL.createObjectURL(blob);
    const link: HTMLAnchorElement = this.document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  private async ask(quote: Quote | null): Promise<string | undefined> {
    return TextEditDialogComponent.ask(this.dialog, {
      title: quote === null ? 'Add quote' : `Edit quote ${quote.id}`,
      label: 'Quote',
      text: quote?.quote,
      maxLength: QUOTE_MAX_LENGTH,
      confirmLabel: quote === null ? 'Add quote' : 'Save',
    });
  }

  private async run(action: (channelId: string) => Promise<void>, failure: string, options: { reload: boolean } = { reload: true }): Promise<void> {
    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    this.isBusy.set(true);
    try {
      await action(channelId);
      if (options.reload) this.entries.set(await this.quotes.getQuotes(channelId));
    } catch {
      this.notifications.failure(failure);
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
      this.entries.set(await this.quotes.getQuotes(channelId));
    } catch {
      this.entries.set([]);
      this.failed.set(true);
      this.notifications.failure('Could not load your quotes.');
    } finally {
      this.isLoading.set(false);
    }
  }
}