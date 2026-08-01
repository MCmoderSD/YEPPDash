import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { vi } from 'vitest';
import { DashModule } from '../dash.module';
import { CommandPageComponent } from './command-page.component';
import { ConfirmActionDialogComponent } from '../../components/confirm-action-dialog-component/confirm-action-dialog.component';
import { AuthService } from '../../services/auth.service';
import { CommandService } from '../../services/command.service';
import { NotificationService } from '../../services/notification.service';
import {
  CommandResponseType,
  CommandUserLevel,
  CustomCommand,
  CustomCommandDraft,
} from '../../data/custom-command';
import { TwitchUser } from '../../data/twitch-user';

const USER = '644984959';

function twitchUser(): TwitchUser {
  return {
    id: USER,
    login: 'mcmodersd',
    displayName: 'MCmoderSD',
    type: '',
    broadcasterType: '',
    description: '',
    profileImageUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/avatar-300x300.png',
    offlineImageUrl: null,
    createdAt: '2017-05-01T00:00:00Z',
    email: null,
  };
}

function command(overrides: Partial<CustomCommand> = {}): CustomCommand {
  return {
    name: 'hug',
    aliases: ['cuddle'],
    message: 'YEPP hugs you',
    active: true,
    responseType: CommandResponseType.Reply,
    userLevel: CommandUserLevel.Everyone,
    ...overrides,
  };
}

class FakeCommandService {
  entries: CustomCommand[] = [];
  getCommands = vi.fn(async (): Promise<CustomCommand[]> => this.entries);
  addCommand = vi.fn(async (_channel: string, draft: CustomCommandDraft): Promise<CustomCommand> => draft);
  updateCommand = vi.fn(async (_channel: string, _name: string, draft: CustomCommandDraft): Promise<CustomCommand> => draft);
  setActive = vi.fn(async (_channel: string, name: string, active: boolean): Promise<CustomCommand> =>
    command({ name, active }));
  deleteCommand = vi.fn(async (): Promise<void> => undefined);
}

