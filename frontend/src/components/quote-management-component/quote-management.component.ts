import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { firstValueFrom } from 'rxjs';
import { QuoteEditDialogComponent } from '../quote-edit-dialog-component/quote-edit-dialog.component';
import { AuthService } from '../../services/auth.service';
import { QuoteService } from '../../services/quote.service';
import { NotificationService } from '../../services/notification.service';
import { Quote } from '../../data/quote';

// A rejected import answers with the reason as plain text. It arrives as a Blob because the
// request asked for JSON and the body is not, so it has to be unwrapped before it can be shown.
function reasonFor(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) return null;

  return typeof error.error === 'string' && error.error.trim() ? error.error.trim() : null;
}

@Component({
  selector: 'app-quote-management',
  templateUrl: './quote-management.component.html',
  styleUrl: './quote-management.component.scss',
  standalone: false,
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
  protected readonly busy: Signal<boolean> = this.isBusy.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.failed.asReadonly();

  protected readonly columns: string[] = ['id', 'quote', 'timestamp', 'actions'];

  protected readonly count: Signal<number> = computed((): number => this.quoteList().length);

  protected readonly dataSource: MatTableDataSource<Quote> = new MatTableDataSource<Quote>([]);

  protected readonly query: WritableSignal<string> = signal('');

  private readonly sorter: Signal<MatSort | undefined> = viewChild(MatSort);

  constructor() {
    // Both the text and the id are searched, so "wisdom" and "12" both find something. The filter
    // string arrives already lowercased, which is what makes the comparison case-insensitive.
    this.dataSource.filterPredicate = (quote, filter): boolean => {
      return quote.quote.toLowerCase().includes(filter) || `${quote.id}`.includes(filter);
    };

    this.dataSource.sortingDataAccessor = (quote, column): string | number => {
      switch (column) {
        // Sorted on the parsed instant rather than the rendered date, so the order does not follow
        // whatever format the column happens to display.
        case 'timestamp': return Date.parse(quote.timestamp);
        case 'quote': return quote.quote.toLowerCase();
        default: return quote.id;
      }
    };

    effect((): Quote[] => this.dataSource.data = this.quoteList());
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
    if (text === undefined) return;

    await this.run(
      async (channelId: string): Promise<void> => {
        const added: Quote = await this.quotes.addQuote(channelId, text);
        this.notifications.success(`Added quote ${added.id}.`);
      },
      'Could not add the quote.',
    );
  }

  protected async edit(quote: Quote): Promise<void> {
    const text: string | undefined = await this.ask(quote);
    if (text === undefined) return;

    await this.run(
      async (channelId: string): Promise<void> => {
        await this.quotes.updateQuote(channelId, quote.id, text);
        this.notifications.success(`Updated quote ${quote.id}.`);
      },
      `Could not update quote ${quote.id}.`,
    );
  }

  protected async remove(quote: Quote): Promise<void> {
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
        // The server answers with the renumbered list, so this is the one action that does not
        // need a reload afterwards.
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

    // Cleared straight away so picking the same file twice in a row still fires a change event.
    input.value = '';
    if (!file) return;

    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    this.isBusy.set(true);
    try {
      const imported: Quote[] = await this.quotes.importQuotes(channelId, file);
      this.entries.set(imported);
      this.notifications.success(`Imported ${imported.length} quote${imported.length === 1 ? '' : 's'}.`);
    } catch (error: unknown) {
      // The backend explains exactly which row it choked on, so that beats a generic message.
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
    return firstValueFrom(QuoteEditDialogComponent.open(this.dialog, quote).afterClosed());
  }

  private async run(
    action: (channelId: string) => Promise<void>,
    failure: string,
    options: { reload: boolean } = { reload: true },
  ): Promise<void> {
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
