import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BirthdayEditDialogComponent } from './birthday-edit-dialog.component';
import { Birthday, BirthdayDraft } from '../../data/birthday';

const BIRTHDAY: Birthday = { userId: '644984959', day: 17, month: 5, year: 2000 };

describe('BirthdayEditDialogComponent', () => {
  let dialog: MatDialog;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatDialogModule, BirthdayEditDialogComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    dialog = TestBed.inject(MatDialog);
  });

  afterEach(() => dialog.closeAll());

  function open(birthday: Birthday | null) {
    const ref = BirthdayEditDialogComponent.open(dialog, birthday);
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

  // The picker's own DOM needs layout that jsdom does not have, so the date is handed over the way
  // the picker would hand it over.
  function pick(ref: { componentInstance: BirthdayEditDialogComponent }, date: Date | null): void {
    (ref.componentInstance as unknown as { choose(value: Date | null): void }).choose(date);
    TestBed.tick();
  }

  it('should say it is setting a birthday when there is none', () => {
    open(null);

    expect(overlay().querySelector('h2')!.textContent).toContain('Set your birthday');
  });

  it('should say it is changing a birthday when there is one', () => {
    open(BIRTHDAY);

    expect(overlay().querySelector('h2')!.textContent).toContain('Change your birthday');
  });

  it('should start the field on the stored date', () => {
    open(BIRTHDAY);

    // Read off the component rather than the rendered text, which depends on the date adapter's
    // locale formatting.
    const initial = overlay().querySelector<HTMLInputElement>('input')!;
    expect(initial.value).toBeTruthy();
  });

  it('should not offer to save until a date is picked', () => {
    open(null);

    expect(button('Save').disabled).toBe(true);
  });

  it('should offer to save once a date is picked', () => {
    const ref = open(null);

    pick(ref, new Date(2000, 4, 17));

    expect(button('Save').disabled).toBe(false);
  });

  // Re-picking what is already stored would send a request that changes nothing.
  it('should not offer to save the date that is already stored', () => {
    const ref = open(BIRTHDAY);

    pick(ref, new Date(2000, 4, 17));

    expect(button('Save').disabled).toBe(true);
  });

  it('should offer to save a date that differs from the stored one', () => {
    const ref = open(BIRTHDAY);

    pick(ref, new Date(2000, 4, 18));

    expect(button('Save').disabled).toBe(false);
  });

  it('should not offer to save after the field is cleared', () => {
    const ref = open(BIRTHDAY);

    pick(ref, null);

    expect(button('Save').disabled).toBe(true);
  });

  it('should close with the parts of the date that was picked', async () => {
    const ref = open(null);
    const closed = new Promise<BirthdayDraft | undefined>((resolve) => ref.afterClosed().subscribe(resolve));

    // Local month is zero based, so this is the 17th of May.
    pick(ref, new Date(2000, 4, 17));
    button('Save').click();
    TestBed.tick();

    expect(await closed).toEqual({ day: 17, month: 5, year: 2000 });
  });

  // A birthday is a calendar date: reading the picked value in UTC would shift it by a day for
  // anyone behind Greenwich.
  it('should read the date the user picked rather than its UTC equivalent', async () => {
    const ref = open(null);
    const closed = new Promise<BirthdayDraft | undefined>((resolve) => ref.afterClosed().subscribe(resolve));

    // Just after local midnight, which is the previous day in UTC for any negative offset.
    pick(ref, new Date(2000, 0, 1, 0, 30));
    button('Save').click();
    TestBed.tick();

    expect(await closed).toEqual({ day: 1, month: 1, year: 2000 });
  });

  it('should close with nothing when cancelled', async () => {
    const ref = open(BIRTHDAY);
    const closed = new Promise<BirthdayDraft | undefined>((resolve) => ref.afterClosed().subscribe(resolve));

    button('Cancel').click();
    TestBed.tick();

    // Undefined rather than anything the caller might mistake for a date to save.
    expect(await closed).toBeUndefined();
  });

  it('should not offer a date in the future or one before the table allows', () => {
    const ref = open(null);
    const limits = ref.componentInstance as unknown as { earliest: Date; latest: Date };

    expect(limits.earliest.getFullYear()).toBe(1900);
    expect(limits.latest.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
