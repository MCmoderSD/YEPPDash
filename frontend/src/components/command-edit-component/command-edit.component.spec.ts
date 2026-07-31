import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { ENTER } from '@angular/cdk/keycodes';
import { DashModule } from '../../pages/dash.module';
import { CommandEditComponent } from './command-edit.component';
import {
  CommandResponseType,
  CommandUserLevel,
  CustomCommand,
  CustomCommandDraft,
} from '../../data/custom-command';

const EXISTING: CustomCommand = {
  name: 'hug',
  aliases: ['cuddle'],
  message: 'YEPP hugs you',
  active: true,
  responseType: CommandResponseType.Reply,
  userLevel: CommandUserLevel.Everyone,
};

describe('CommandEditComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashModule, RouterModule.forRoot([])],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()],
    }).compileComponents();
  });

  function render(
    command: CustomCommand | null,
    taken: string[] = [],
  ): ComponentFixture<CommandEditComponent> {
    const fixture = TestBed.createComponent(CommandEditComponent);

    fixture.componentRef.setInput('command', command);
    fixture.componentRef.setInput('taken', taken);
    fixture.detectChanges();

    return fixture;
  }

  function element(fixture: ComponentFixture<CommandEditComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function saveButton(fixture: ComponentFixture<CommandEditComponent>): HTMLButtonElement {
    return element(fixture).querySelector<HTMLButtonElement>('button[type="submit"]')!;
  }

  function cancelButton(fixture: ComponentFixture<CommandEditComponent>): HTMLButtonElement {
    return [...element(fixture).querySelectorAll('button')]
      .find((button) => button.textContent!.trim() === 'Cancel') as HTMLButtonElement;
  }

  function nameField(fixture: ComponentFixture<CommandEditComponent>): HTMLInputElement {
    return element(fixture).querySelector<HTMLInputElement>('input[matInput]')!;
  }

  function type(
    fixture: ComponentFixture<CommandEditComponent>,
    field: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ): void {
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function typeName(fixture: ComponentFixture<CommandEditComponent>, value: string): void {
    type(fixture, nameField(fixture), value);
  }

  function typeMessage(fixture: ComponentFixture<CommandEditComponent>, value: string): void {
    type(fixture, element(fixture).querySelector('textarea')!, value);
  }

  // The chip input adds on Enter, which is what somebody filling the field in actually presses.
  // matChipInputFor is a binding rather than a static attribute, so the class the directive adds is
  // what there is to select on.
  function addAlias(fixture: ComponentFixture<CommandEditComponent>, value: string): void {
    const field = element(fixture).querySelector<HTMLInputElement>('input.mat-mdc-chip-input')!;

    field.value = value;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: ENTER, bubbles: true }));
    fixture.detectChanges();
  }

  function chips(fixture: ComponentFixture<CommandEditComponent>): string[] {
    return [...element(fixture).querySelectorAll('mat-chip-row')]
      .map((chip) => chip.textContent!.trim().replace(/cancel$/, '').trim());
  }

  function error(fixture: ComponentFixture<CommandEditComponent>): string | null {
    return element(fixture).querySelector('.command-edit-error')?.textContent?.trim() ?? null;
  }

  // The two pickers, in the order they are laid out: response type, then user level.
  function selects(fixture: ComponentFixture<CommandEditComponent>): HTMLElement[] {
    return [...element(fixture).querySelectorAll<HTMLElement>('mat-select')];
  }

  // mat-select works out which option is selected in a microtask, so what it shows is only settled
  // a turn after the form is drawn.
  async function shown(fixture: ComponentFixture<CommandEditComponent>, index: number): Promise<string> {
    await fixture.whenStable();
    fixture.detectChanges();

    return selects(fixture)[index].querySelector('.mat-mdc-select-value-text')?.textContent?.trim() ?? '';
  }

  function options(fixture: ComponentFixture<CommandEditComponent>, index: number): string[] {
    selects(fixture)[index].querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
    fixture.detectChanges();

    const shownOptions = [...document.querySelectorAll<HTMLElement>('.cdk-overlay-container mat-option')]
      .map((option) => option.textContent!.trim());

    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')?.click();
    fixture.detectChanges();

    return shownOptions;
  }

  function choose(fixture: ComponentFixture<CommandEditComponent>, index: number, label: string): void {
    selects(fixture)[index].querySelector<HTMLElement>('.mat-mdc-select-trigger')!.click();
    fixture.detectChanges();

    [...document.querySelectorAll<HTMLElement>('.cdk-overlay-container mat-option')]
      .find((option) => option.textContent!.trim() === label)!
      .click();
    fixture.detectChanges();
  }

  function saved(fixture: ComponentFixture<CommandEditComponent>): CustomCommandDraft[] {
    const drafts: CustomCommandDraft[] = [];
    fixture.componentInstance.save.subscribe((draft: CustomCommandDraft) => drafts.push(draft));

    return drafts;
  }

  it('should start empty when adding', () => {
    const fixture = render(null);

    expect([nameField(fixture).value, element(fixture).querySelector('textarea')!.value]).toEqual(['', '']);
    expect(chips(fixture)).toEqual([]);
  });

  it('should start from the existing command when editing', () => {
    const fixture = render(EXISTING);

    expect(nameField(fixture).value).toBe('hug');
    expect(element(fixture).querySelector('textarea')!.value).toBe('YEPP hugs you');
    expect(chips(fixture)).toEqual(['cuddle']);
  });

  // The prefix is not part of the name, so it is neither asked for nor shown anywhere.
  it('should not show a prefix on the name or the aliases', () => {
    const fixture = render(EXISTING);

    expect(element(fixture).textContent).not.toContain('!');
    expect(nameField(fixture).value).not.toContain('!');
  });

  describe('response type and user level', () => {
    it('should start a new command on the plainest of each', async () => {
      const fixture = render(null);

      expect([await shown(fixture, 0), await shown(fixture, 1)]).toEqual(['Reply', 'Everyone']);
    });

    it('should offer every response type', () => {
      expect(options(render(null), 0)).toEqual(['Reply', 'Mention', 'Say']);
    });

    // Spelled the way it is written rather than the way it is sent: the wire says "Vip".
    it('should offer every user level, VIP included', () => {
      expect(options(render(null), 1))
        .toEqual(['Everyone', 'Follower', 'VIP', 'Editor', 'Moderator', 'Broadcaster']);
    });

    it('should start from what the command was stored with', async () => {
      const fixture = render({ ...EXISTING, responseType: CommandResponseType.Say, userLevel: CommandUserLevel.Vip });

      expect([await shown(fixture, 0), await shown(fixture, 1)]).toEqual(['Say', 'VIP']);
    });

    it('should count picking a different response type as a change', () => {
      const fixture = render(EXISTING);

      choose(fixture, 0, 'Mention');

      expect(saveButton(fixture).disabled).toBe(false);
    });

    it('should count picking a different user level as a change', () => {
      const fixture = render(EXISTING);

      choose(fixture, 1, 'Moderator');

      expect(saveButton(fixture).disabled).toBe(false);
    });

    it('should save what was picked', () => {
      const fixture = render(null);
      const drafts = saved(fixture);

      typeName(fixture, 'hug');
      typeMessage(fixture, 'YEPP');
      choose(fixture, 0, 'Say');
      choose(fixture, 1, 'VIP');
      saveButton(fixture).click();

      expect(drafts).toEqual([{
        name: 'hug',
        aliases: [],
        message: 'YEPP',
        active: true,
        responseType: CommandResponseType.Say,
        userLevel: CommandUserLevel.Vip,
      }]);
    });
  });

  it('should offer to add rather than to save when there is no command yet', () => {
    expect(saveButton(render(null)).textContent!.trim()).toBe('Add command');
  });

  it('should offer to save when editing one', () => {
    expect(saveButton(render(EXISTING)).textContent!.trim()).toBe('Save');
  });

  it('should not allow saving without a name', () => {
    const fixture = render(null);

    typeMessage(fixture, 'Something');

    expect(saveButton(fixture).disabled).toBe(true);
  });

  it('should not allow saving without a message', () => {
    const fixture = render(null);

    typeName(fixture, 'hug');

    expect(saveButton(fixture).disabled).toBe(true);
  });

  it('should allow saving once both are filled in', () => {
    const fixture = render(null);

    typeName(fixture, 'hug');
    typeMessage(fixture, 'YEPP');

    expect(saveButton(fixture).disabled).toBe(false);
  });

  // The whole point of the dirty check: an untouched edit has nothing to send.
  it('should not allow saving an edit that changed nothing', () => {
    expect(saveButton(render(EXISTING)).disabled).toBe(true);
  });

  it('should allow saving once the message actually differs', () => {
    const fixture = render(EXISTING);

    typeMessage(fixture, 'Something else');

    expect(saveButton(fixture).disabled).toBe(false);
  });

  it('should not allow saving while a write is in flight', () => {
    const fixture = render(EXISTING);

    typeMessage(fixture, 'Something else');
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();

    expect(saveButton(fixture).disabled).toBe(true);
  });

  // A new command is switched on the moment it is added, so the form never asks about it.
  it('should add a new command already active, without offering a switch', () => {
    const fixture = render(null);
    const drafts = saved(fixture);

    expect(element(fixture).querySelector('mat-slide-toggle')).toBeNull();

    typeName(fixture, 'hug');
    typeMessage(fixture, 'YEPP');
    saveButton(fixture).click();

    expect(drafts).toEqual([{
      name: 'hug',
      aliases: [],
      message: 'YEPP',
      active: true,
      responseType: CommandResponseType.Reply,
      userLevel: CommandUserLevel.Everyone,
    }]);
  });

  // Editing leaves the switch in the row alone: that is the only thing that turns one off.
  it('should keep a switched-off command switched off when it is edited', () => {
    const fixture = render({ ...EXISTING, active: false });
    const drafts = saved(fixture);

    typeMessage(fixture, 'Rewritten');
    saveButton(fixture).click();

    expect(drafts[0].active).toBe(false);
  });

  // The table collates binary, so the case it is written in is the case it is looked up in. Typing
  // it in caps must not create a command chat cannot reach.
  it('should save the name in lower case', () => {
    const fixture = render(null);
    const drafts = saved(fixture);

    typeName(fixture, 'HuG');
    typeMessage(fixture, 'YEPP');
    saveButton(fixture).click();

    expect(drafts[0].name).toBe('hug');
  });

  it('should save the aliases in lower case', () => {
    const fixture = render(null);
    const drafts = saved(fixture);

    typeName(fixture, 'hug');
    addAlias(fixture, 'CudDle');
    typeMessage(fixture, 'YEPP');
    saveButton(fixture).click();

    expect(drafts[0].aliases).toEqual(['cuddle']);
  });

  // Never asked for, but somebody typing it out of habit should get a command that works.
  it('should strip a typed prefix off the name it saves', () => {
    const fixture = render(null);
    const drafts = saved(fixture);

    typeName(fixture, '!hug');
    typeMessage(fixture, '  YEPP  ');
    saveButton(fixture).click();

    expect(drafts).toEqual([{
      name: 'hug',
      aliases: [],
      message: 'YEPP',
      active: true,
      responseType: CommandResponseType.Reply,
      userLevel: CommandUserLevel.Everyone,
    }]);
  });

  // A space stops the command firing at all, since chat splits on those before it looks one up.
  it('should refuse a name with a space in it', () => {
    const fixture = render(null);

    typeName(fixture, 'group hug');
    typeMessage(fixture, 'YEPP');

    expect(error(fixture)).toBe('A command name can only contain letters and numbers.');
    expect(saveButton(fixture).disabled).toBe(true);
  });

  // A comma would split the one column a command's aliases share.
  it('should refuse a name with a comma in it', () => {
    const fixture = render(null);

    typeName(fixture, 'hug,cuddle');
    typeMessage(fixture, 'YEPP');

    expect(error(fixture)).toBe('A command name can only contain letters and numbers.');
    expect(saveButton(fixture).disabled).toBe(true);
  });

  it('should refuse a name with punctuation in it', () => {
    const fixture = render(null);

    typeName(fixture, 'hug-me');

    expect(error(fixture)).toBe('A command name can only contain letters and numbers.');
  });

  it('should allow digits in a name', () => {
    const fixture = render(null);

    typeName(fixture, 'hug2');
    typeMessage(fixture, 'YEPP');

    expect([error(fixture), saveButton(fixture).disabled]).toEqual([null, false]);
  });

  // Letters, not ASCII letters — a channel writing its commands in another script is fine.
  it('should allow letters outside ASCII in a name', () => {
    const fixture = render(null);

    typeName(fixture, 'küss');
    typeMessage(fixture, 'YEPP');

    expect([error(fixture), saveButton(fixture).disabled]).toEqual([null, false]);
  });

  // Caught while typing rather than as a 409 after Save.
  it('should refuse a name another command already answers to', () => {
    const fixture = render(null, ['hug', 'cuddle']);

    typeName(fixture, 'cuddle');
    typeMessage(fixture, 'YEPP');

    expect(error(fixture)).toBe('cuddle is already used by another command.');
    expect(saveButton(fixture).disabled).toBe(true);
  });

  // The name is folded to the case it is stored in before anything is compared, so the collision is
  // found and reported against that form.
  it('should ignore case when checking whether a name is taken', () => {
    const fixture = render(null, ['hug']);

    typeName(fixture, 'Hug');

    expect(error(fixture)).toBe('hug is already used by another command.');
  });

  it('should let a command keep its own name while editing', () => {
    const fixture = render(EXISTING, ['other']);

    typeMessage(fixture, 'Rewritten');

    expect(error(fixture)).toBeNull();
    expect(saveButton(fixture).disabled).toBe(false);
  });

  it('should say nothing about an empty name', () => {
    expect(error(render(null))).toBeNull();
  });

  it('should add an alias when one is entered', () => {
    const fixture = render(null);

    addAlias(fixture, 'cuddle');

    expect(chips(fixture)).toEqual(['cuddle']);
  });

  it('should strip the prefix off an entered alias', () => {
    const fixture = render(null);

    addAlias(fixture, '!cuddle');

    expect(chips(fixture)).toEqual(['cuddle']);
  });

  // The aliases are a set, so entering one twice adds it once.
  it('should not add the same alias twice', () => {
    const fixture = render(null);

    addAlias(fixture, 'cuddle');
    addAlias(fixture, 'CUDDLE');

    expect(chips(fixture)).toEqual(['cuddle']);
  });

  // An alias that repeats the name adds nothing — the name already fires the command.
  it('should not add an alias that repeats the name', () => {
    const fixture = render(null);

    typeName(fixture, 'hug');
    addAlias(fixture, 'hug');

    expect(chips(fixture)).toEqual([]);
  });

  // A trigger with a space in it could never fire, so two words mean two aliases.
  it('should split an entry with spaces into separate aliases', () => {
    const fixture = render(null);

    addAlias(fixture, 'cuddle snuggle');

    expect(chips(fixture)).toEqual(['cuddle', 'snuggle']);
  });

  it('should not add the same alias twice out of one entry', () => {
    const fixture = render(null);

    addAlias(fixture, 'cuddle CUDDLE');

    expect(chips(fixture)).toEqual(['cuddle']);
  });

  it('should drop the name out of a multi-word entry', () => {
    const fixture = render(null);

    typeName(fixture, 'hug');
    addAlias(fixture, 'hug cuddle');

    expect(chips(fixture)).toEqual(['cuddle']);
  });

  it('should ignore an empty alias', () => {
    const fixture = render(null);

    addAlias(fixture, '   ');

    expect(chips(fixture)).toEqual([]);
  });

  // A comma is the separator the alias column itself uses, so one typed here means "next alias"
  // rather than a character to keep.
  it('should split an entry on commas', () => {
    const fixture = render(null);

    addAlias(fixture, 'cuddle,snuggle, hugs');

    expect(chips(fixture)).toEqual(['cuddle', 'snuggle', 'hugs']);
  });

  it('should drop an alias that is not letters and numbers', () => {
    const fixture = render(null);

    addAlias(fixture, 'cuddle hug-me snuggle');

    expect(chips(fixture)).toEqual(['cuddle', 'snuggle']);
  });

  // All of a command's aliases share one 500 character column.
  it('should refuse aliases that together overflow their column', () => {
    const fixture = render(null);

    typeName(fixture, 'hug');
    typeMessage(fixture, 'YEPP');
    addAlias(fixture, `${'a'.repeat(200)} ${'b'.repeat(200)} ${'c'.repeat(200)}`);

    expect(element(fixture).querySelector('.command-edit-error')!.textContent!.trim())
      .toBe('The aliases together cannot be longer than 500 characters.');
    expect(saveButton(fixture).disabled).toBe(true);
  });

  it('should allow aliases that exactly fill their column', () => {
    const fixture = render(null);

    typeName(fixture, 'hug');
    typeMessage(fixture, 'YEPP');
    // 200 + 200 + 98 plus the two commas that join them is exactly 500.
    addAlias(fixture, `${'a'.repeat(200)} ${'b'.repeat(200)} ${'c'.repeat(98)}`);

    expect(saveButton(fixture).disabled).toBe(false);
  });

  it('should remove an alias when its chip is removed', () => {
    const fixture = render(EXISTING);

    element(fixture).querySelector<HTMLButtonElement>('button[matChipRemove]')!.click();
    fixture.detectChanges();

    expect(chips(fixture)).toEqual([]);
  });

  it('should save everything that was filled in', () => {
    const fixture = render(null);
    const drafts = saved(fixture);

    typeName(fixture, 'hug');
    addAlias(fixture, 'cuddle');
    addAlias(fixture, 'snuggle');
    typeMessage(fixture, 'YEPP');
    saveButton(fixture).click();

    expect(drafts).toEqual([{
      name: 'hug',
      aliases: ['cuddle', 'snuggle'],
      message: 'YEPP',
      active: true,
      responseType: CommandResponseType.Reply,
      userLevel: CommandUserLevel.Everyone,
    }]);
  });

  it('should ask to be closed when cancelled, saving nothing', () => {
    const fixture = render(null);
    const drafts = saved(fixture);
    let cancelled = 0;
    fixture.componentInstance.cancel.subscribe(() => cancelled++);

    typeName(fixture, 'hug');
    typeMessage(fixture, 'YEPP');
    cancelButton(fixture).click();

    expect([cancelled, drafts]).toEqual([1, []]);
  });

  // The fields are seeded from the input, so opening a different row has to reseed them rather than
  // leave what the row before it held.
  it('should reload its fields when a different command is put in', async () => {
    const fixture = render(EXISTING);

    fixture.componentRef.setInput('command', {
      name: 'lurk',
      aliases: [],
      message: 'bye',
      active: true,
      responseType: CommandResponseType.Say,
      userLevel: CommandUserLevel.Moderator,
    });
    fixture.detectChanges();

    expect([nameField(fixture).value, element(fixture).querySelector('textarea')!.value, chips(fixture)])
      .toEqual(['lurk', 'bye', []]);
    expect([await shown(fixture, 0), await shown(fixture, 1)]).toEqual(['Say', 'Moderator']);
  });

  it('should count the message characters as they are typed', () => {
    const fixture = render(null);

    typeMessage(fixture, '12345');

    expect(element(fixture).textContent).toContain('5 of 500');
  });
});
