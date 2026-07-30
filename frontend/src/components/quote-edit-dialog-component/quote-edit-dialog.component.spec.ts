import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { DashModule } from '../../pages/dash.module';
import { QuoteEditDialogComponent } from './quote-edit-dialog.component';
import { Quote } from '../../data/quote';

const EXISTING: Quote = { id: 2, quote: 'The original text', timestamp: '2026-01-01T00:00:00Z' };

describe('QuoteEditDialogComponent', () => {
  let dialog: MatDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    }).compileComponents();

    dialog = TestBed.inject(MatDialog);
  });

  afterEach(() => dialog.closeAll());

  function open(quote: Quote | null): MatDialogRef<QuoteEditDialogComponent, string> {
    const ref = QuoteEditDialogComponent.open(dialog, quote);
    TestBed.tick();
    return ref;
  }

  function overlay(): HTMLElement {
    return document.querySelector<HTMLElement>('.cdk-overlay-container')!;
  }

  function saveButton(): HTMLButtonElement {
    const match = [...overlay().querySelectorAll('button')]
      .find((button) => ['Save', 'Add quote'].includes(button.textContent!.trim()));

    return match as HTMLButtonElement;
  }

  function cancelButton(): HTMLButtonElement {
    return [...overlay().querySelectorAll('button')]
      .find((button) => button.textContent!.trim() === 'Cancel') as HTMLButtonElement;
  }

  function type(value: string): void {
    const field = overlay().querySelector('textarea')!;

    field.value = value;
    field.dispatchEvent(new Event('input'));
    TestBed.tick();
  }

  it('should start empty when adding', () => {
    open(null);

    expect(overlay().querySelector('h2')!.textContent).toContain('Add quote');
    expect(overlay().querySelector('textarea')!.value).toBe('');
  });

  it('should start from the existing text when editing', () => {
    open(EXISTING);

    expect(overlay().querySelector('h2')!.textContent).toContain('Edit quote 2');
    expect(overlay().querySelector('textarea')!.value).toBe('The original text');
  });

  it('should not allow saving an empty new quote', () => {
    open(null);

    expect(saveButton().disabled).toBe(true);
  });

  // The whole point of the dirty check: an untouched edit has nothing to send.
  it('should not allow saving an edit that changed nothing', () => {
    open(EXISTING);

    expect(saveButton().disabled).toBe(true);
  });

  it('should allow saving once the text actually differs', () => {
    open(EXISTING);

    type('Something else');

    expect(saveButton().disabled).toBe(false);
  });

  it('should treat re-typing the original text as unchanged again', () => {
    open(EXISTING);

    type('Something else');
    expect(saveButton().disabled).toBe(false);

    type('The original text');
    expect(saveButton().disabled).toBe(true);
  });

  // The text is stored trimmed, so padding it is not an edit.
  it('should not count added surrounding whitespace as a change', () => {
    open(EXISTING);

    type('  The original text  ');

    expect(saveButton().disabled).toBe(true);
  });

  it('should refuse a quote longer than the limit', () => {
    open(EXISTING);

    type('y'.repeat(501));

    expect(saveButton().disabled).toBe(true);
  });

  it('should close with the trimmed text when saved', async () => {
    const ref = open(EXISTING);
    const closed = new Promise((resolve) => ref.afterClosed().subscribe(resolve));

    type('  Rewritten  ');
    saveButton().click();
    TestBed.tick();

    expect(await closed).toBe('Rewritten');
  });

  // A bare mat-dialog-close attribute closes with the empty string, which the caller cannot tell
  // apart from a quote worth saving — that surfaced as "Could not add the quote." on cancel.
  it('should close with undefined when cancelled, never an empty string', async () => {
    const ref = open(null);
    const closed = new Promise((resolve) => ref.afterClosed().subscribe(resolve));

    cancelButton().click();
    TestBed.tick();

    expect(await closed).toBeUndefined();
  });

  it('should discard typed text when cancelled', async () => {
    const ref = open(EXISTING);
    const closed = new Promise((resolve) => ref.afterClosed().subscribe(resolve));

    type('Typed but abandoned');
    cancelButton().click();
    TestBed.tick();

    expect(await closed).toBeUndefined();
  });

  it('should count the characters as they are typed', () => {
    open(null);

    type('12345');

    expect(overlay().querySelector('mat-hint')!.textContent).toContain('5 of 500');
  });
});
