export interface Birthday {
  userId: string;
  day: number;
  month: number;
  year: number;
}

export type BirthdayDraft = Pick<Birthday, 'day' | 'month' | 'year'>;

export function birthdayToDate(birthday: Birthday): Date {
  return new Date(birthday.year, birthday.month - 1, birthday.day);
}

export function dateToBirthdayDraft(date: Date): BirthdayDraft {
  return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** How old the person is on `today`, counting the birthday itself as the day they turn that age. */
export function ageOn(birthday: Birthday, today: Date): number {
  const month: number = today.getMonth() + 1;
  const passed: boolean = month > birthday.month
    || (month === birthday.month && today.getDate() >= birthday.day);

  return today.getFullYear() - birthday.year - (passed ? 0 : 1);
}

/** Whole days from `today` to the next time this birthday comes round; 0 on the day itself. */
export function daysUntilNextBirthday(birthday: Birthday, today: Date): number {
  const midnight: Date = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // A 29th of February rolls forward to the 1st of March in a common year rather than throwing,
  // which is as good an answer as any for a date that does not exist that year.
  let next: Date = new Date(midnight.getFullYear(), birthday.month - 1, birthday.day);
  if (next < midnight) next = new Date(midnight.getFullYear() + 1, birthday.month - 1, birthday.day);

  // Rounded, not floored: two local midnights either side of a daylight-saving switch are 23 or 25
  // hours apart, and flooring that would report a day too few.
  return Math.round((next.getTime() - midnight.getTime()) / MS_PER_DAY);
}