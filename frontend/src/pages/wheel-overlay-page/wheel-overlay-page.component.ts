import { Component, computed, DestroyRef, effect, EffectCleanupRegisterFn, inject, input, InputSignal, Signal, signal, viewChild, WritableSignal } from "@angular/core";
import { OverlayFrameComponent } from '../../components/overlay-frame-component/overlay-frame.component';
import { WheelComponent, WheelSpin } from '../../components/wheel-component/wheel.component';
import { WheelService } from '../../services/wheel.service';
import { WheelMessage, WheelSyncService } from '../../services/wheel-sync.service';
import { StreamListener } from '../../services/sse.service';
import { slicesFrom } from '../../data/wheel-entry';

@Component({
  selector: 'app-wheel-overlay-page',
  templateUrl: './wheel-overlay-page.component.html',
  styleUrl: './wheel-overlay-page.component.scss',
  imports: [OverlayFrameComponent, WheelComponent],
})
export class WheelOverlayPageComponent {

  readonly channel: InputSignal<string | undefined> = input<string>();

  private readonly wheels: WheelService = inject(WheelService);
  private readonly sync: WheelSyncService = inject(WheelSyncService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly wheel: Signal<WheelComponent | undefined> = viewChild(WheelComponent);

  private listener: StreamListener | null = null;

  protected readonly slices: WritableSignal<string[]> = signal<string[]>([]);
  protected readonly winner: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly loaded: WritableSignal<boolean> = signal(false);

  protected readonly hint: Signal<string | null> = computed((): string | null => {
    if (this.slices().length > 0) return null;
    if (!this.channel()) return 'This link has no channel. Copy the overlay link again from the Lucky Wheel page.';

    return this.loaded() ? 'No entries on this wheel yet. Add some on the Lucky Wheel page.' : 'Loading…';
  });

  constructor() {
    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const channelId: string | undefined = this.channel();
      if (!channelId) return;

      const listener: StreamListener = this.sync.listen(
        channelId, (message: WheelMessage): void => this.receive(message),
        (): void => void this.refresh(channelId)
      );

      this.listener = listener;

      void this.refresh(channelId);

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

  private async refresh(channelId: string): Promise<void> {
    if (this.wheel()?.spinning()) return;

    try {
      this.show(await this.wheels.getWheel(channelId));
    } catch {
      // A stream that outlives a restart of the API picks the list up on the next connection rather
      // than sitting on an error.
    } finally {
      this.loaded.set(true);
    }
  }

  private receive(message: WheelMessage): void {
    if (message.type === 'state') {
      this.show(message.entries);
      return;
    }

    if (message.type === 'spin') {
      this.winner.set(null);
      this.wheel()?.spin(message.index);
      return;
    }

    if (message.type === 'dismiss') this.winner.set(null);
  }

  private show(entries: string[]): void {
    const slices: string[] = slicesFrom(entries);

    if (slices.join(' ') === this.slices().join(' ')) return;
    if (this.wheel()?.spinning()) return;

    this.slices.set(slices);
  }
}