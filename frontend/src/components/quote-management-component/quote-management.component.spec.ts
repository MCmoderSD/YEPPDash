import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DashModule } from '../../pages/dash.module';
import { QuoteManagementComponent } from './quote-management.component';
import { QuoteService } from '../../services/quote.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Quote } from '../../data/quote';

const CHANNEL = '644984959';

function quote(id: number): Quote {
  return { id, quote: `Quote ${id}`, timestamp: '2026-01-01T00:00:00Z' };
}

class FakeQuoteService {
  quotes: Quote[] = [quote(1), quote(2), quote(3)];

  getQuotes = vi.fn(async (): Promise<Quote[]> => this.quotes);
  addQuote = vi.fn(async (_channel: string, text: string): Promise<Quote> => ({ ...quote(4), quote: text }));
  updateQuote = vi.fn(async (_channel: string, id: number, text: string): Promise<Quote> => ({ ...quote(id), quote: text }));
  deleteQuote = vi.fn(async (): Promise<void> => undefined);
  moveQuote = vi.fn(async (): Promise<Quote[]> => [quote(1), quote(2), quote(3)]);
}

class FakeAuthService {
  currentUser = () => ({ id: CHANNEL });
}

class FakeNotificationService {
  readonly successes: string[] = [];
  readonly failures: string[] = [];

  success(message: string): void { this.successes.push(message); }
  failure(message: string): void { this.failures.push(message); }
}

describe('QuoteManagementComponent', () => {
  let fixture: ComponentFixture<QuoteManagementComponent>;
  let element: HTMLElement;
  let quotes: FakeQuoteService;
  let notifications: FakeNotificationService;
  let dialog: MatDialog;

  async function settle(): Promise<void> {
    // The component loads through promises the fixture does not track.
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  // The component loads in its constructor, so it is built here rather than in beforeEach — that
  // gives each test a chance to arrange the fakes before the first read happens.
  async function render(): Promise<void> {
    fixture = TestBed.createComponent(QuoteManagementComponent);
    element = fixture.nativeElement as HTMLElement;

    fixture.detectChanges();
    await settle();
  }

  function rows(): HTMLElement[] {
    return [...element.querySelectorAll<HTMLElement>('tr.mat-mdc-row:not(.mat-mdc-no-data-row)')];
  }

  function addButton(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('.quote-management-add')!;
  }

  function buttonLabelled(label: string): HTMLButtonElement {
    const match = [...element.querySelectorAll('button')]
      .find((button) => button.getAttribute('aria-label') === label);

    if (!match) throw new Error(`No button labelled "${label}".`);
    return match as HTMLButtonElement;
  }

  function answerDialogWith(value: string | undefined): void {
    vi.spyOn(dialog, 'open').mockReturnValue({ afterClosed: () => of(value) } as never);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Through DashModule rather than re-declaring: that is the module it really ships in, so the
      // test fails if its imports ever stop covering the template.
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [
        { provide: QuoteService, useClass: FakeQuoteService },
        { provide: AuthService, useClass: FakeAuthService },
        { provide: NotificationService, useClass: FakeNotificationService },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    quotes = TestBed.inject(QuoteService) as unknown as FakeQuoteService;
    notifications = TestBed.inject(NotificationService) as unknown as FakeNotificationService;
    dialog = TestBed.inject(MatDialog);
  });

  it('should list the quotes of the signed-in channel', async () => {
    await render();

    expect(quotes.getQuotes).toHaveBeenCalledWith(CHANNEL);
    expect(rows()).toHaveLength(3);
    expect(element.querySelector('.quote-management-count')!.textContent).toContain('3 quotes');
  });

  it('should show the id, message and date of a quote', async () => {
    await render();

    const [first] = rows();
    expect(first.querySelector('.quote-management-id')!.textContent!.trim()).toBe('1');
    expect(first.querySelector('.quote-management-text')!.textContent).toContain('Quote 1');
    expect(first.querySelector('time')!.getAttribute('datetime')).toBe('2026-01-01T00:00:00Z');
  });

  it('should say so when the channel has no quotes yet', async () => {
    quotes.quotes = [];
    await render();

    expect(element.querySelector('.quote-management-empty')!.textContent).toContain('No quotes yet');
  });

  it('should report an unreachable backend instead of an empty channel', async () => {
    quotes.getQuotes.mockRejectedValueOnce(new Error('502'));
    await render();

    expect(element.querySelector('.quote-management-empty')!.textContent).toContain('Could not load');
    expect(notifications.failures[0]).toContain('Could not load your quotes');
  });

  it('should add the quote the dialog returned', async () => {
    await render();
    answerDialogWith('A new quote');

    addButton().click();
    await settle();

    expect(quotes.addQuote).toHaveBeenCalledWith(CHANNEL, 'A new quote');
    expect(notifications.successes[0]).toContain('Added quote');
  });

  it('should not add anything when the dialog was cancelled', async () => {
    await render();
    answerDialogWith(undefined);

    addButton().click();
    await settle();

    expect(quotes.addQuote).not.toHaveBeenCalled();
  });

  it('should update the quote whose edit button was pressed', async () => {
    await render();
    answerDialogWith('Rewritten');

    buttonLabelled('Edit quote 2').click();
    await settle();

    expect(quotes.updateQuote).toHaveBeenCalledWith(CHANNEL, 2, 'Rewritten');
    expect(notifications.successes[0]).toContain('Updated quote 2');
  });

  it('should delete the quote whose delete button was pressed', async () => {
    await render();

    buttonLabelled('Delete quote 3').click();
    await settle();

    expect(quotes.deleteQuote).toHaveBeenCalledWith(CHANNEL, 3);
    expect(notifications.successes[0]).toContain('Deleted quote 3');
  });

  it('should reload the list after a delete so the renumbering shows', async () => {
    await render();
    expect(quotes.getQuotes).toHaveBeenCalledTimes(1);

    buttonLabelled('Delete quote 1').click();
    await settle();

    expect(quotes.getQuotes).toHaveBeenCalledTimes(2);
  });

  it('should move a quote up by asking for the position above it', async () => {
    await render();

    buttonLabelled('Move quote 2 up').click();
    await settle();

    expect(quotes.moveQuote).toHaveBeenCalledWith(CHANNEL, 2, 1);
  });

  it('should move a quote down by asking for the position below it', async () => {
    await render();

    buttonLabelled('Move quote 2 down').click();
    await settle();

    expect(quotes.moveQuote).toHaveBeenCalledWith(CHANNEL, 2, 3);
  });

  // The move response is already the renumbered list, so refetching it would be a wasted request.
  it('should take the reordered list from the move response without reloading', async () => {
    await render();
    expect(quotes.getQuotes).toHaveBeenCalledTimes(1);

    buttonLabelled('Move quote 2 up').click();
    await settle();

    expect(quotes.getQuotes).toHaveBeenCalledTimes(1);
  });

  it('should not offer to move the first quote up or the last one down', async () => {
    await render();

    expect(buttonLabelled('Move quote 1 up').disabled).toBe(true);
    expect(buttonLabelled('Move quote 3 down').disabled).toBe(true);
    expect(buttonLabelled('Move quote 1 down').disabled).toBe(false);
  });

  it('should report a failed action instead of pretending it worked', async () => {
    await render();
    quotes.deleteQuote.mockRejectedValueOnce(new Error('500'));

    buttonLabelled('Delete quote 1').click();
    await settle();

    expect(notifications.successes).toEqual([]);
    expect(notifications.failures[0]).toContain('Could not delete quote 1');
  });
});
