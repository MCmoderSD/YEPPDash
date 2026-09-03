import { afterNextRender, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { environment } from '../../environments/environment';

interface FooterLink {
  readonly label: string;
  readonly url: string;
}

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly document: Document = inject(DOCUMENT);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  protected readonly year: number = new Date().getFullYear();

  protected readonly links: readonly FooterLink[] = [
    { label: 'Imprint', url: `${environment.marketingBaseUrl}/imprint` },
    { label: 'Privacy Policy', url: `${environment.marketingBaseUrl}/privacy` },
    { label: 'Terms of Service', url: `${environment.marketingBaseUrl}/terms` },
  ];

  protected readonly repos: readonly FooterLink[] = [
    { label: 'YEPPBot Repo', url: 'https://github.com/MCmoderSD/YEPPBot' },
    { label: 'YEPPDash Repo', url: 'https://github.com/MCmoderSD/YEPPDash' },
  ];

  constructor() {
    afterNextRender((): void => {
      const view: (Window & typeof globalThis) | null = this.document.defaultView;
      if (!view) return;

      const root: HTMLElement = this.document.documentElement;

      let published = -1;
      let frame = 0;

      const publish = (): void => {
        frame = 0;

        const top: number = this.host.nativeElement.getBoundingClientRect().top;
        const inset: number = Math.round(Math.max(0, root.clientHeight - top));

        if (inset === published) return;

        published = inset;
        root.style.setProperty('--app-footer-inset', `${inset}px`);
      };

      const schedule = (): void => {
        if (frame === 0) frame = view.requestAnimationFrame(publish);
      };

      publish();

      view.addEventListener('scroll', schedule, { passive: true });
      view.addEventListener('resize', schedule);

      const sizes: ResizeObserver | undefined =
        typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : undefined;

      sizes?.observe(this.host.nativeElement);

      this.destroyRef.onDestroy((): void => {
        if (frame !== 0) view.cancelAnimationFrame(frame);

        view.removeEventListener('scroll', schedule);
        view.removeEventListener('resize', schedule);

        sizes?.disconnect();
        root.style.removeProperty('--app-footer-inset');
      });
    });
  }
}