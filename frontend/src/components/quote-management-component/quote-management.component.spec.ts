import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
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
  exportQuotes = vi.fn(async (): Promise<{ blob: Blob; filename: string }> => ({
    blob: new Blob(['x']),
    filename: 'quotes.xlsx',
  }));
  importQuotes = vi.fn(async (): Promise<Quote[]> => [quote(1), quote(2)]);
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

  function texts(): string[] {
    return rows().map((row) => row.querySelector('.quote-management-text')!.textContent!.trim());
  }

  function ids(): number[] {
    return rows().map((row) => Number(row.querySelector('.quote-management-id')!.textContent!.trim()));
  }

  function search(term: string): void {
    const input = element.querySelector<HTMLInputElement>('.quote-management-search input')!;

    input.value = term;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function sortBy(header: string): void {
    const match = [...element.querySelectorAll<HTMLElement>('th.mat-sort-header')]
      .find((cell) => cell.textContent!.trim() === header);

    if (!match) throw new Error(`No sortable column headed "${header}".`);

    match.querySelector<HTMLElement>('.mat-sort-header-container')!.click();
    fixture.detectChanges();
  }

  function positionButton(id: number): HTMLButtonElement {
    const match = [...element.querySelectorAll<HTMLButtonElement>('.quote-management-position-button')]
      .find((button) => button.textContent!.trim() === `${id}`);

    if (!match) throw new Error(`No position cell for quote ${id}.`);
    return match;
  }

  function positionInput(): HTMLInputElement {
    return element.querySelector<HTMLInputElement>('.quote-management-position')!;
  }

  // Opens a quote's number cell, types a position and commits it with Enter.
  async function typePosition(id: number, value: string): Promise<void> {
    positionButton(id).click();
    fixture.detectChanges();

    const input = positionInput();
    input.value = value;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    await settle();
  }

  function picker(): HTMLInputElement {
    return element.querySelector<HTMLInputElement>('.quote-management-picker')!;
  }

  async function pickFile(file: File): Promise<void> {
    const input = picker();

    // files is read-only, so the only way to simulate a pick is to redefine it on the element.
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));

    await settle();
  }

  // Closes the confirmation through its dialog ref rather than by clicking. The button can be
  // disabled behind a timeout, and that behaviour belongs to the dialog's own spec — here only the
  // component's reaction to the answer matters.
  async function answerConfirm(result: boolean): Promise<void> {
    const open = dialog.openDialogs;
    if (open.length === 0) throw new Error('No confirmation dialog is open.');

    open[open.length - 1].close(result);
    await settle();
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

  // A bare mat-dialog-close attribute closes with the empty string rather than undefined, which
  // used to reach the backend as a blank quote and come back as "Could not add the quote."
  it('should treat an empty dialog result as a cancellation, not a blank quote', async () => {
    await render();
    answerDialogWith('');

    addButton().click();
    await settle();

    expect(quotes.addQuote).not.toHaveBeenCalled();
    expect(notifications.failures).toEqual([]);
  });

  it('should not report a failure when an edit is cancelled', async () => {
    await render();
    answerDialogWith('');

    buttonLabelled('Edit quote 2').click();
    await settle();

    expect(quotes.updateQuote).not.toHaveBeenCalled();
    expect(notifications.failures).toEqual([]);
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
    await answerConfirm(true);

    expect(quotes.deleteQuote).toHaveBeenCalledWith(CHANNEL, 3);
    expect(notifications.successes[0]).toContain('Deleted quote 3');
  });

  it('should reload the list after a delete so the renumbering shows', async () => {
    await render();
    expect(quotes.getQuotes).toHaveBeenCalledTimes(1);

    buttonLabelled('Delete quote 1').click();
    await settle();
    await answerConfirm(true);

    expect(quotes.getQuotes).toHaveBeenCalledTimes(2);
  });

  it('should move a quote to the position typed into its number cell', async () => {
    await render();

    await typePosition(2, '3');

    expect(quotes.moveQuote).toHaveBeenCalledWith(CHANNEL, 2, 3);
  });

  // The move response is already the renumbered list, so refetching it would be a wasted request.
  it('should take the reordered list from the move response without reloading', async () => {
    await render();
    expect(quotes.getQuotes).toHaveBeenCalledTimes(1);

    await typePosition(2, '1');

    expect(quotes.getQuotes).toHaveBeenCalledTimes(1);
  });

  it('should not move anything when the typed position is the current one', async () => {
    await render();

    await typePosition(2, '2');

    expect(quotes.moveQuote).not.toHaveBeenCalled();
  });

  it('should clamp a position typed beyond either end of the list', async () => {
    await render();

    await typePosition(2, '99');
    expect(quotes.moveQuote).toHaveBeenCalledWith(CHANNEL, 2, 3);

    quotes.moveQuote.mockClear();
    await typePosition(2, '0');
    expect(quotes.moveQuote).toHaveBeenCalledWith(CHANNEL, 2, 1);
  });

  it('should ignore a position cell left blank or filled with nonsense', async () => {
    await render();

    await typePosition(2, '');
    await typePosition(2, 'abc');

    expect(quotes.moveQuote).not.toHaveBeenCalled();
  });

  it('should abandon the position edit on escape', async () => {
    await render();

    const cell = positionButton(2);
    cell.click();
    fixture.detectChanges();

    const input = positionInput();
    input.value = '1';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();

    expect(quotes.moveQuote).not.toHaveBeenCalled();
    expect(positionInput()).toBeNull();
  });

  // Enter commits and then blurs, and both handlers fire.
  it('should apply a typed position only once', async () => {
    await render();

    const cell = positionButton(2);
    cell.click();
    fixture.detectChanges();

    const input = positionInput();
    input.value = '3';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    await settle();

    expect(quotes.moveQuote).toHaveBeenCalledTimes(1);
  });

  it('should open the edit dialog when a row is clicked', async () => {
    await render();
    answerDialogWith('Rewritten');

    rows()[1].click();
    await settle();

    expect(quotes.updateQuote).toHaveBeenCalledWith(CHANNEL, 2, 'Rewritten');
  });

  // The delete button sits inside the row, so its click must not also open the editor.
  it('should not open the edit dialog when the delete button is pressed', async () => {
    await render();
    const opened = vi.spyOn(dialog, 'open');

    buttonLabelled('Delete quote 2').click();
    await settle();

    expect(opened).toHaveBeenCalledTimes(1);
    await answerConfirm(false);
    expect(quotes.updateQuote).not.toHaveBeenCalled();
  });

  it('should not open the edit dialog when the number is clicked', async () => {
    await render();
    const opened = vi.spyOn(dialog, 'open');

    positionButton(2).click();
    fixture.detectChanges();

    expect(opened).not.toHaveBeenCalled();
    expect(positionInput()).not.toBeNull();
  });

  it('should filter by message text regardless of case', async () => {
    quotes.quotes = [
      { ...quote(1), quote: 'Alpha WISDOM here' },
      { ...quote(2), quote: 'Beta something' },
      { ...quote(3), quote: 'Gamma wisdom again' },
    ];
    await render();

    search('wisdom');

    expect(texts()).toEqual(['Alpha WISDOM here', 'Gamma wisdom again']);
  });

  it('should filter by the quote number as well', async () => {
    await render();

    search('2');

    expect(texts()).toEqual(['Quote 2']);
  });

  it('should say which term matched nothing', async () => {
    await render();

    search('nothing matches this');

    expect(element.querySelector('.quote-management-empty')!.textContent)
      .toContain('nothing matches this');
  });

  it('should sort messages case-insensitively', async () => {
    // A case-sensitive compare would put every capital ahead of every lowercase letter and sort
    // "apple" after "Zebra", which is exactly the bug this guards against.
    quotes.quotes = [
      { ...quote(1), quote: 'Zebra' },
      { ...quote(2), quote: 'apple' },
      { ...quote(3), quote: 'Mango' },
    ];
    await render();

    sortBy('Message');

    expect(texts()).toEqual(['apple', 'Mango', 'Zebra']);
  });

  it('should sort the number column numerically', async () => {
    quotes.quotes = [quote(1), quote(2), quote(3), quote(10)];
    await render();

    sortBy('#');
    sortBy('#');

    // A string sort would put 10 between 1 and 2.
    expect(ids()).toEqual([10, 3, 2, 1]);
  });

  it('should sort dates by their instant, not their rendered text', async () => {
    quotes.quotes = [
      { ...quote(1), quote: 'newest', timestamp: '2026-06-01T00:00:00Z' },
      { ...quote(2), quote: 'oldest', timestamp: '2024-02-01T00:00:00Z' },
      { ...quote(3), quote: 'middle', timestamp: '2025-11-01T00:00:00Z' },
    ];
    await render();

    sortBy('Date');

    expect(texts()).toEqual(['oldest', 'middle', 'newest']);
  });

  // Sorting reorders the rows, so the top row is no longer necessarily quote 1 — the position is
  // read off the quote itself rather than where it happens to sit.
  it('should move the right quote when the table is sorted the other way round', async () => {
    await render();
    sortBy('#');
    sortBy('#');

    expect(ids()).toEqual([3, 2, 1]);

    await typePosition(3, '1');

    expect(quotes.moveQuote).toHaveBeenCalledWith(CHANNEL, 3, 1);
  });

  it('should download the exported workbook under the name the server chose', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    await render();
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this);
    });

    element.querySelector<HTMLButtonElement>('.quote-management-export')!.click();
    await settle();

    expect(quotes.exportQuotes).toHaveBeenCalledWith(CHANNEL);
    expect(clicks[0].download).toBe('quotes.xlsx');
    // The object URL has to be released, otherwise the blob is held for the life of the document.
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');

    vi.unstubAllGlobals();
  });

  it('should not offer an export when there is nothing to export', async () => {
    quotes.quotes = [];
    await render();

    expect(element.querySelector<HTMLButtonElement>('.quote-management-export')!.disabled).toBe(true);
  });

  it('should show the imported list without reloading it', async () => {
    await render();
    expect(quotes.getQuotes).toHaveBeenCalledTimes(1);

    await pickFile(new File(['x'], 'quotes.xlsx'));
    await answerConfirm(true);

    expect(quotes.importQuotes).toHaveBeenCalledWith(CHANNEL, expect.any(File));
    expect(rows()).toHaveLength(2);
    expect(quotes.getQuotes).toHaveBeenCalledTimes(1);
    expect(notifications.successes[0]).toContain('Imported 2 quotes');
  });

  it('should do nothing when the file picker was dismissed', async () => {
    await render();

    picker().dispatchEvent(new Event('change'));
    await settle();

    expect(quotes.importQuotes).not.toHaveBeenCalled();
  });

  // Re-picking the same file only fires a change event if the value was cleared in between.
  it('should clear the picker so the same file can be chosen again', async () => {
    await render();
    await pickFile(new File(['x'], 'quotes.xlsx'));
    await answerConfirm(true);

    expect(picker().value).toBe('');
  });

  // The backend names the offending row, which is far more useful than a generic failure.
  it('should surface the reason the backend rejected an import', async () => {
    await render();
    quotes.importQuotes.mockRejectedValueOnce(
      new HttpErrorResponse({ status: 400, error: 'Row 7: the message is 812 characters, the limit is 500.' }),
    );

    await pickFile(new File(['x'], 'broken.xlsx'));
    await answerConfirm(true);

    expect(notifications.failures[0]).toBe('Row 7: the message is 812 characters, the limit is 500.');
  });

  it('should fall back to a generic message when an import fails without a reason', async () => {
    await render();
    quotes.importQuotes.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));

    await pickFile(new File(['x'], 'broken.xlsx'));
    await answerConfirm(true);

    expect(notifications.failures[0]).toBe('Could not import the file.');
  });

  it('should report a failed action instead of pretending it worked', async () => {
    await render();
    quotes.deleteQuote.mockRejectedValueOnce(new Error('500'));

    buttonLabelled('Delete quote 1').click();
    await settle();
    await answerConfirm(true);

    expect(notifications.successes).toEqual([]);
    expect(notifications.failures[0]).toContain('Could not delete quote 1');
  });
});
