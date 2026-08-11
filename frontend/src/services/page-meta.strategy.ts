import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

@Injectable()
export class PageMetaStrategy extends TitleStrategy {

  private readonly title: Title = inject(Title);
  private readonly meta: Meta = inject(Meta);

  private readonly fallback: string = this.meta.getTag('name="description"')?.content ?? '';

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title: string | undefined = this.buildTitle(snapshot);
    if (title !== undefined) this.title.setTitle(title);

    this.meta.updateTag({ name: 'description', content: this.describe(snapshot) });
  }

  private describe(snapshot: RouterStateSnapshot): string {
    let route: ActivatedRouteSnapshot = snapshot.root;
    while (route.firstChild) route = route.firstChild;

    const description: unknown = route.data['description'];

    return typeof description === 'string' && description.length > 0 ? description : this.fallback;
  }
}