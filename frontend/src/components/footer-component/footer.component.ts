import { Component } from '@angular/core';
import { environment } from '../../environments/environment';

interface FooterLink {
  readonly label: string;
  readonly url: string;
}

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  standalone: false,
})
export class FooterComponent {
  protected readonly year: number = new Date().getFullYear();

  // Absolute rather than routed: the legal pages only exist on the marketing host, so a routerLink
  // would resolve against whatever host the footer is on and find no route at all on the dashboard.
  protected readonly links: readonly FooterLink[] = [
    { label: 'Imprint', url: `${environment.marketingBaseUrl}/imprint` },
    { label: 'Privacy Policy', url: `${environment.marketingBaseUrl}/privacy` },
    { label: 'Terms of Service', url: `${environment.marketingBaseUrl}/terms` },
  ];

  protected readonly repos: readonly FooterLink[] = [
    { label: 'YEPPBot Repo', url: 'https://github.com/MCmoderSD/YEPPBot' },
    { label: 'YEPPDash Repo', url: 'https://github.com/MCmoderSD/YEPPDash' },
  ];
}
