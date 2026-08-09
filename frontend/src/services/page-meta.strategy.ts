import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/**
 * Keeps the document's description in step with the route, alongside the title the router already
 * sets. Hung off TitleStrategy rather than a subscription of its own because this runs at exactly
 * the moment a title would be applied — on every navigation, and once during prerendering, which is
 * what bakes the description into the static HTML a crawler reads.
 */
@Injectable()
export class PageMetaStrategy extends TitleStrategy {

  private readonly title: Title = inject(Title);
  private readonly meta: Meta = inject(Meta);

  // Whatever index.html shipped with, read once so the wording lives in one place. A route that
  // says nothing about itself falls back to it rather than to a copy that could drift.
  private readonly fallback: string = this.meta.getTag('name="description"')?.content ?? '';

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title: string | undefined = this.buildTitle(snapshot);
    if (title !== undefined) this.title.setTitle(title);

    this.meta.updateTag({ name: 'description', content: this.describe(snapshot) });
  }

  private describe(snapshot: RouterStateSnapshot): string {
    // The deepest matched route wins: a description belongs to the page being shown, not to a
    // parent that happens to wrap it.
    let route = snapshot.root;
    while (route.firstChild) route = route.firstChild;

    const description: unknown = route.data['description'];

    return typeof description === 'string' && description.length > 0 ? description : this.fallback;
  }
}
