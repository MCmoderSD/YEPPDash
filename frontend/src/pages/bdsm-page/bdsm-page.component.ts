import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { BusyBarComponent } from '../../components/busy-bar-component/busy-bar.component';
import { BdsmResultComponent } from '../../components/bdsm-result-component/bdsm-result.component';
import { UserBadgesComponent } from '../../components/user-badges-component/user-badges.component';
import { LocaleDatePipe } from '../../pipes/locale-date.pipe';
import { AuthService } from '../../services/auth.service';
import { BdsmService } from '../../services/bdsm.service';
import { NotificationService } from '../../services/notification.service';
import { TwitchService } from '../../services/twitch.service';
import { BdsmMatchScore, BdsmResult, resultTakenAt, traitColor } from '../../data/bdsm-result';
import { Broadcaster } from '../../data/broadcaster';
import { FollowerProfile } from '../../data/follower';
import { TwitchUser } from '../../data/twitch-user';
import { ListState } from '../../services/list-state';

export interface BdsmResultEntry {
  result: BdsmResult;
  takenAt: Date;
}

export interface BdsmMatch {
  percent: number;
  color: string;
}

export interface BdsmCommunityEntry extends BdsmResultEntry {
  user: TwitchUser | null;
  name: string;
  match: BdsmMatch | null;
  matchPending: boolean;
}

const OWN_TAB: number = 0;
const COMMUNITY_TAB: number = 1;

@Component({
  selector: 'app-bdsm-page',
  templateUrl: './bdsm-page.component.html',
  styleUrl: './bdsm-page.component.scss',
  imports: [BusyBarComponent, DatePipe, NgOptimizedImage, MatButtonModule, MatExpansionModule, MatIconModule, MatTabsModule, BdsmResultComponent, UserBadgesComponent, LocaleDatePipe],
})
export class BdsmPageComponent {

  private readonly bdsm: BdsmService = inject(BdsmService);
  private readonly twitch: TwitchService = inject(TwitchService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);

  // Neither tab has a count endpoint, so both run without one: there is nothing to draw ghost rows
  // from, and the skeleton card below stands in for the whole list instead.
  private readonly ownState: ListState<BdsmResultEntry> = new ListState<BdsmResultEntry>();
  private readonly communityState: ListState<BdsmCommunityEntry> = new ListState<BdsmCommunityEntry>();

  private communityRequested: boolean = false;

  protected readonly selected: WritableSignal<number> = signal(OWN_TAB);

  protected readonly entries: Signal<BdsmResultEntry[]> = this.ownState.rows.asReadonly();
  protected readonly community: Signal<BdsmCommunityEntry[]> = this.communityState.rows.asReadonly();

  protected readonly count: Signal<number> = this.ownState.count;
  protected readonly communityCount: Signal<number> = this.communityState.count;

  protected readonly unreachable: Signal<boolean> = this.ownState.failed.asReadonly();
  protected readonly communityUnreachable: Signal<boolean> = this.communityState.failed.asReadonly();

  protected readonly loading: Signal<boolean> = computed((): boolean =>
    this.selected() === COMMUNITY_TAB ? this.communityState.loading() : this.ownState.loading());

  protected readonly showProgress: Signal<boolean> = computed((): boolean =>
    this.selected() === COMMUNITY_TAB ? this.communityState.refreshing() : this.ownState.refreshing());

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

    await this.ownState.load(
      async (): Promise<BdsmResultEntry[]> => (await this.bdsm.getResults(userId))
        .map((result: BdsmResult): BdsmResultEntry => ({ result, takenAt: resultTakenAt(result) }))
        .sort((left: BdsmResultEntry, right: BdsmResultEntry): number => right.takenAt.getTime() - left.takenAt.getTime()),
      (): void => this.notifications.failure('Could not load your BDSM test results.'),
    );
  }

  private async loadCommunity(): Promise<void> {
    const me: Broadcaster | null = this.auth.currentUser();
    if (!me) return;

    this.communityRequested = true;

    await this.communityState.load(
      async (): Promise<BdsmCommunityEntry[]> => {
        const followers: FollowerProfile[] = await this.twitch.getFollowers();
        const byId: Map<string, TwitchUser> = new Map(followers.map((follower: FollowerProfile): [string, TwitchUser] => [follower.id, follower]));
        byId.set(me.id, me);

        const results: BdsmResult[] = await this.bdsm.getResultsFor([...byId.keys()]);
        const entries: BdsmCommunityEntry[] = results
          .map((result: BdsmResult): BdsmCommunityEntry => {
            const user: TwitchUser | undefined = byId.get(result.userId);

            return {
              result,
              takenAt: resultTakenAt(result),
              user: user ?? null,
              name: user?.displayName ?? result.userId,
              match: null,
              matchPending: true,
            };
          })
          .sort((left: BdsmCommunityEntry, right: BdsmCommunityEntry): number => right.takenAt.getTime() - left.takenAt.getTime());

        this.communityState.rows.set(entries);

        const matches: Map<string, number> = await this.matchesAgainst(me.id, results);

        return entries.map((entry: BdsmCommunityEntry): BdsmCommunityEntry => {
          const percent: number | undefined = matches.get(entry.result.userId);
          return { ...entry, match: percent === undefined ? null : { percent, color: traitColor(percent) }, matchPending: false };
        });
      },
      (): void => {
        this.communityRequested = false;
        this.notifications.failure('Could not load the BDSM test results of your followers.');
      },
    );
  }

  private async matchesAgainst(userId: string, results: BdsmResult[]): Promise<Map<string, number>> {
    const partnerIds: string[] = results.map((result: BdsmResult): string => result.userId);

    if (!partnerIds.length) return new Map();

    try {
      const scores: BdsmMatchScore[] = await this.bdsm.getMatchScores(userId, partnerIds);
      return new Map(scores.map((score: BdsmMatchScore): [string, number] => [score.partnerId, score.score]));
    } catch {
      this.notifications.failure('Could not work out how well you match your followers.');
      return new Map();
    }
  }
}