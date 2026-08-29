import { TwitchUser } from './twitch-user';

export interface Birthday {
  userId: string;
  day: number;
  month: number;
  year: number;
}

export interface FollowerBirthday extends Birthday {
  user: TwitchUser | null;
}

export type BirthdayDraft = Pick<Birthday, 'day' | 'month' | 'year'>;

export function birthdayToDate(birthday: Birthday): Date {
  return new Date(birthday.year, birthday.month - 1, birthday.day);
}

export function dateToBirthdayDraft(date: Date): BirthdayDraft {
  return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

const MS_PER_DAY: number = 86400000; // 24 * 60 * 60 * 1000

export function ageOn(birthday: Birthday, today: Date): number {
  const month: number = today.getMonth() + 1;
  const passed: boolean = month > birthday.month || (month === birthday.month && today.getDate() >= birthday.day);

  return today.getFullYear() - birthday.year - (passed ? 0 : 1);
}

export function daysUntilNextBirthday(birthday: Birthday, today: Date): number {
  const midnight: Date = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let next: Date = new Date(midnight.getFullYear(), birthday.month - 1, birthday.day);
  if (next < midnight) next = new Date(midnight.getFullYear() + 1, birthday.month - 1, birthday.day);

  return Math.round((next.getTime() - midnight.getTime()) / MS_PER_DAY);
}