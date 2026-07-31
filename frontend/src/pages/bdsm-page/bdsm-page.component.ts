import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { BdsmService } from '../../services/bdsm.service';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { BdsmResult, resultTakenAt } from '../../data/bdsm-result';
import { TwitchUser } from '../../data/twitch-user';

/** One panel: the result, plus the date its header shows and sorts on. */
export interface BdsmResultEntry {
  result: BdsmResult;
  takenAt: Date;
}

/** A community panel, which belongs to somebody the reader has to be told apart from the rest. */
export interface BdsmCommunityEntry extends BdsmResultEntry {

  // Null when Twitch no longer resolves the id — a deleted or renamed account still has a row in
  // YEPPBot's table, and dropping it would silently shorten the list.
  user: TwitchUser | null;
  name: string;
}

const OWN_TAB = 0;
const COMMUNITY_TAB = 1;

@Component({
  selector: 'app-bdsm-page',
  templateUrl: './bdsm-page.component.html',
  styleUrl: './bdsm-page.component.scss',
  standalone: false,
})
export class BdsmPageComponent {

  private readonly bdsm: BdsmService = inject(BdsmService);
  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);

  private readonly ownRows: WritableSignal<BdsmResultEntry[]> = signal<BdsmResultEntry[]>([]);
  private readonly ownLoading: WritableSignal<boolean> = signal(false);
  private readonly ownFailed: WritableSignal<boolean> = signal(false);

  private readonly communityRows: WritableSignal<BdsmCommunityEntry[]> = signal<BdsmCommunityEntry[]>([]);
  private readonly communityLoading: WritableSignal<boolean> = signal(false);
  private readonly communityFailed: WritableSignal<boolean> = signal(false);

  // The community list costs a follow check per stored result, so it is only fetched once somebody
  // asks to see it rather than alongside the tab that opens by default.
  private communityRequested = false;

  protected readonly selected: WritableSignal<number> = signal(OWN_TAB);

  protected readonly entries: Signal<BdsmResultEntry[]> = this.ownRows.asReadonly();
  protected readonly community: Signal<BdsmCommunityEntry[]> = this.communityRows.asReadonly();

  protected readonly count: Signal<number> = computed((): number => this.ownRows().length);
  protected readonly communityCount: Signal<number> = computed((): number => this.communityRows().length);

  protected readonly unreachable: Signal<boolean> = this.ownFailed.asReadonly();
  protected readonly communityUnreachable: Signal<boolean> = this.communityFailed.asReadonly();

  // The toolbar above the tabs acts on whichever one is open, so both the spinner and the refresh
  // button follow the selection rather than either list on its own.
  protected readonly loading: Signal<boolean> = computed((): boolean =>
    this.selected() === COMMUNITY_TAB ? this.communityLoading() : this.ownLoading());

  constructor() {
    void this.load();
  }

  protected select(index: number): void {
    this.selected.set(index);

    if (index === COMMUNITY_TAB && !this.communityRequested) void this.loadCommunity();
  }

  protected reload(): Promise<void> {
    return this.selected() === COMMUNITY_TAB ? this.loadCommunity() : this.load();
  }

  private async load(): Promise<void> {
    const userId: string | undefined = this.auth.currentUser()?.id;
    if (!userId) return;

    this.ownLoading.set(true);
    this.ownFailed.set(false);
    try {
      const results: BdsmResult[] = await this.bdsm.getResults(userId);

      this.ownRows.set(results
        .map((result: BdsmResult): BdsmResultEntry => ({ result, takenAt: resultTakenAt(result) }))
        // The endpoint already answers newest first. Sorted again here because "the newest one is at
        // the top, open" is this page's own promise, and it should not rest on the order a response
        // happened to arrive in.
        .sort((left, right) => right.takenAt.getTime() - left.takenAt.getTime()));
    } catch {
      this.ownRows.set([]);
      this.ownFailed.set(true);
      this.notifications.failure('Could not load your BDSM test results.');
    } finally {
      this.ownLoading.set(false);
    }
  }

  private async loadCommunity(): Promise<void> {
    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    // Marked before the request rather than after it, so opening the tab twice in quick succession
    // cannot start the walk twice.
    this.communityRequested = true;

    this.communityLoading.set(true);
    this.communityFailed.set(false);
    try {
      const results: BdsmResult[] = await this.bdsm.getFollowerResults(channelId);

      // The endpoint answers with ids and scores only, so the names come from a second lookup — the
      // same split the follower birthdays use.
      const users: TwitchUser[] = await this.twitch.getUsers(results.map((entry) => entry.userId));
      const byId: Map<string, TwitchUser> = new Map(users.map((user) => [user.id, user]));

      this.communityRows.set(results
        .map((result: BdsmResult): BdsmCommunityEntry => {
          const user: TwitchUser | undefined = byId.get(result.userId);

          return {
            result,
            takenAt: resultTakenAt(result),
            user: user ?? null,
            name: user?.displayName ?? result.userId,
          };
        })
        .sort((left, right) => right.takenAt.getTime() - left.takenAt.getTime()));
    } catch {
      this.communityRows.set([]);
      this.communityFailed.set(true);
      this.communityRequested = false;
      this.notifications.failure('Could not load the BDSM test results of your followers.');
    } finally {
      this.communityLoading.set(false);
    }
  }
}
