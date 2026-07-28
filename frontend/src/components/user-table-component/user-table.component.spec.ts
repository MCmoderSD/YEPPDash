import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { UserComponentsModule } from '../user-components.module';
import { UserTableComponent } from './user-table.component';
import { UserInfoDialogComponent } from '../user-info-dialog-component/user-info-dialog.component';
import { TwitchUser } from '../../data/twitch-user';

function user(id: string, displayName: string): TwitchUser {
  return {
    id,
    login: displayName.toLowerCase(),
    displayName,
    type: '',
    broadcasterType: '',
    description: '',
    profileImageUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/avatar-300x300.png',
    offlineImageUrl: null,
    createdAt: '2017-05-01T00:00:00Z',
    email: null,
  };
}

const USERS: TwitchUser[] = [
  user('9', 'zoe'),
  user('164284617', 'MCmoderSD'),
  user('42', 'alice'),
];

describe('UserTableComponent', () => {
  let fixture: ComponentFixture<UserTableComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserComponentsModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(UserTableComponent);
    element = fixture.nativeElement as HTMLElement;

    fixture.componentRef.setInput('users', USERS);
    fixture.detectChanges();
  });

  function names(): string[] {
    return [...element.querySelectorAll('.user-table-name')].map((cell) => cell.textContent!.trim());
  }

  function search(term: string): void {
    const input = element.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = term;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function sortBy(header: string): void {
    const button = [...element.querySelectorAll<HTMLElement>('th .mat-sort-header-container')]
      .find((candidate) => candidate.textContent!.includes(header))!;

    button.click();
    fixture.detectChanges();
  }

  it('should render a row per user with avatar, name and id', () => {
    expect(names()).toEqual(['zoe', 'MCmoderSD', 'alice']);
    expect(element.querySelectorAll('.user-table-avatar')).toHaveLength(3);
    expect(element.textContent).toContain('164284617');
  });

  it('should hide the remove column in user mode', () => {
    expect(element.querySelectorAll('thead th')).toHaveLength(3);
    expect(element.querySelector('.user-table-actions')).toBeNull();
  });

  it.each(['vip', 'editor', 'moderator'] as const)('should show the remove column in %s mode', (mode) => {
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();

    expect(element.querySelectorAll('thead th')).toHaveLength(4);
    expect(element.querySelectorAll('.user-table-actions')).toHaveLength(3);
  });

  it('should name the role of the removal in the button label', () => {
    fixture.componentRef.setInput('mode', 'vip');
    fixture.detectChanges();

    const button = element.querySelector('.user-table-actions button')!;
    expect(button.getAttribute('aria-label')).toBe('Remove zoe as VIP');
  });

  it('should hand the removed user to the caller without opening the dialog', () => {
    const dialog = vi.spyOn(TestBed.inject(MatDialog), 'open');
    const removed: TwitchUser[] = [];

    fixture.componentRef.setInput('mode', 'moderator');
    fixture.componentInstance.remove.subscribe((target: TwitchUser) => removed.push(target));
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('.user-table-actions button')!.click();
    fixture.detectChanges();

    expect(removed.map((target) => target.displayName)).toEqual(['zoe']);
    expect(dialog).not.toHaveBeenCalled();
  });

  it('should filter by display name regardless of case', () => {
    search('mcMODER');
    expect(names()).toEqual(['MCmoderSD']);
  });

  it('should filter by user id as well', () => {
    search('1642');
    expect(names()).toEqual(['MCmoderSD']);
  });

  it('should explain an empty result instead of showing a blank table', () => {
    search('nobody');

    expect(names()).toEqual([]);
    expect(element.querySelector('.user-table-empty')!.textContent).toContain('nobody');
  });

  it('should sort names case-insensitively', () => {
    // A case-sensitive compare would sort every capital ahead of every lowercase letter and put
    // MCmoderSD first, which is exactly the bug this guards against.
    sortBy('Name');
    expect(names()).toEqual(['alice', 'MCmoderSD', 'zoe']);

    sortBy('Name');
    expect(names()).toEqual(['zoe', 'MCmoderSD', 'alice']);
  });

  it('should sort ids by value rather than as text', () => {
    // Lexicographically "164284617" sorts before "42" and "9".
    sortBy('User ID');
    expect(names()).toEqual(['zoe', 'alice', 'MCmoderSD']);
  });

  it('should open the details dialog for a clicked row', () => {
    const dialog = vi.spyOn(TestBed.inject(MatDialog), 'open');

    element.querySelector<HTMLElement>('.user-table-row')!.click();

    expect(dialog).toHaveBeenCalledTimes(1);
    expect(dialog.mock.calls[0][0]).toBe(UserInfoDialogComponent);
    expect(dialog.mock.calls[0][1]?.data).toEqual(USERS[0]);
  });

  it('should open the dialog once when the name button is used', () => {
    const dialog = vi.spyOn(TestBed.inject(MatDialog), 'open');

    element.querySelector<HTMLButtonElement>('.user-table-name')!.click();

    expect(dialog).toHaveBeenCalledTimes(1);
  });
});
