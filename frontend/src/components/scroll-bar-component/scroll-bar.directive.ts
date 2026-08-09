import {
  afterNextRender,
  ComponentRef,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  ViewContainerRef,
} from '@angular/core';
import { ScrollBarComponent } from './scroll-bar.component';

/**
 * Puts the app's own scroll bars on whatever it is applied to.
 *
 * The component underneath has to be placed by hand next to the element it watches and pointed at
 * it with a template reference, which is three lines of scaffolding at every call site and easy to
 * leave off a new one — the sidebar went without a bar for exactly that reason. As an attribute it
 * is one word on the element that scrolls.
 *
 * The bars are inserted as a sibling of the host and positioned against the nearest positioned
 * ancestor, so that ancestor needs `position: relative` for them to land on the host rather than
 * somewhere further up the page.
 */
@Directive({
  selector: '[appScrollBar]',
})
export class ScrollBarDirective {

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly container: ViewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  constructor() {
    // The component measures layout on the way up, which exists only once the view is in a
    // document — and never on the server, where afterNextRender does not run at all.
    afterNextRender((): void => {
      const bars: ComponentRef<ScrollBarComponent> =
        this.container.createComponent(ScrollBarComponent);

      bars.setInput('target', this.host.nativeElement);

      // The container tears its own contents down with the host view, but not if this directive is
      // destroyed while that view lives on — which is what happens when the attribute itself is
      // conditional.
      this.destroyRef.onDestroy((): void => bars.destroy());
    });
  }
}