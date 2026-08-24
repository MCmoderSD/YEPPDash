import { ComponentRef, DestroyRef, Directive, inject, ViewContainerRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatAutocomplete } from '@angular/material/autocomplete';
import { ScrollBarComponent } from './scroll-bar.component';

/**
 * The app's scroll bar on an autocomplete's panel.
 *
 * ScrollBarDirective cannot do this job: it mounts the bar beside its own host, and an autocomplete
 * panel is not there. Material builds it into a CDK overlay at the end of the document, so the
 * element to cover does not exist until the panel opens and stops existing again when it closes -
 * which is why this hangs off the open/close pair rather than off a template position.
 */
@Directive({
  selector: 'mat-autocomplete[appOverlayScrollBar]',
})
export class OverlayScrollBarDirective {

  private readonly autocomplete: MatAutocomplete = inject(MatAutocomplete);
  private readonly container: ViewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  private bars: ComponentRef<ScrollBarComponent> | null = null;

  constructor() {
    this.autocomplete.opened.pipe(takeUntilDestroyed()).subscribe((): void => this.cover());
    this.autocomplete.closed.pipe(takeUntilDestroyed()).subscribe((): void => this.clear());

    this.destroyRef.onDestroy((): void => this.clear());
  }

  private cover(): void {
    // A panel reopened without a close in between would otherwise leave the first bar behind,
    // measuring an element that is no longer on the page.
    this.clear();

    const panel: HTMLElement | undefined = this.autocomplete.panel?.nativeElement;
    const pane: HTMLElement | null | undefined = panel?.parentElement;
    if (!panel || !pane) return;

    const bars: ComponentRef<ScrollBarComponent> = this.container.createComponent(ScrollBarComponent);

    bars.setInput('target', panel);

    // The bar places itself against its own offsetParent, so it has to be moved into the pane the
    // panel floats in. Left where the view container put it - back in the page, under a stacking
    // context the overlay sits far above - it would be measured against the document and painted
    // beneath the very panel it belongs to.
    pane.appendChild(bars.location.nativeElement);

    this.bars = bars;
  }

  private clear(): void {
    this.bars?.destroy();
    this.bars = null;
  }
}