describe('CommandPageComponent', () => {
  let commands: FakeCommandService;
  let notifications: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [
        { provide: CommandService, useClass: FakeCommandService },
        { provide: AuthService, useValue: { currentUser: signal(twitchUser()) } },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    commands = TestBed.inject(CommandService) as unknown as FakeCommandService;
    notifications = TestBed.inject(NotificationService);
  });

  afterEach(() => vi.restoreAllMocks());

  async function settle(fixture: ComponentFixture<CommandPageComponent>): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  async function render(): Promise<ComponentFixture<CommandPageComponent>> {
    // The component loads in its constructor, so the fixture is only built once the fake is set up.
    const fixture = TestBed.createComponent(CommandPageComponent);
    fixture.detectChanges();

    await settle(fixture);
    return fixture;
  }

  function element(fixture: ComponentFixture<CommandPageComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function names(fixture: ComponentFixture<CommandPageComponent>): string[] {
    return [...element(fixture).querySelectorAll('.command-table-edit')]
      .map((button) => button.textContent!.trim());
  }

  function summary(fixture: ComponentFixture<CommandPageComponent>): string {
    return element(fixture).querySelector('.command-page-count')!.textContent!.trim();
  }

  function editor(fixture: ComponentFixture<CommandPageComponent>): HTMLElement | null {
    return element(fixture).querySelector<HTMLElement>('app-command-edit');
  }

  function addButton(fixture: ComponentFixture<CommandPageComponent>): HTMLButtonElement {
    return element(fixture).querySelector<HTMLButtonElement>('.command-page-toolbar button')!;
  }

  async function click(fixture: ComponentFixture<CommandPageComponent>, target: HTMLElement): Promise<void> {
    target.click();
    fixture.detectChanges();

    await settle(fixture);
  }

  async function fill(
    fixture: ComponentFixture<CommandPageComponent>,
    values: { name?: string; message?: string },
  ): Promise<void> {
    const open = editor(fixture)!;

    if (values.name !== undefined) {
      const field = open.querySelector<HTMLInputElement>('input[matInput]')!;
      field.value = values.name;
      field.dispatchEvent(new Event('input'));
    }

    if (values.message !== undefined) {
      const field = open.querySelector('textarea')!;
      field.value = values.message;
      field.dispatchEvent(new Event('input'));
    }

    fixture.detectChanges();
    await click(fixture, open.querySelector<HTMLButtonElement>('button[type="submit"]')!);
  }

  function answerConfirm(confirmed: boolean): void {
    vi.spyOn(ConfirmActionDialogComponent, 'confirm').mockResolvedValue(confirmed);
  }

  it('should list the commands of the channel', async () => {
    commands.entries = [command(), command({ name: 'lurk' })];

    const fixture = await render();

    expect(commands.getCommands).toHaveBeenCalledWith(USER);
    expect(names(fixture)).toEqual(['hug', 'lurk']);
  });

  it('should say the channel has no commands yet', async () => {
    expect(summary(await render())).toBe('No commands in your channel yet');
  });

  it('should count the commands', async () => {
    commands.entries = [command(), command({ name: 'lurk' })];

    expect(summary(await render())).toBe('2 commands in your channel');
  });

  // Only worth mentioning when some are switched off — otherwise it is noise on every channel.
  it('should count the active ones separately when some are off', async () => {
    commands.entries = [command(), command({ name: 'lurk', active: false })];

    expect(summary(await render())).toBe('2 commands in your channel, 1 active');
  });

  it('should say so when the list could not be loaded', async () => {
    commands.getCommands.mockRejectedValue(new Error('nope'));
    const failure = vi.spyOn(notifications, 'failure');

    const fixture = await render();

    expect(element(fixture).querySelector('.command-table-empty')!.textContent)
      .toContain('Could not load your commands');
    expect(failure).toHaveBeenCalledWith('Could not load your commands.');
  });

  it('should open a form in the table rather than a dialog', async () => {
    const fixture = await render();

    await click(fixture, addButton(fixture));

    expect(editor(fixture)).not.toBeNull();
    expect(document.querySelector('.cdk-overlay-container mat-dialog-container')).toBeNull();
  });

  it('should add the command the form was filled in with', async () => {
    const fixture = await render();

    await click(fixture, addButton(fixture));
    await fill(fixture, { name: 'lurk', message: 'bye' });

    expect(commands.addCommand)
      .toHaveBeenCalledWith(USER, {
        name: 'lurk',
        aliases: [],
        message: 'bye',
        active: true,
        responseType: CommandResponseType.Reply,
        userLevel: CommandUserLevel.Everyone,
      });
  });

  // "bei add wird er automatisch aktiviert" — nothing in the form asks about it.
  it('should add a command already switched on', async () => {
    const fixture = await render();

    await click(fixture, addButton(fixture));
    expect(editor(fixture)!.querySelector('mat-slide-toggle')).toBeNull();

    await fill(fixture, { name: 'lurk', message: 'bye' });

    expect(commands.addCommand.mock.calls[0][1].active).toBe(true);
  });

  it('should close the form once the command is added', async () => {
    const fixture = await render();
    commands.entries = [command({ name: 'lurk', aliases: [], message: 'bye' })];

    await click(fixture, addButton(fixture));
    await fill(fixture, { name: 'lurk', message: 'bye' });

    expect(editor(fixture)).toBeNull();
    expect(names(fixture)).toEqual(['lurk']);
  });

  // Losing what was typed because the write was refused would be the worst moment to close.
  it('should leave the form open with what was typed when the write is refused', async () => {
    const fixture = await render();
    commands.addCommand.mockRejectedValue(new Error('nope'));

    await click(fixture, addButton(fixture));
    await fill(fixture, { name: 'lurk', message: 'bye' });

    expect(editor(fixture)).not.toBeNull();
    expect(editor(fixture)!.querySelector<HTMLInputElement>('input[matInput]')!.value).toBe('lurk');
  });

  it('should add nothing when the form is cancelled', async () => {
    const fixture = await render();

    await click(fixture, addButton(fixture));
    await click(
      fixture,
      [...editor(fixture)!.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Cancel')!,
    );

    expect(commands.addCommand).not.toHaveBeenCalled();
    expect(editor(fixture)).toBeNull();
  });

  // The name in the path is the one it was stored under, even when the form renames it.
  it('should update a command under the name it was stored as', async () => {
    commands.entries = [command()];
    const fixture = await render();

    await click(fixture, element(fixture).querySelector<HTMLElement>('.command-table-edit')!);
    await fill(fixture, { name: 'squeeze' });

    expect(commands.updateCommand)
      .toHaveBeenCalledWith(USER, 'hug', {
        name: 'squeeze',
        aliases: ['cuddle'],
        message: 'YEPP hugs you',
        active: true,
        responseType: CommandResponseType.Reply,
        userLevel: CommandUserLevel.Everyone,
      });
  });

  // The form inside the row fires a native, bubbling `submit` event. Where the table's own output
  // shares that name, the DOM event reaches this handler as well — as a SubmitEvent carrying no
  // draft, which surfaced as "Could not update undefined." alongside the write that did work.
  it('should not also react to the raw form submit event', async () => {
    commands.entries = [command()];
    const fixture = await render();
    const failure = vi.spyOn(notifications, 'failure');

    await click(fixture, element(fixture).querySelector<HTMLElement>('.command-table-edit')!);
    await fill(fixture, { message: 'Rewritten' });

    expect(failure).not.toHaveBeenCalled();
    expect(commands.updateCommand).toHaveBeenCalledTimes(1);
  });

  it('should close the form once the command is updated', async () => {
    commands.entries = [command()];
    const fixture = await render();

    await click(fixture, element(fixture).querySelector<HTMLElement>('.command-table-edit')!);
    await fill(fixture, { message: 'Rewritten' });

    expect(editor(fixture)).toBeNull();
  });

  it('should delete a command once the deletion is confirmed', async () => {
    commands.entries = [command()];
    const fixture = await render();
    answerConfirm(true);

    await click(fixture, element(fixture).querySelector<HTMLElement>('.command-table-delete')!);

    expect(commands.deleteCommand).toHaveBeenCalledWith(USER, 'hug');
  });

  it('should delete nothing when the confirmation is declined', async () => {
    commands.entries = [command()];
    const fixture = await render();
    answerConfirm(false);

    await click(fixture, element(fixture).querySelector<HTMLElement>('.command-table-delete')!);

    expect(commands.deleteCommand).not.toHaveBeenCalled();
  });

  it('should flip a command when its switch is used', async () => {
    commands.entries = [command()];
    const fixture = await render();

    await click(fixture, element(fixture).querySelector<HTMLElement>('mat-slide-toggle button[role="switch"]')!);

    expect(commands.setActive).toHaveBeenCalledWith(USER, 'hug', false);
  });

  // The switch has already moved, so re-reading the whole list would only flick it back and forth.
  it('should patch the flipped row in place rather than reload the list', async () => {
    commands.entries = [command()];
    const fixture = await render();
    commands.getCommands.mockClear();

    await click(fixture, element(fixture).querySelector<HTMLElement>('mat-slide-toggle button[role="switch"]')!);

    expect(commands.getCommands).not.toHaveBeenCalled();
    expect(element(fixture).querySelector('mat-slide-toggle button[role="switch"]')!.getAttribute('aria-checked'))
      .toBe('false');
  });

  // Without this the table would keep showing the state the switch moved to, which the channel
  // never actually got.
  it('should put the switch back when the flip is refused', async () => {
    commands.entries = [command()];
    const fixture = await render();
    commands.setActive.mockRejectedValue(new Error('nope'));

    await click(fixture, element(fixture).querySelector<HTMLElement>('mat-slide-toggle button[role="switch"]')!);

    expect(element(fixture).querySelector('mat-slide-toggle button[role="switch"]')!.getAttribute('aria-checked'))
      .toBe('true');
  });

  // The backend names the trigger that is taken, which beats a message this page could write.
  it('should show the reason a refused write gives', async () => {
    const fixture = await render();
    const failure = vi.spyOn(notifications, 'failure');
    commands.addCommand.mockRejectedValue(new HttpErrorResponse({
      status: 409,
      error: "'lurk' is already used by another command in this channel.",
    }));

    await click(fixture, addButton(fixture));
    await fill(fixture, { name: 'lurk', message: 'bye' });

    expect(failure).toHaveBeenCalledWith("'lurk' is already used by another command in this channel.");
  });

  it('should fall back to its own message when a failure explains nothing', async () => {
    const fixture = await render();
    const failure = vi.spyOn(notifications, 'failure');
    commands.addCommand.mockRejectedValue(new Error('nope'));

    await click(fixture, addButton(fixture));
    await fill(fixture, { name: 'lurk', message: 'bye' });

    expect(failure).toHaveBeenCalledWith('Could not add lurk.');
  });
});
