import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal, Signal, WritableSignal } from '@angular/core';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { ScrollBarComponent } from '../scroll-bar-component/scroll-bar.component';
import { isDashHost } from '../../services/dash-host';
import {
  boxArtUrl, BROADCAST_LANGUAGES, CategoryPage, ChannelCategory, ChannelInformation, ChannelUpdate,
  CONTENT_LABELS, ContentClassificationLabel, DELAY_MAX_SECONDS, delayText, isScopeRequired,
  cleanTag, isValidTag, sameLabels, sameTags, settableLabels, TAG_MAX_COUNT, TAG_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '../../data/channel';

export interface ManageBroadcastData {
  channel: ChannelInformation;

  // Passed in rather than looked up again: the page already resolved the cover for the category that
  // is set, and Get Channel Information does not carry one.
  game: ChannelCategory | null;
}

const DEBOUNCE_MS: number = 250;

// How close to the bottom of the dropdown counts as "at the end", in pixels. Generous enough that
// the next page is on its way before the last row is reached.
const LOAD_MORE_MARGIN: number = 48;

@Component({
  selector: 'app-manage-broadcast-dialog',
  templateUrl: './manage-broadcast-dialog.component.html',
  styleUrl: './manage-broadcast-dialog.component.scss',
  imports: [NgOptimizedImage, MatAutocompleteModule, MatButtonModule, MatChipsModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatSlideToggleModule, ScrollBarComponent],
})
export class ManageBroadcastDialogComponent {

  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly document: Document = inject(DOCUMENT);

  private readonly dialogRef: MatDialogRef<ManageBroadcastDialogComponent, ChannelInformation> =
    inject<MatDialogRef<ManageBroadcastDialogComponent, ChannelInformation>>(MatDialogRef);

  private readonly data: ManageBroadcastData = inject<ManageBroadcastData>(MAT_DIALOG_DATA);

  private debounce: ReturnType<typeof setTimeout> | null = null;

  // Every search carries a number, and an answer whose number is no longer the current one is
  // dropped. Without it a slow reply to an earlier keystroke can land after a fast reply to a later
  // one and leave the list showing results for a word nobody typed any more.
  private run: number = 0;

  private panelScroll: (() => void) | null = null;

  protected readonly busy: WritableSignal<boolean> = signal(false);

  protected readonly title: WritableSignal<string>;
  protected readonly game: WritableSignal<ChannelCategory | null>;
  protected readonly tags: WritableSignal<string[]>;
  protected readonly branded: WritableSignal<boolean>;
  protected readonly language: WritableSignal<string>;
  protected readonly delay: WritableSignal<number>;
  protected readonly labels: WritableSignal<string[]>;

  protected readonly query: WritableSignal<string>;
  protected readonly results: WritableSignal<ChannelCategory[]> = signal<ChannelCategory[]>([]);
  protected readonly searching: WritableSignal<boolean> = signal(false);

  private readonly cursor: WritableSignal<string | null> = signal<string | null>(null);

  // What has been typed into the language box, which filters the list rather than searching
  // anything: all of Twitch's stream languages fit in the bundle, so there is nothing to ask for.
  protected readonly languageQuery: WritableSignal<string> = signal('');

  // What is being typed into the tag box, before it becomes a chip. Held here rather than read off
  // the input so the add button and the Enter key work from the same value.
  protected readonly tagDraft: WritableSignal<string> = signal('');

  // Set only when a save came back as 403 with the missing-scope marker.
  protected readonly reconnect: WritableSignal<string | null> = signal<string | null>(null);

  protected readonly maxLength: number = TITLE_MAX_LENGTH;
  protected readonly tagLimit: number = TAG_MAX_COUNT;
  protected readonly tagLength: number = TAG_MAX_LENGTH;
  protected readonly delayMax: number = DELAY_MAX_SECONDS;
  protected readonly contentLabels: readonly { id: string; label: string; hint: string }[] = CONTENT_LABELS;

  // Back to the dashboard, which is where the broadcast card lives now.
  protected readonly loginUrl: string = this.auth.loginUrl(isDashHost() ? '/' : '/dash');

  // Twitch refuses a delay from anyone who is not a partner, so it is not offered to them.
  protected readonly partner: Signal<boolean> = computed((): boolean =>
    this.auth.currentUser()?.broadcasterType === 'partner');

  protected readonly delayHint: Signal<string> = computed((): string => delayText(this.delay()));

  protected readonly languages: Signal<readonly { code: string; name: string }[]> = computed(() => {
    const term: string = this.languageQuery().trim().toLowerCase();
    if (!term) return BROADCAST_LANGUAGES;

    const matches: readonly { code: string; name: string }[] = BROADCAST_LANGUAGES.filter((option): boolean =>
      option.name.toLowerCase().includes(term) || option.code.toLowerCase() === term);

    // A language Twitch does not carry is not a dead end — "other" is the answer it defines for
    // exactly that case, so a search with no match offers it rather than nothing.
    return matches.length > 0
      ? matches
      : BROADCAST_LANGUAGES.filter((option): boolean => option.code === 'other');
  });

  // The names behind the ids, for the closed multi-select. Without a trigger of its own it would
  // read out the raw ids, which are Twitch's spelling and not anybody's words.
  //
  // No empty case: Material only renders a custom trigger once something is selected, so with an
  // empty list the field falls back to its own label and this is never asked.
  protected readonly labelSummary: Signal<string> = computed((): string => {
    const chosen: string[] = this.labels();

    return CONTENT_LABELS
      .filter((label): boolean => chosen.includes(label.id))
      .map((label): string => label.label)
      .join(', ');
  });

  protected readonly tooLong: Signal<boolean> = computed((): boolean => this.title().length > TITLE_MAX_LENGTH);

  protected readonly changed: Signal<boolean> = computed((): boolean => {
    const channel: ChannelInformation = this.data.channel;

    return this.title() !== channel.title
      || (this.game()?.id ?? '') !== channel.gameId
      || !sameTags(this.tags(), channel.tags)
      || this.branded() !== channel.isBrandedContent
      || this.language() !== channel.broadcasterLanguage
      || this.delay() !== channel.delay
      // Compared against the settable ones only: a label Twitch applies itself is never part of
      // what this dialog is offering to change.
      || !sameLabels(this.labels(), settableLabels(channel.contentClassificationLabels));
  });

  protected readonly canSave: Signal<boolean> = computed((): boolean =>
    this.changed() && !this.tooLong() && this.title().trim().length > 0 && !this.busy());

  protected readonly more: Signal<boolean> = computed((): boolean => this.cursor() !== null);

  protected readonly canAddTag: Signal<boolean> = computed((): boolean => {
    const draft: string = this.tagDraft().trim();

    return isValidTag(draft)
      && this.tags().length < TAG_MAX_COUNT
      && !this.tags().some((tag: string): boolean => tag.toLowerCase() === draft.toLowerCase());
  });

  constructor() {
    const channel: ChannelInformation = this.data.channel;

    this.title = signal(channel.title);
    this.game = signal(this.data.game);
    this.tags = signal([...channel.tags]);
    this.branded = signal(channel.isBrandedContent);
    this.language = signal(channel.broadcasterLanguage || 'en');
    this.delay = signal(channel.delay);
    this.labels = signal(settableLabels(channel.contentClassificationLabels));
    this.query = signal(channel.gameName);

    this.destroyRef.onDestroy((): void => {
      if (this.debounce !== null) clearTimeout(this.debounce);
      this.detach();
    });
  }

  static open(dialog: MatDialog, data: ManageBroadcastData): MatDialogRef<ManageBroadcastDialogComponent, ChannelInformation> {
    return dialog.open<ManageBroadcastDialogComponent, ManageBroadcastData, ChannelInformation>(
      ManageBroadcastDialogComponent,
      {
        data,
        width: '44rem',
        maxWidth: '94vw',
        maxHeight: '92vh',
      });
  }

  // --- the game search ---------------------------------------------------------------------

  protected retype(value: string): void {
    this.query.set(value);

    if (this.debounce !== null) clearTimeout(this.debounce);

    const term: string = value.trim();
    if (!term) {
      this.results.set([]);
      this.cursor.set(null);
      this.searching.set(false);
      return;
    }

    // Marked as searching for the length of the debounce as well, not just the request. Otherwise
    // the panel spends those 250ms claiming it found nothing, which is a different statement from
    // "has not looked yet".
    this.searching.set(true);
    this.debounce = setTimeout((): void => void this.search(term), DEBOUNCE_MS);
  }

  // What the input shows once an option is chosen. Without it the trigger writes String(value) into
  // the field, and the value is a category object.
  // An arrow property rather than a method, because Material calls it detached from the component.
  protected readonly gameName = (value: ChannelCategory | string | null): string => {
    if (value === null) return '';
    return typeof value === 'string' ? value : value.name;
  };

  protected pick(event: MatAutocompleteSelectedEvent): void {
    const category: ChannelCategory = event.option.value as ChannelCategory;

    this.game.set(category);
    this.query.set(category.name);
  }

  protected clearGame(): void {
    this.game.set(null);
    this.query.set('');
    this.results.set([]);
    this.cursor.set(null);
  }

  // Listens on the document during the capture phase rather than on the panel itself. The panel is
  // the obvious place, but MatAutocomplete only fills in its `panel` reference once its own change
  // detection has run, and `opened` fires before that — measured: the reference is undefined in
  // that handler. Scroll events do not bubble, but they do capture, so one listener on the document
  // sees the panel's scrolling without needing a reference to it.
  protected attach(): void {
    this.detach();

    const onScroll: (event: Event) => void = (event: Event): void => {
      const panel: HTMLElement | null = (event.target as HTMLElement | null)?.closest?.('.mat-mdc-autocomplete-panel') ?? null;
      if (panel === null) return;

      if (panel.scrollTop + panel.clientHeight < panel.scrollHeight - LOAD_MORE_MARGIN) return;
      void this.loadMore();
    };

    this.document.addEventListener('scroll', onScroll, true);
    this.panelScroll = (): void => this.document.removeEventListener('scroll', onScroll, true);
  }

  protected detach(): void {
    this.panelScroll?.();
    this.panelScroll = null;
  }

  protected art(category: ChannelCategory, width: number, height: number): string {
    return boxArtUrl(category.boxArtUrl, width, height);
  }

  // --- the rest of the form ----------------------------------------------------------------

  // Refuses the keystroke outright, before the character is in the field. `input` fires after the
  // insertion, so filtering there let a space appear and vanish again a frame later; `beforeinput`
  // is cancelable, so nothing is ever shown.
  //
  // Only single-character insertions are blocked this way. A paste is left to go through and is
  // cleaned by the handler below instead: refusing the whole paste because one character in it is
  // wrong would throw away the rest of what somebody meant to put in.
  protected blockTag(event: InputEvent): void {
    if (event.inputType !== 'insertText') return;

    const typed: string = event.data ?? '';
    if (typed && cleanTag(typed) !== typed) event.preventDefault();
  }

  // The net under the above: paste, drag-and-drop and composed input all arrive here, where what
  // did land in the field is cleaned.
  protected retypeTag(value: string): void {
    this.tagDraft.set(cleanTag(value));
  }

  // The box holds one tag at a time and the field's own maxlength keeps it inside Twitch's 25
  // characters, so there is nothing to split and nothing to truncate here — only the duplicate and
  // the count to refuse.
  protected addTag(): void {
    if (!this.canAddTag()) return;

    const tag: string = this.tagDraft().trim();

    this.tags.update((tags: string[]): string[] => [...tags, tag]);
    this.tagDraft.set('');
  }

  protected removeTag(tag: string): void {
    this.tags.update((tags: string[]): string[] => tags.filter((other: string): boolean => other !== tag));
  }

  protected setDelay(value: string): void {
    const seconds: number = Number(value);
    if (!Number.isFinite(seconds)) return;

    this.delay.set(Math.max(0, Math.min(Math.round(seconds), DELAY_MAX_SECONDS)));
  }

  protected retypeLanguage(value: string): void {
    this.languageQuery.set(value);
  }

  protected pickLanguage(event: MatAutocompleteSelectedEvent): void {
    this.language.set(event.option.value as string);
    this.languageQuery.set('');
  }

  // Shown in the language box: the name for whatever code is chosen, so the field reads as a
  // selection rather than as leftover search text.
  protected readonly languageLabel = (code: string | null): string => {
    if (!code) return '';
    return BROADCAST_LANGUAGES.find((option): boolean => option.code === code)?.name ?? code;
  };

  protected async save(): Promise<void> {
    if (!this.canSave()) return;

    const channel: ChannelInformation = this.data.channel;
    const gameId: string = this.game()?.id ?? '';

    // Only what actually changed. A field left out is left alone; a game cleared is an empty string,
    // because leaving it out would mean "keep the old one".
    const update: ChannelUpdate = {};
    if (this.title() !== channel.title) update.title = this.title();
    if (gameId !== channel.gameId) update.gameId = gameId;
    if (!sameTags(this.tags(), channel.tags)) update.tags = this.tags();
    if (this.branded() !== channel.isBrandedContent) update.isBrandedContent = this.branded();
    if (this.language() !== channel.broadcasterLanguage) update.broadcasterLanguage = this.language();

    // Only a partner can set this, so for everyone else it is never part of the change.
    if (this.partner() && this.delay() !== channel.delay) update.delay = this.delay();

    // Every label goes, not just the ones switched on: turning one off is only expressible by
    // naming it with is_enabled false, so a list of the enabled ones would silently keep the rest.
    if (!sameLabels(this.labels(), settableLabels(channel.contentClassificationLabels))) {
      update.contentClassificationLabels = CONTENT_LABELS.map((label): ContentClassificationLabel =>
        ({ id: label.id, isEnabled: this.labels().includes(label.id) }));
    }

    this.busy.set(true);

    try {
      await this.twitch.updateChannel(update);

      // Read back rather than assumed: the endpoint answers 204 with no body, and Twitch quietly
      // keeps the old value for a language it does not carry.
      const saved: ChannelInformation = await this.twitch.getChannel();

      this.notifications.success('Channel updated.');
      this.dialogRef.close(saved);
    } catch (error: unknown) {
      if (isScopeRequired(error)) {
        this.reconnect.set(error.error.message);
      } else if (update.tags !== undefined) {
        // Tags are the one field Twitch judges rather than validates, so when they were part of the
        // change they are the likeliest thing it objected to — said as a suspicion, not a verdict.
        this.notifications.failure('Twitch would not take that change — one of the tags may have failed its review.');
      } else {
        this.notifications.failure('Twitch would not take that change.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  private async search(term: string): Promise<void> {
    const mine: number = ++this.run;

    this.searching.set(true);
    this.cursor.set(null);

    try {
      const page: CategoryPage = await this.twitch.searchCategories(term);
      if (mine !== this.run) return;

      this.results.set(page.items);
      this.cursor.set(page.cursor);
    } catch {
      if (mine === this.run) this.results.set([]);
    } finally {
      if (mine === this.run) this.searching.set(false);
    }
  }

  private async loadMore(): Promise<void> {
    const cursor: string | null = this.cursor();
    if (cursor === null || this.searching()) return;

    const mine: number = this.run;
    const term: string = this.query().trim();
    if (!term) return;

    this.searching.set(true);

    try {
      const page: CategoryPage = await this.twitch.searchCategories(term, cursor);

      // A page that arrived after the search term moved on belongs to the previous word.
      if (mine !== this.run) return;

      this.results.update((results: ChannelCategory[]): ChannelCategory[] => [...results, ...page.items]);
      this.cursor.set(page.cursor);
    } catch {
      // Stop paging rather than asking for the same cursor on every further scroll event.
      if (mine === this.run) this.cursor.set(null);
    } finally {
      if (mine === this.run) this.searching.set(false);
    }
  }
}
