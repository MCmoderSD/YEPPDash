import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, effect, EffectCleanupRegisterFn, inject, input, InputSignal, Signal, signal, viewChild, WritableSignal } from "@angular/core";
import { WheelComponent, WheelSpin } from '../../components/wheel-component/wheel.component';
import { WheelService } from '../../services/wheel.service';
import { WheelListener, WheelMessage, WheelSyncService } from '../../services/wheel-sync.service';
import { slicesFrom } from '../../data/wheel-entry';

const TRANSPARENT: string = 'app-transparent';

@Component({
  selector: 'app-wheel-overlay-page',
  templateUrl: './wheel-overlay-page.component.html',
  styleUrl: './wheel-overlay-page.component.scss',
  imports: [WheelComponent],
})
export class WheelOverlayPageComponent {

  readonly channel: InputSignal<string | undefined> = input<string>();

  private readonly wheels: WheelService = inject(WheelService);
  private readonly sync: WheelSyncService = inject(WheelSyncService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private readonly wheel: Signal<WheelComponent | undefined> = viewChild(WheelComponent);

  private listener: WheelListener | null = null;

  protected readonly slices: WritableSignal<string[]> = signal<string[]>([]);
  protected readonly winner: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly loaded: WritableSignal<boolean> = signal(false);

  constructor() {
    const root: HTMLElement = this.document.documentElement;
    root.classList.add(TRANSPARENT);
    this.destroyRef.onDestroy((): void => root.classList.remove(TRANSPARENT));

    effect((onCleanup: EffectCleanupRegisterFn): void => {
      const channelId: string | undefined = this.channel();
      if (!channelId) return;

      const listener: WheelListener = this.sync.listen(
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