import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, effect, EffectCleanupRegisterFn, inject, input, InputSignal, Signal, signal, viewChild, WritableSignal } from '@angular/core';
import { WheelComponent, WheelSpin } from '../../components/wheel-component/wheel.component';
import { GiveawayService } from '../../services/giveaway.service';
import { GiveawayListener, GiveawayOverlayMessage, GiveawaySyncService } from '../../services/giveaway-sync.service';
import { GiveawayOverlaySlice, GiveawayOverlayState } from '../../data/giveaway';

const TRANSPARENT: string = 'app-transparent';

@Component({
  selector: 'app-giveaway-overlay-page',
  templateUrl: './giveaway-overlay-page.component.html',
  styleUrl: './giveaway-overlay-page.component.scss',
  imports: [WheelComponent],
})
export class GiveawayOverlayPageComponent {

  readonly giveaway: InputSignal<string | undefined> = input<string>();

  private readonly giveaways: GiveawayService = inject(GiveawayService);
  private readonly sync: GiveawaySyncService = inject(GiveawaySyncService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly wheel: Signal<WheelComponent | undefined> = viewChild(WheelComponent);

  private listener: GiveawayListener | null = null;

  protected readonly slices: WritableSignal<string[]> = signal<string[]>([]);
  protected readonly weights: WritableSignal<number[]> = signal<number[]>([]);
  protected readonly title: WritableSignal<string> = signal('');
  protected readonly winner: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly loaded: WritableSignal<boolean> = signal(false);

  constructor() {
    const root: HTMLElement = this.document.documentElement;
    root.classList.add(TRANSPARENT);
    this.destroyRef.onDestroy((): void => root.classList.remove(TRANSPARENT));

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const giveawayId: string | undefined = this.giveaway();
      if (!giveawayId) return;

      const listener: GiveawayListener = this.sync.listenOverlay(
        giveawayId, (message: GiveawayOverlayMessage): void => this.receive(message),
        (): void => void this.refresh(giveawayId)
      );

      this.listener = listener;

      void this.refresh(giveawayId);

      onCleanup((): void => {
        this.listener = null;
        listener.close();
      });
    });

    this.destroyRef.onDestroy((): void => this.listener?.close());
  }

  protected landed(spin: WheelSpin): void {
    this.winner.set(spin.label);
  }

  private async refresh(giveawayId: string): Promise<void> {
    if (this.wheel()?.spinning()) return;

    try {
      this.show(await this.giveaways.getOverlay(giveawayId));
    } catch {
      // A stream that outlives a restart of the API picks the wheel up on the next connection
      // rather than sitting on an error.
    } finally {
      this.loaded.set(true);
    }
  }

  private receive(message: GiveawayOverlayMessage): void {
    const mine: string | undefined = this.giveaway();

    if (message.type === 'state') {
      if (message.giveaway.giveawayId === mine) this.show(message.giveaway);
      return;
    }

    if (message.giveawayId !== mine) return;

    if (message.type === 'spin') {
      this.winner.set(null);
      this.wheel()?.spin(message.index);
      return;
    }

    this.winner.set(null);
  }

  private show(state: GiveawayOverlayState | null): void {
    if (this.wheel()?.spinning()) return;
    if (this.fingerprint(state) === this.shown()) return;

    const slices: GiveawayOverlaySlice[] = state?.slices ?? [];

    this.slices.set(slices.map((slice: GiveawayOverlaySlice): string => slice.label));
    this.weights.set(slices.map((slice: GiveawayOverlaySlice): number => slice.weight));
    this.title.set(state?.title ?? '');
  }

  private shown(): string {
    return JSON.stringify([this.title(), this.slices(), this.weights()]);
  }

  private fingerprint(state: GiveawayOverlayState | null): string {
    const slices: GiveawayOverlaySlice[] = state?.slices ?? [];

    return JSON.stringify([
      state?.title ?? '',
      slices.map((slice: GiveawayOverlaySlice): string => slice.label),
      slices.map((slice: GiveawayOverlaySlice): number => slice.weight),
    ]);
  }
}