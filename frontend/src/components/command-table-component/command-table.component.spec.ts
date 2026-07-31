import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { DashModule } from '../../pages/dash.module';
import { CommandActiveChange, CommandSubmit, CommandTableComponent } from './command-table.component';
import { CommandResponseType, CommandUserLevel, CustomCommand } from '../../data/custom-command';

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

describe('CommandTableComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    }).compileComponents();
  });

  function render(
    commands: CustomCommand[],
    inputs: Record<string, unknown> = {},
  ): ComponentFixture<CommandTableComponent> {
    const fixture = TestBed.createComponent(CommandTableComponent);

    fixture.componentRef.setInput('commands', commands);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);

    fixture.detectChanges();
    return fixture;
  }

  function element(fixture: ComponentFixture<CommandTableComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rows(fixture: ComponentFixture<CommandTableComponent>): HTMLElement[] {
    return [...element(fixture).querySelectorAll<HTMLElement>('tr.command-table-row')];
  }

  function names(fixture: ComponentFixture<CommandTableComponent>): string[] {
    return [...element(fixture).querySelectorAll('.command-table-edit')]
      .map((button) => button.textContent!.trim());
  }

  function editors(fixture: ComponentFixture<CommandTableComponent>): HTMLElement[] {
    return [...element(fixture).querySelectorAll<HTMLElement>('app-command-edit')];
  }

  function emptyText(fixture: ComponentFixture<CommandTableComponent>): string {
    return element(fixture).querySelector('.command-table-empty')!.textContent!.trim();
  }

  function search(fixture: ComponentFixture<CommandTableComponent>, value: string): void {
    const field = element(fixture).querySelector<HTMLInputElement>('input[type="search"]')!;

    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function chevrons(fixture: ComponentFixture<CommandTableComponent>): HTMLButtonElement[] {
    return rows(fixture)
      .map((row) => [...row.querySelectorAll<HTMLButtonElement>('.command-table-actions button')].at(-1)!);
  }

  it('should list every command', () => {
    const fixture = render([command(), command({ name: 'lurk' })]);

    expect(names(fixture)).toEqual(['hug', 'lurk']);
  });

  // The prefix chat types is not part of the name, so it is never shown.
  it('should show no prefix on a name or an alias', () => {
    const fixture = render([command()]);

    expect(element(fixture).querySelector('.command-table-name')!.textContent).not.toContain('!');
    expect(element(fixture).querySelector('.command-table-alias')!.textContent!.trim()).toBe('cuddle');
  });

  it('should show the aliases of a command', () => {
    const fixture = render([command({ aliases: ['cuddle', 'snuggle'] })]);

    expect([...element(fixture).querySelectorAll('.command-table-alias')].map((chip) => chip.textContent!.trim()))
      .toEqual(['cuddle', 'snuggle']);
  });

  it('should say so when a command has no aliases', () => {
    const fixture = render([command({ aliases: [] })]);

    expect(element(fixture).querySelector('.command-table-none')!.textContent!.trim()).toBe('None');
  });

  // The cell is cut to two lines, so the whole reply has to stay reachable somewhere.
  it('should carry the full reply on the cell title', () => {
    const long = 'y'.repeat(300);
    const fixture = render([command({ message: long })]);

    expect(element(fixture).querySelector('.command-table-message')!.getAttribute('title')).toBe(long);
  });

  it('should mark a switched-off command as inactive', () => {
    const fixture = render([command({ active: false })]);

    expect(rows(fixture)[0].classList).toContain('command-table-row-inactive');
  });

  it('should show the switch in the state the command is in', () => {
    const fixture = render([command({ active: false })]);

    expect(element(fixture).querySelector('mat-slide-toggle button[role="switch"]')!.getAttribute('aria-checked'))
      .toBe('false');
  });

  describe('the editor row', () => {
    // The form is built only once the row it belongs to is opened, so a page of commands is not a
    // page of forms.
    it('should build no form until a row is opened', () => {
      expect(editors(render([command(), command({ name: 'lurk' })]))).toEqual([]);
    });

    it('should open the form of the row that was clicked', () => {
      const fixture = render([command(), command({ name: 'lurk' })]);

      rows(fixture)[1].click();
      fixture.detectChanges();

      expect(fixture.componentInstance.editing()).toBe('lurk');
      expect(editors(fixture).length).toBe(1);
    });

    it('should open the form from the name button, for the keyboard', () => {
      const fixture = render([command()]);

      element(fixture).querySelector<HTMLButtonElement>('.command-table-edit')!.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.editing()).toBe('hug');
    });

    it('should close the form when the open row is clicked again', () => {
      const fixture = render([command()], { editing: 'hug' });

      rows(fixture)[0].click();
      fixture.detectChanges();

      expect([fixture.componentInstance.editing(), editors(fixture).length]).toEqual([null, 0]);
    });

    // One at a time: opening another row's form replaces the one already open.
    it('should keep only one form open', () => {
      const fixture = render([command(), command({ name: 'lurk' })], { editing: 'hug' });

      rows(fixture)[1].click();
      fixture.detectChanges();

      expect([fixture.componentInstance.editing(), editors(fixture).length]).toEqual(['lurk', 1]);
    });

    it('should tell the form which command it is editing', () => {
      const fixture = render([command(), command({ name: 'lurk', aliases: [], message: 'bye' })], { editing: 'lurk' });

      expect(editors(fixture)[0].querySelector('textarea')!.value).toBe('bye');
    });

    // Every trigger except this command's own: those it is allowed to keep.
    it('should tell the form which triggers are already taken', () => {
      const fixture = render(
        [command(), command({ name: 'lurk', aliases: ['afk'] })],
        { editing: 'hug' },
      );

      const field = editors(fixture)[0].querySelector<HTMLInputElement>('input[matInput]')!;
      field.value = 'afk';
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(editors(fixture)[0].querySelector('.command-edit-error')!.textContent!.trim())
        .toBe('afk is already used by another command.');
    });

    it('should say whether a row is open, for a screen reader', () => {
      const fixture = render([command()], { editing: 'hug' });

      expect(element(fixture).querySelector('.command-table-edit')!.getAttribute('aria-expanded')).toBe('true');
      expect(element(fixture).querySelector('.command-table-edit')!.getAttribute('aria-controls'))
        .toBe(element(fixture).querySelector('.command-table-panel')!.id);
    });

    it('should report a save against the name the command is stored under', () => {
      const fixture = render([command()], { editing: 'hug' });
      const submitted: CommandSubmit[] = [];
      fixture.componentInstance.save.subscribe((entry: CommandSubmit) => submitted.push(entry));

      const field = editors(fixture)[0].querySelector('textarea')!;
      field.value = 'Rewritten';
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      editors(fixture)[0].querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

      expect(submitted).toEqual([{
        name: 'hug',
        draft: {
          name: 'hug',
          aliases: ['cuddle'],
          message: 'Rewritten',
          active: true,
          responseType: CommandResponseType.Reply,
          userLevel: CommandUserLevel.Everyone,
        },
      }]);
    });

    it('should close the form when it is cancelled', () => {
      const fixture = render([command()], { editing: 'hug' });

      [...editors(fixture)[0].querySelectorAll('button')]
        .find((button) => button.textContent!.trim() === 'Cancel')!.click();
      fixture.detectChanges();

      expect([fixture.componentInstance.editing(), editors(fixture).length]).toEqual([null, 0]);
    });
  });

  describe('the new command row', () => {
    it('should show no extra row until one is asked for', () => {
      expect(rows(render([command()])).length).toBe(1);
    });

    it('should add a row for the new command at the top', () => {
      const fixture = render([command()], { adding: true });

      expect(rows(fixture).length).toBe(2);
      expect(rows(fixture)[0].querySelector('.command-table-placeholder')!.textContent!.trim())
        .toBe('New command');
    });

    it('should open its form straight away', () => {
      const fixture = render([command()], { adding: true });

      expect(editors(fixture).length).toBe(1);
      expect(editors(fixture)[0].querySelector<HTMLInputElement>('input[matInput]')!.value).toBe('');
    });

    // There is nothing to switch or delete until it is a command.
    it('should offer neither a switch nor a delete on it', () => {
      const fixture = render([command()], { adding: true });

      expect(rows(fixture)[0].querySelector('mat-slide-toggle')).toBeNull();
      expect(rows(fixture)[0].querySelector('.command-table-delete')).toBeNull();
    });

    it('should report a save with no name, which is what marks it as new', () => {
      const fixture = render([], { adding: true });
      const submitted: CommandSubmit[] = [];
      fixture.componentInstance.save.subscribe((entry: CommandSubmit) => submitted.push(entry));

      const editor = editors(fixture)[0];
      const name = editor.querySelector<HTMLInputElement>('input[matInput]')!;
      const message = editor.querySelector('textarea')!;

      name.value = 'lurk';
      name.dispatchEvent(new Event('input'));
      message.value = 'bye';
      message.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      editor.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

      expect(submitted).toEqual([{
        name: null,
        draft: {
          name: 'lurk',
          aliases: [],
          message: 'bye',
          active: true,
          responseType: CommandResponseType.Reply,
          userLevel: CommandUserLevel.Everyone,
        },
      }]);
    });

    it('should take the row away when the form is cancelled', () => {
      const fixture = render([command()], { adding: true });

      [...editors(fixture)[0].querySelectorAll('button')]
        .find((button) => button.textContent!.trim() === 'Cancel')!.click();
      fixture.detectChanges();

      expect([fixture.componentInstance.adding(), rows(fixture).length]).toEqual([false, 1]);
    });

    it('should take the row away when another row is opened', () => {
      const fixture = render([command()], { adding: true });

      rows(fixture)[1].click();
      fixture.detectChanges();

      expect([fixture.componentInstance.adding(), fixture.componentInstance.editing()])
        .toEqual([false, 'hug']);
    });

    // It is what is being typed, not something being looked for.
    it('should keep the row while a search hides everything else', () => {
      const fixture = render([command()], { adding: true });

      search(fixture, 'nothing matches this');

      expect(rows(fixture).length).toBe(1);
      expect(rows(fixture)[0].querySelector('.command-table-placeholder')).not.toBeNull();
    });

    // It has no name to sort on, and should not jump around while it is being filled in.
    it('should stay at the top when the table is sorted', () => {
      const fixture = render([command({ name: 'aaa' }), command({ name: 'zzz' })], { adding: true });

      element(fixture).querySelector<HTMLElement>('.mat-sort-header')!.click();
      fixture.detectChanges();
      element(fixture).querySelector<HTMLElement>('.mat-sort-header')!.click();
      fixture.detectChanges();

      expect(rows(fixture)[0].querySelector('.command-table-placeholder')).not.toBeNull();
      expect(names(fixture)).toEqual(['zzz', 'aaa']);
    });
  });

  it('should ask to delete a command when its delete button is pressed', () => {
    const fixture = render([command()]);
    const asked: CustomCommand[] = [];
    fixture.componentInstance.remove.subscribe((entry: CustomCommand) => asked.push(entry));

    element(fixture).querySelector<HTMLButtonElement>('.command-table-delete')!.click();
    fixture.detectChanges();

    expect([asked.map((entry) => entry.name), fixture.componentInstance.editing()]).toEqual([['hug'], null]);
  });

  // Flipping the switch must not also open the form behind it.
  it('should report a flipped switch without opening the form', () => {
    const fixture = render([command()]);
    const flipped: CommandActiveChange[] = [];
    fixture.componentInstance.setActive.subscribe((change: CommandActiveChange) => flipped.push(change));

    element(fixture).querySelector<HTMLElement>('mat-slide-toggle button[role="switch"]')!.click();
    fixture.detectChanges();

    expect(flipped.map((change) => [change.command.name, change.active])).toEqual([['hug', false]]);
    expect(fixture.componentInstance.editing()).toBeNull();
  });

  it('should not offer its controls while a write is in flight', () => {
    const fixture = render([command()], { busy: true });

    const disabled = [...element(fixture).querySelectorAll<HTMLButtonElement>('.command-table-edit, .command-table-actions button')]
      .map((button) => button.disabled);

    expect(disabled).toEqual([true, true, true]);
  });

  it('should show the chevron pointing the way the row will move', () => {
    const fixture = render([command()]);
    expect(chevrons(fixture)[0].textContent!.trim()).toBe('expand_more');

    fixture.componentRef.setInput('editing', 'hug');
    fixture.detectChanges();

    expect(chevrons(fixture)[0].textContent!.trim()).toBe('expand_less');
  });

  it('should filter on the name', () => {
    const fixture = render([command(), command({ name: 'lurk', aliases: [], message: 'bye' })]);

    search(fixture, 'lurk');

    expect(names(fixture)).toEqual(['lurk']);
  });

  // Searching for a word should find the command that answers to it, whichever trigger it is.
  it('should filter on an alias', () => {
    const fixture = render([command(), command({ name: 'lurk', aliases: [], message: 'bye' })]);

    search(fixture, 'cuddle');

    expect(names(fixture)).toEqual(['hug']);
  });

  it('should filter on the reply', () => {
    const fixture = render([command(), command({ name: 'lurk', aliases: [], message: 'bye' })]);

    search(fixture, 'bye');

    expect(names(fixture)).toEqual(['lurk']);
  });

  it('should name the search that found nothing', () => {
    const fixture = render([command()]);

    search(fixture, 'nothing');

    expect(emptyText(fixture)).toContain('No command matches “nothing”');
  });

  it('should invite a first command when the channel has none', () => {
    expect(emptyText(render([]))).toContain('No commands yet');
  });

  it('should say it is still loading rather than that there is nothing', () => {
    expect(emptyText(render([], { loading: true }))).toContain('Loading your commands');
  });

  it('should say the list could not be loaded when the request failed', () => {
    expect(emptyText(render([], { unreachable: true }))).toContain('Could not load your commands');
  });

  it('should redraw when the commands change', () => {
    const fixture = render([command()]);

    fixture.componentRef.setInput('commands', [command({ name: 'lurk' })]);
    fixture.detectChanges();

    expect(names(fixture)).toEqual(['lurk']);
  });
});
