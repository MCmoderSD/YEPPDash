import { Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, input, InputSignal, Signal, signal, viewChild, WritableSignal } from "@angular/core";
import { OverlayFrameComponent } from '../../components/overlay-frame-component/overlay-frame.component';
import { WheelComponent, WheelSpin } from '../../components/wheel-component/wheel.component';
import { WheelService } from '../../services/wheel.service';
import { WheelMessage, WheelSyncService } from '../../services/wheel-sync.service';
import { StreamListener } from '../../services/sse.service';
import { wheelSlices } from '../../data/wheel-entry';
import { WheelOverlayState } from '../../data/wheel';

@Component({
  selector: 'app-wheel-overlay-page',
  templateUrl: './wheel-overlay-page.component.html',
  styleUrl: './wheel-overlay-page.component.scss',
  imports: [OverlayFrameComponent, WheelComponent],
})
export class WheelOverlayPageComponent {

  readonly wheel: InputSignal<string | undefined> = input<string>();

  private readonly wheels: WheelService = inject(WheelService);
  private readonly sync: WheelSyncService = inject(WheelSyncService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly board: Signal<WheelComponent | undefined> = viewChild(WheelComponent);

  private listener: StreamListener | null = null;

  protected readonly slices: WritableSignal<string[]> = signal<string[]>([]);
  protected readonly winner: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly loaded: WritableSignal<boolean> = signal(false);
  protected readonly known: WritableSignal<boolean> = signal(true);

  protected readonly hint: Signal<string | null> = computed((): string | null => {
    if (this.slices().length > 0) return null;
    if (!this.wheel()) return 'This link names no wheel. Copy the overlay link again from the Lucky Wheel page.';
    if (!this.loaded()) return 'Loading…';

    return this.known()
      ? 'No entries on this wheel yet. Add some on the Lucky Wheel page.'
      : 'This wheel is gone. Copy the overlay link again from the Lucky Wheel page.';
  });

  constructor() {
    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const wheelId: string | undefined = this.wheel();
      if (!wheelId) return;

      const listener: StreamListener = this.sync.listenOverlay(
        wheelId, (message: WheelMessage): void => this.receive(message),
        (): void => void this.refresh(wheelId)
      );

      this.listener = listener;

      void this.refresh(wheelId);

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

  private async refresh(wheelId: string): Promise<void> {
    if (this.board()?.spinning()) return;

    try {
      this.show(await this.wheels.getOverlay(wheelId));
    } catch {
      // A stream that outlives a restart of the API picks the list up on the next connection rather
      // than sitting on an error.
    } finally {
      this.loaded.set(true);
    }
  }

  private receive(message: WheelMessage): void {
    if (message.wheelId !== this.wheel()) return;

    if (message.type === 'state') {
      this.show(message.wheel);
      return;
    }

    if (message.type === 'spin') {
      this.winner.set(null);
      this.board()?.spin(message.index);
      return;
    }

    this.winner.set(null);
  }

  private show(state: WheelOverlayState | null): void {
    this.known.set(state !== null);

    const slices: string[] = wheelSlices(state?.entries ?? []);

    if (slices.join(' ') === this.slices().join(' ')) return;
    if (this.board()?.spinning()) return;

    this.slices.set(slices);
  }
}