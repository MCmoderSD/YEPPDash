import { Component, computed, inject, Signal, signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Birthday, BirthdayDraft, birthdayToDate, dateToBirthdayDraft } from '../../data/birthday';
import { LocaleDateAdapter } from './locale-date.adapter';

const MIN_YEAR: number = 1900;

export interface BirthdayEditDialogData {
  birthday: Birthday | null;
}

// Standalone so it can be imported on demand: it is the only thing in the app that needs
// Material's datepicker, and it is opened from the app shell, which every page loads.
@Component({
  selector: 'app-birthday-edit-dialog',
  templateUrl: './birthday-edit-dialog.component.html',
  styleUrl: './birthday-edit-dialog.component.scss',
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  // MAT_DATE_LOCALE defaults to LOCALE_ID, which is fixed at build time and is en-US — the same
  // thing that pinned every other date here to the American order, and what LocaleDatePipe exists
  // to avoid. Handing it undefined lets Intl fall back to the platform's own locale instead, so the
  // field is written the way the reader writes dates.
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: undefined },
    { provide: DateAdapter, useClass: LocaleDateAdapter },
  ],
})
export class BirthdayEditDialogComponent {

  private readonly dialogRef: MatDialogRef<BirthdayEditDialogComponent, BirthdayDraft> = inject<MatDialogRef<BirthdayEditDialogComponent, BirthdayDraft>>(MatDialogRef);

  private readonly data: BirthdayEditDialogData = inject<BirthdayEditDialogData>(MAT_DIALOG_DATA);

  protected readonly editing: boolean = this.data.birthday !== null;

  protected readonly title: string = this.editing ? 'Change your birthday' : 'Set your birthday';

  protected readonly initial: Date | null = this.data.birthday ? birthdayToDate(this.data.birthday) : null;

  protected readonly earliest: Date = new Date(MIN_YEAR, 0, 1);

  protected readonly latest: Date = new Date();

  private readonly selected: WritableSignal<Date | null> = signal<Date | null>(this.initial);

  protected readonly canSave: Signal<boolean> = computed((): boolean => {
    const date: Date | null = this.selected();
    if (!date) return false;

    const stored: Birthday | null = this.data.birthday;
    if (!stored) return true;

    const draft: BirthdayDraft = dateToBirthdayDraft(date);
    return draft.day !== stored.day || draft.month !== stored.month || draft.year !== stored.year;
  });

  static open(dialog: MatDialog, birthday: Birthday | null,): MatDialogRef<BirthdayEditDialogComponent, BirthdayDraft> {
    return dialog.open<BirthdayEditDialogComponent, BirthdayEditDialogData, BirthdayDraft>(
      BirthdayEditDialogComponent,
      {
        data: { birthday },
        width: '26rem',
        minWidth: 'min(20rem, 92vw)',
        maxWidth: '92vw',
      },
    );
  }

  protected choose(date: Date | null): void {
    this.selected.set(date);
  }

  protected save(): void {
    const date: Date | null = this.selected();
    if (date && this.canSave()) this.dialogRef.close(dateToBirthdayDraft(date));
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}