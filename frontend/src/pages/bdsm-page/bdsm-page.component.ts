import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
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
  imports: [DatePipe, NgOptimizedImage, MatButtonModule, MatExpansionModule, MatIconModule, MatProgressBarModule, MatTabsModule, BdsmResultComponent, UserBadgesComponent, LocaleDatePipe],
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


  private communityRequested: boolean = false;

  protected readonly selected: WritableSignal<number> = signal(OWN_TAB);

  protected readonly entries: Signal<BdsmResultEntry[]> = this.ownRows.asReadonly();
  protected readonly community: Signal<BdsmCommunityEntry[]> = this.communityRows.asReadonly();

  protected readonly count: Signal<number> = computed((): number => this.ownRows().length);
  protected readonly communityCount: Signal<number> = computed((): number => this.communityRows().length);

  protected readonly unreachable: Signal<boolean> = this.ownFailed.asReadonly();
  protected readonly communityUnreachable: Signal<boolean> = this.communityFailed.asReadonly();


  protected readonly loading: Signal<boolean> = computed((): boolean =>
    this.selected() === COMMUNITY_TAB ? this.communityLoading() : this.ownLoading());

  protected readonly showProgress: Signal<boolean> = computed((): boolean =>
    this.loading() && (this.selected() === COMMUNITY_TAB ? this.communityRows().length > 0 : this.ownRows().length > 0));

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
    const me: Broadcaster | null = this.auth.currentUser();
    if (!me) return;

    this.communityRequested = true;

    this.communityLoading.set(true);
    this.communityFailed.set(false);
    try {
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
      this.communityRows.set(entries);

      const matches: Map<string, number> = await this.matchesAgainst(me.id, results);
      this.communityRows.update((rows: BdsmCommunityEntry[]): BdsmCommunityEntry[] =>
        rows.map((entry: BdsmCommunityEntry): BdsmCommunityEntry => {
          const percent: number | undefined = matches.get(entry.result.userId);
          return { ...entry, match: percent === undefined ? null : { percent, color: traitColor(percent) }, matchPending: false };
        }));
    } catch {
      this.communityRows.set([]);
      this.communityFailed.set(true);
      this.communityRequested = false;
      this.notifications.failure('Could not load the BDSM test results of your followers.');
    } finally {
      this.communityLoading.set(false);
    }
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