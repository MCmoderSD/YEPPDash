import { Component, computed, inject, Signal, signal, WritableSignal } from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { AuthService } from '../../services/auth.service';
import { ModuleService } from '../../services/module.service';
import { NotificationService } from '../../services/notification.service';
import { BotModule } from '../../data/bot-module';

@Component({
  selector: 'app-module-page',
  templateUrl: './module-page.component.html',
  styleUrl: './module-page.component.scss',
  standalone: false,
})
export class ModulePageComponent {

  private readonly modules: ModuleService = inject(ModuleService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly notifications: NotificationService = inject(NotificationService);

  private readonly entries: WritableSignal<BotModule[]> = signal<BotModule[]>([]);
  private readonly isLoading: WritableSignal<boolean> = signal(false);
  private readonly isBusy: WritableSignal<boolean> = signal(false);
  private readonly failed: WritableSignal<boolean> = signal(false);

  // Which panels are open, rather than a flag on each module: the list is replaced wholesale after
  // every write, and a flag living on the rows would be reset by each one.
  private readonly opened: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());

  protected readonly moduleList: Signal<BotModule[]> = this.entries.asReadonly();
  protected readonly loading: Signal<boolean> = this.isLoading.asReadonly();
  protected readonly busy: Signal<boolean> = this.isBusy.asReadonly();
  protected readonly unreachable: Signal<boolean> = this.failed.asReadonly();

  protected readonly count: Signal<number> = computed((): number => this.moduleList().length);

  protected readonly enabledCount: Signal<number> = computed((): number =>
    this.moduleList().filter((module: BotModule): boolean => module.enabled).length);

  constructor() {
    void this.load();
  }

  protected isOpen(id: string): boolean {
    return this.opened().has(id);
  }

  protected toggleOpen(id: string): void {
    this.opened.update((open: ReadonlySet<string>): ReadonlySet<string> => {
      const next = new Set(open);
      if (!next.delete(id)) next.add(id);

      return next;
    });
  }

  protected async setEnabled(module: BotModule, change: MatSlideToggleChange): Promise<void> {
    const enabled: boolean = change.checked;

    // Moved before the request so the switch answers the click rather than the round trip, and put
    // back below if the write does not land.
    this.patchEnabled(module.id, enabled);

    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    this.isBusy.set(true);
    try {
      const updated: BotModule = enabled
        ? await this.modules.enableModule(channelId, module.id)
        : await this.modules.disableModule(channelId, module.id);

      this.patchEnabled(module.id, updated.enabled);
    } catch {
      // The switch has to be put back through Material rather than through the binding alone: it
      // flips itself on click, and by the time this runs the bound signal has gone from the old
      // value to the new one and back, which Angular sees as no change at all and never writes. The
      // signal is corrected too, so a later re-render agrees with what is on screen.
      change.source.checked = module.enabled;
      this.patchEnabled(module.id, module.enabled);

      this.notifications.failure(`Could not turn ${module.name} ${enabled ? 'on' : 'off'}.`);
    } finally {
      this.isBusy.set(false);
    }
  }

  private patchEnabled(id: string, enabled: boolean): void {
    this.entries.update((entries: BotModule[]): BotModule[] => entries
      .map((entry: BotModule): BotModule => entry.id === id ? { ...entry, enabled } : entry));
  }

  private async load(): Promise<void> {
    const channelId: string | undefined = this.auth.currentUser()?.id;
    if (!channelId) return;

    this.isLoading.set(true);
    this.failed.set(false);
    try {
      this.entries.set(await this.modules.getModules(channelId));
    } catch {
      this.entries.set([]);
      this.failed.set(true);
      this.notifications.failure('Could not load your modules.');
    } finally {
      this.isLoading.set(false);
    }
  }
}