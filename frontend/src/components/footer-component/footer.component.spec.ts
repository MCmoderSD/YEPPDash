import { TestBed } from '@angular/core/testing';
import { FooterComponent } from './footer.component';
import { ComponentsModule } from '../components.module';
import { environment } from '../../environments/environment';

describe('FooterComponent', () => {

  async function links(selector = '.footer-repos a, .footer-links a'): Promise<HTMLAnchorElement[]> {
    await TestBed.configureTestingModule({ imports: [ComponentsModule] }).compileComponents();

    const fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();

    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));
  }

  // The legal pages only ever match on the marketing host, so a link resolved against the current
  // origin lands on nothing at all once the dashboard is running on its own subdomain.
  it('should point every legal link at the marketing host', async () => {
    const hrefs = (await links('.footer-links a')).map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual([
      `${environment.marketingBaseUrl}/imprint`,
      `${environment.marketingBaseUrl}/privacy`,
      `${environment.marketingBaseUrl}/terms`,
    ]);
  });

  // Placed next to the copyright notice rather than with the legal links, per explicit request.
  it('should link both repos on GitHub next to the copyright notice', async () => {
    const hrefs = (await links('.footer-repos a')).map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual([
      'https://github.com/MCmoderSD/YEPPBot',
      'https://github.com/MCmoderSD/YEPPDash',
    ]);
  });

  it('should not route any of them through the router', async () => {
    for (const link of await links()) {
      expect(link.getAttribute('ng-reflect-router-link')).toBeNull();
    }
  });

  it('should open every link in a new tab without handing over the opener', async () => {
    for (const link of await links()) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener');
    }
  });

  it('should name each link', async () => {
    const labels = (await links()).map((link) => link.textContent?.trim());

    expect(labels).toEqual(['YEPPBot Repo', 'YEPPDash Repo', 'Imprint', 'Privacy Policy', 'Terms of Service']);
  });
});
