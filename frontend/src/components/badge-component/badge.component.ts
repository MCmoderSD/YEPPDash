import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input, InputSignal, Signal } from '@angular/core';
import { BadgePreset, BadgeSize, badgeIconUrl, DEFAULT_BADGE_SIZE } from '../../data/badge';

@Component({
  selector: 'app-badge',
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.scss',
  imports: [NgOptimizedImage],
  host: {
    '[style.--badge-size]': 'sizePx()',
    '[class.badge-icon-only]': '!text()',
  },
})
export class BadgeComponent {

  readonly preset: InputSignal<BadgePreset | null> = input<BadgePreset | null>(null);

  readonly size: InputSignal<BadgeSize> = input<BadgeSize>(DEFAULT_BADGE_SIZE);

  readonly icon: InputSignal<string | null> = input<string | null>(null);

  readonly label: InputSignal<string | null> = input<string | null>(null);

  protected readonly text: Signal<string> = computed(
    (): string => this.label() ?? this.preset() ?? '',
  );

  protected readonly source: Signal<string | null> = computed((): string | null => {
    const custom: string | null = this.icon();
    if (custom) return custom;

    const preset: BadgePreset | null = this.preset();
    return preset === null ? null : badgeIconUrl(preset, this.size());
  });

  protected readonly sizePx: Signal<string> = computed((): string => `${this.size()}px`);
}
