import { Component, computed, inject, Signal, signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { QuoteEditDialogComponent } from '../quote-edit-dialog-component/quote-edit-dialog.component';
import { AuthService } from '../../services/auth.service';
import { QuoteService } from '../../services/quote.service';
import { NotificationService } from '../../services/notification.service';
import { Quote } from '../../data/quote';

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

  constructor() {
    void this.load();
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
