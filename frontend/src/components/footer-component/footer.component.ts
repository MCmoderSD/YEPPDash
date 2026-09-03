import { afterNextRender, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { ViewportInsetsService } from '../../services/viewport-insets.service';

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
  private readonly insets: ViewportInsetsService = inject(ViewportInsetsService);
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
      this.destroyRef.onDestroy(this.insets.track(this.host.nativeElement));
    });
  }
}
