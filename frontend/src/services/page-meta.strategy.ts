import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { environment } from '../environments/environment';
import { isDashHost } from './dash-host';

const SITE: string = 'YEPPDash';

@Injectable()
export class PageMetaStrategy extends TitleStrategy {

  private readonly title: Title = inject(Title);
  private readonly meta: Meta = inject(Meta);
  private readonly document: Document = inject(DOCUMENT);

  private readonly fallback: string = this.meta.getTag('name="description"')?.content ?? '';

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title: string | undefined = this.buildTitle(snapshot);
    if (title !== undefined) this.title.setTitle(title);

    const description: string = this.describe(snapshot);

    this.meta.updateTag({ name: 'description', content: description });

    const heading: string = title ?? this.document.title;
    const card: string = heading === SITE ? SITE : `${heading} · ${SITE}`;

    this.meta.updateTag({ property: 'og:title', content: card });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ name: 'twitter:title', content: card });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    this.address(snapshot.url);
  }

  private address(url: string): void {
    if (isDashHost()) return;

    const path: string = url.split(/[?#]/)[0];
    const absolute: string = `${environment.marketingBaseUrl}${path === '/' ? '' : path}`;

    this.meta.updateTag({ property: 'og:url', content: absolute });

    const existing: HTMLLinkElement | null = this.document.head.querySelector('link[rel="canonical"]');
    const link: HTMLLinkElement = existing ?? this.document.createElement('link');

    link.setAttribute('rel', 'canonical');
    link.setAttribute('href', absolute);

    if (!existing) this.document.head.appendChild(link);
  }

  private describe(snapshot: RouterStateSnapshot): string {
    let route: ActivatedRouteSnapshot = snapshot.root;
    while (route.firstChild) route = route.firstChild;

    const description: unknown = route.data['description'];

    return typeof description === 'string' && description.length > 0 ? description : this.fallback;
  }
}