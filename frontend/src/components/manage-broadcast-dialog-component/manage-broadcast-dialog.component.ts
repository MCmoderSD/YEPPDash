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
import {
  boxArtUrl, BROADCAST_LANGUAGES, CategoryPage, ChannelCategory, ChannelInformation, ChannelUpdate,
  CONTENT_LABELS, ContentClassificationLabel, DELAY_MAX_SECONDS, delayText,
  cleanTag, isValidTag, sameLabels, sameTags, settableLabels, TAG_MAX_COUNT, TAG_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '../../data/channel';

export interface ManageBroadcastData {
  channel: ChannelInformation;
  game: ChannelCategory | null;
}

const DEBOUNCE_MS: number = 250;
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

  protected readonly languageQuery: WritableSignal<string> = signal('');

  protected readonly tagDraft: WritableSignal<string> = signal('');

  protected readonly maxLength: number = TITLE_MAX_LENGTH;
  protected readonly tagLimit: number = TAG_MAX_COUNT;
  protected readonly tagLength: number = TAG_MAX_LENGTH;
  protected readonly delayMax: number = DELAY_MAX_SECONDS;
  protected readonly contentLabels: readonly { id: string; label: string; hint: string }[] = CONTENT_LABELS;

  protected readonly partner: Signal<boolean> = computed((): boolean => this.auth.currentUser()?.broadcasterType === 'partner');

  protected readonly delayHint: Signal<string> = computed((): string => delayText(this.delay()));

  protected readonly languages: Signal<readonly { code: string; name: string }[]> = computed((): readonly { code: string; name: string }[] => {
    const term: string = this.languageQuery().trim().toLowerCase();
    if (!term) return BROADCAST_LANGUAGES;

    const matches: readonly { code: string; name: string }[] = BROADCAST_LANGUAGES.filter((option: { code: string; name: string }): boolean => option.name.toLowerCase().includes(term) || option.code.toLowerCase() === term);

    return matches.length > 0
      ? matches
      : BROADCAST_LANGUAGES.filter((option: { code: string; name: string }): boolean => option.code === 'other');
  });

  protected readonly labelSummary: Signal<string> = computed((): string => {
    const chosen: string[] = this.labels();

    return CONTENT_LABELS
      .filter((label: { id: string; label: string; hint: string }): boolean => chosen.includes(label.id))
      .map((label: { id: string; label: string; hint: string }): string => label.label)
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
      || !sameLabels(this.labels(), settableLabels(channel.contentClassificationLabels));
  });

  protected readonly canSave: Signal<boolean> = computed((): boolean => this.changed() && !this.tooLong() && this.title().trim().length > 0 && !this.busy());

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

    this.searching.set(true);
    this.debounce = setTimeout((): void => void this.search(term), DEBOUNCE_MS);
  }

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

  protected art(category: ChannelCategory): string {
    return boxArtUrl(category.boxArtUrl);
  }

  protected blockTag(event: InputEvent): void {
    if (event.inputType !== 'insertText') return;

    const typed: string = event.data ?? '';
    if (typed && cleanTag(typed) !== typed) event.preventDefault();
  }

  protected retypeTag(value: string): void {
    this.tagDraft.set(cleanTag(value));
  }

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

  protected readonly languageLabel: (code: string | null) => string = (code: string | null): string => {
    if (!code) return '';
    return BROADCAST_LANGUAGES.find((option: { code: string; name: string }): boolean => option.code === code)?.name ?? code;
  };

  protected async save(): Promise<void> {
    if (!this.canSave()) return;

    const channel: ChannelInformation = this.data.channel;
    const gameId: string = this.game()?.id ?? '';

    const update: ChannelUpdate = {};
    if (this.title() !== channel.title) update.title = this.title();
    if (gameId !== channel.gameId) update.gameId = gameId;
    if (!sameTags(this.tags(), channel.tags)) update.tags = this.tags();
    if (this.branded() !== channel.isBrandedContent) update.isBrandedContent = this.branded();
    if (this.language() !== channel.broadcasterLanguage) update.broadcasterLanguage = this.language();
    if (this.partner() && this.delay() !== channel.delay) update.delay = this.delay();

    if (!sameLabels(this.labels(), settableLabels(channel.contentClassificationLabels))) {
      update.contentClassificationLabels = CONTENT_LABELS.map((label): ContentClassificationLabel =>
        ({ id: label.id, isEnabled: this.labels().includes(label.id) }));
    }

    this.busy.set(true);

    try {
      await this.twitch.updateChannel(update);

      const saved: ChannelInformation = await this.twitch.getChannel();

      this.notifications.success('Channel updated.');
      this.dialogRef.close(saved);
    } catch {
      if (update.tags !== undefined) {
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

      if (mine !== this.run) return;

      this.results.update((results: ChannelCategory[]): ChannelCategory[] => [...results, ...page.items]);
      this.cursor.set(page.cursor);
    } catch {
      if (mine === this.run) this.cursor.set(null);
    } finally {
      if (mine === this.run) this.searching.set(false);
    }
  }
}
