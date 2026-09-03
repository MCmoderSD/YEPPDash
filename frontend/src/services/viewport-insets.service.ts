import { DOCUMENT } from '@angular/common';
import { inject, Service, signal, Signal, WritableSignal } from '@angular/core';

@Service()
export class ViewportInsetsService {

  private readonly document: Document = inject(DOCUMENT);

  private readonly inset: WritableSignal<number> = signal(0);

  private footer: HTMLElement | null = null;

  private published = -1;

  readonly footerInset: Signal<number> = this.inset.asReadonly();

  track(footer: HTMLElement): () => void {
    const view: (Window & typeof globalThis) | null = this.document.defaultView;
    if (!view) return (): void => undefined;

    this.footer = footer;

    const measure = (): void => this.measure();

    measure();

    view.addEventListener('scroll', measure, { passive: true });
    view.addEventListener('resize', measure);

    const sizes: ResizeObserver | undefined = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;

    sizes?.observe(footer);

    return (): void => {
      view.removeEventListener('scroll', measure);
      view.removeEventListener('resize', measure);
      sizes?.disconnect();

      this.footer = null;
      this.inset.set(0);
      this.document.documentElement.style.removeProperty('--app-footer-inset');
      this.published = -1;
    };
  }

  private measure(): void {
    if (!this.footer) return;

    const root: HTMLElement = this.document.documentElement;
    const covered: number = Math.round(Math.max(0, root.clientHeight - this.footer.getBoundingClientRect().top));

    if (covered === this.published) return;

    this.published = covered;
    this.inset.set(covered);
    root.style.setProperty('--app-footer-inset', `${covered}px`);
  }
}