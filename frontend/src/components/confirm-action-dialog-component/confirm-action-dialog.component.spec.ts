import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { vi } from 'vitest';
import { DashModule } from '../../pages/dash.module';
import { ConfirmActionDialogComponent, ConfirmActionDialogData } from './confirm-action-dialog.component';

describe('ConfirmActionDialogComponent', () => {
  let dialog: MatDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    }).compileComponents();

    dialog = TestBed.inject(MatDialog);
  });

  afterEach(() => {
    dialog.closeAll();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function open(data: Partial<ConfirmActionDialogData> = {}) {
    const ref = ConfirmActionDialogComponent.open(dialog, {
      title: 'Delete quote 3?',
      message: 'This cannot be undone.',
      ...data,
    });

    TestBed.tick();
    return ref;
  }

  function overlay(): HTMLElement {
    return document.querySelector<HTMLElement>('.cdk-overlay-container')!;
  }

  function button(label: string): HTMLButtonElement {
    const match = [...overlay().querySelectorAll('button')]
      .find((candidate) => candidate.textContent!.trim().startsWith(label));

    if (!match) throw new Error(`No button starting with "${label}".`);
    return match as HTMLButtonElement;
  }

  it('should show the title and message it was given', () => {
    open();

    expect(overlay().querySelector('h2')!.textContent).toContain('Delete quote 3?');
    expect(overlay().querySelector('.confirm-action-message')!.textContent).toContain('This cannot be undone.');
  });

  it('should use the labels it was given', () => {
    open({ confirmLabel: 'Delete', cancelLabel: 'Keep it' });

    expect(button('Delete')).toBeTruthy();
    expect(button('Keep it')).toBeTruthy();
  });

  it('should default to Cancel and Confirm', () => {
    open();

    expect(button('Cancel')).toBeTruthy();
    expect(button('Confirm')).toBeTruthy();
  });

  it('should close with true when confirmed', async () => {
    const ref = open();
    const closed = new Promise((resolve) => ref.afterClosed().subscribe(resolve));

    button('Confirm').click();
    TestBed.tick();

    expect(await closed).toBe(true);
  });

  it('should close with false when cancelled', async () => {
    const ref = open();
    const closed = new Promise((resolve) => ref.afterClosed().subscribe(resolve));

    button('Cancel').click();
    TestBed.tick();

    expect(await closed).toBe(false);
  });

  it('should enable confirm right away without a timeout', () => {
    open();

    expect(button('Confirm').disabled).toBe(false);
  });

  it('should keep confirm disabled until the timeout has passed', () => {
    vi.useFakeTimers();
    open({ timeoutMs: 3000, confirmLabel: 'Replace' });

    expect(button('Replace').disabled).toBe(true);
    // The countdown is on the button so the wait is visible without reading the hint.
    expect(button('Replace').textContent).toContain('(3)');

    vi.advanceTimersByTime(1000);
    TestBed.tick();
    expect(button('Replace').disabled).toBe(true);
    expect(button('Replace').textContent).toContain('(2)');

    vi.advanceTimersByTime(2000);
    TestBed.tick();
    expect(button('Replace').disabled).toBe(false);
    expect(button('Replace').textContent!.trim()).toBe('Replace');
  });

  it('should describe the disabled confirm button with the countdown hint', () => {
    vi.useFakeTimers();
    open({ timeoutMs: 2000 });

    const hint = overlay().querySelector('.confirm-action-hint')!;
    expect(button('Confirm').getAttribute('aria-describedby')).toBe(hint.id);
    expect(hint.textContent).toContain('2 seconds');

    vi.advanceTimersByTime(2000);
    TestBed.tick();

    // Once it is usable the hint is gone, so the button must not point at a missing element.
    expect(overlay().querySelector('.confirm-action-hint')).toBeNull();
    expect(button('Confirm').getAttribute('aria-describedby')).toBeNull();
  });

  it('should not close on a click while the timeout is still running', async () => {
    vi.useFakeTimers();
    const ref = open({ timeoutMs: 3000 });

    let result: boolean | undefined | 'still open' = 'still open';
    ref.afterClosed().subscribe((value) => (result = value));

    // Bypasses the disabled attribute the way a stray programmatic click would.
    ref.componentInstance['confirm']();
    TestBed.tick();

    expect(result).toBe('still open');
  });

  // Real timers here: the point is the teardown, not the countdown, and closing the dialog only
  // destroys the component once the overlay has detached.
  it('should stop its timer when the dialog is closed mid-countdown', async () => {
    const started = vi.spyOn(globalThis, 'setInterval');
    const stopped = vi.spyOn(globalThis, 'clearInterval');

    const ref = open({ timeoutMs: 5000 });

    // Identified by its interval so the assertion cannot be satisfied by a timer the dialog
    // infrastructure happens to own.
    const index = started.mock.calls.findIndex(([, delay]) => delay === 200);
    const handle = started.mock.results[index].value;

    ref.close(false);
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    // A timer left running would keep ticking against a destroyed component.
    expect(stopped).toHaveBeenCalledWith(handle);
  });

  it('should resolve confirm() to false when dismissed without an answer', async () => {
    const pending = ConfirmActionDialogComponent.confirm(dialog, { title: 'T', message: 'M' });
    TestBed.tick();

    // Escape and backdrop clicks close with undefined, which must read as "no".
    dialog.openDialogs[0].close(undefined);
    TestBed.tick();

    expect(await pending).toBe(false);
  });

  it('should resolve confirm() to true only on a real confirmation', async () => {
    const pending = ConfirmActionDialogComponent.confirm(dialog, { title: 'T', message: 'M' });
    TestBed.tick();

    button('Confirm').click();
    TestBed.tick();

    expect(await pending).toBe(true);
  });
});
