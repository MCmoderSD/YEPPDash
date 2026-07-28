import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { UserComponentsModule } from '../user-components.module';
import { UserAddDialogComponent } from './user-add-dialog.component';
import { TwitchService } from '../../services/twitch.service';
import { TwitchUser } from '../../data/twitch-user';

function twitchUser(id: string, displayName: string): TwitchUser {
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

const USER: TwitchUser = twitchUser('164284617', 'MCmoderSD');

class FakeTwitchService {
  getUsers = vi.fn(async (_ids: readonly string[] = [], _logins: readonly string[] = []) => [] as TwitchUser[]);
  getChatColor = vi.fn(async () => '#9146FF' as string | null);
}

describe('UserAddDialogComponent', () => {
  let fixture: ComponentFixture<UserAddDialogComponent>;
  let element: HTMLElement;
  let twitch: FakeTwitchService;
  let closed: (TwitchUser | undefined)[];

  beforeEach(async () => {
    closed = [];

    await TestBed.configureTestingModule({
      imports: [UserComponentsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { title: 'Add moderator' } },
        { provide: MatDialogRef, useValue: { close: (value?: TwitchUser) => closed.push(value) } },
        { provide: TwitchService, useClass: FakeTwitchService },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    twitch = TestBed.inject(TwitchService) as unknown as FakeTwitchService;

    fixture = TestBed.createComponent(UserAddDialogComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  async function search(term: string): Promise<void> {
    element.querySelector<HTMLInputElement>('input[matInput]')!.value = term;
    element.querySelector('form')!.dispatchEvent(new Event('submit'));

    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function addButton(): HTMLButtonElement {
    return [...element.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')]
      .find((button) => button.textContent!.includes('Add'))!;
  }

  it('should name the role it is adding for', () => {
    expect(element.querySelector('h2')!.textContent).toContain('Add moderator');
    expect(addButton().textContent).toContain('Add moderator');
  });

  it('should refuse to add anything before a search found someone', () => {
    expect(addButton().disabled).toBe(true);
  });

  it('should look the term up as a lowercase login', async () => {
    twitch.getUsers.mockResolvedValueOnce([USER]);
    await search('MCmoderSD');

    expect(twitch.getUsers).toHaveBeenCalledWith([], ['mcmodersd']);
    expect(element.querySelector('.user-add-name')!.textContent!.trim()).toBe('MCmoderSD');
    expect(element.querySelector<HTMLImageElement>('.user-add-avatar')!.src).toContain('avatar-300x300.png');
  });

  it('should paint the found name in that user’s chat colour', async () => {
    twitch.getUsers.mockResolvedValueOnce([USER]);
    await search('mcmodersd');

    const name = element.querySelector<HTMLElement>('.user-add-name')!;
    expect(name.style.getPropertyValue('--chat-color')).toBe('#9146FF');
  });

  it('should retry a numeric term as a user id when no login matches', async () => {
    twitch.getUsers
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([USER]);

    await search('164284617');

    expect(twitch.getUsers).toHaveBeenNthCalledWith(1, [], ['164284617']);
    expect(twitch.getUsers).toHaveBeenNthCalledWith(2, ['164284617'], []);
    expect(element.querySelector('.user-add-name')!.textContent!.trim()).toBe('MCmoderSD');
  });

  it('should keep a numeric login that does resolve rather than retrying it as an id', async () => {
    twitch.getUsers.mockResolvedValueOnce([twitchUser('7', '12345')]);
    await search('12345');

    expect(twitch.getUsers).toHaveBeenCalledTimes(1);
  });

  it('should not retry a non-numeric miss as an id', async () => {
    twitch.getUsers.mockResolvedValueOnce([]);
    await search('ghost');

    expect(twitch.getUsers).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.user-add-message')!.textContent).toContain('ghost');
    expect(addButton().disabled).toBe(true);
  });

  it('should report a failed lookup instead of an empty result', async () => {
    twitch.getUsers.mockRejectedValueOnce(new Error('502'));
    await search('anyone');

    expect(element.querySelector('.user-add-message')!.textContent).toContain('Could not reach Twitch');
  });

  it('should ignore a blank search', async () => {
    await search('   ');
    expect(twitch.getUsers).not.toHaveBeenCalled();
  });

  it('should hand the found user back to the caller', async () => {
    twitch.getUsers.mockResolvedValueOnce([USER]);
    await search('mcmodersd');

    addButton().click();

    expect(closed).toEqual([USER]);
  });
});
