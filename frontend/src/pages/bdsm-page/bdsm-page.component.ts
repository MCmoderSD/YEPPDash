import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { BdsmService } from '../../services/bdsm.service';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { BdsmResult, resultTakenAt } from '../../data/bdsm-result';
import { TwitchUser } from '../../data/twitch-user';

export interface BdsmResultEntry {
  result: BdsmResult;
  takenAt: Date;
}

export interface BdsmCommunityEntry extends BdsmResultEntry {
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


  private communityRequested = false;

  protected readonly selected: WritableSignal<number> = signal(OWN_TAB);

  protected readonly entries: Signal<BdsmResultEntry[]> = this.ownRows.asReadonly();
  protected readonly community: Signal<BdsmCommunityEntry[]> = this.communityRows.asReadonly();

  protected readonly count: Signal<number> = computed((): number => this.ownRows().length);
  protected readonly communityCount: Signal<number> = computed((): number => this.communityRows().length);

  protected readonly unreachable: Signal<boolean> = this.ownFailed.asReadonly();
  protected readonly communityUnreachable: Signal<boolean> = this.communityFailed.asReadonly();


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
        .sort((left: BdsmResultEntry, right: BdsmResultEntry): number => right.takenAt.getTime() - left.takenAt.getTime()));
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

    this.communityRequested = true;

    this.communityLoading.set(true);
    this.communityFailed.set(false);
    try {
      const results: BdsmResult[] = await this.bdsm.getFollowerResults(channelId);

      const users: TwitchUser[] = await this.twitch.getUsers(results.map((entry: BdsmResult): string => entry.userId));
      const byId: Map<string, TwitchUser> = new Map(users.map((user: TwitchUser): [string, TwitchUser] => [user.id, user]));

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
        .sort((left: BdsmCommunityEntry, right: BdsmCommunityEntry): number => right.takenAt.getTime() - left.takenAt.getTime()));
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
