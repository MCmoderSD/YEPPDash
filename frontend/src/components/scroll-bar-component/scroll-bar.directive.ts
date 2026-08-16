import { afterNextRender, ComponentRef, DestroyRef, Directive, ElementRef, inject, ViewContainerRef } from '@angular/core';
import { ScrollBarComponent } from './scroll-bar.component';

@Directive({
  selector: '[appScrollBar]',
})
export class ScrollBarDirective {

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly container: ViewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender((): void => {
      const bars: ComponentRef<ScrollBarComponent> = this.container.createComponent(ScrollBarComponent);

      bars.setInput('target', this.host.nativeElement);

      this.destroyRef.onDestroy((): void => bars.destroy());
    });
  }
}